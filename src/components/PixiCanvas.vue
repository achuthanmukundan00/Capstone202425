<template>
  <div ref="canvasContainer" style="width: 100%; height: 100%;" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as PIXI from 'pixi.js';
import type { Charge } from '@/stores/charges';
import { useChargesStore } from '@/stores/charges';
import { drawElectricField, drawMagneticField, drawMagneticForcesOnAllCharges, drawElectricForceForCharge } from '@/utils/drawingUtils';
import { calculateMagneticForce, calculateElectricForce, calculateElectricField } from '@/utils/mathUtils';
import { ANIMATION_SPEED, FORCE_SCALING, FIELD_SPACING, VECTOR_LENGTH_SCALE, MAX_VECTOR_LENGTH } from '@/consts';

// Constants used for field drawing
const MIN_ALPHA = 0.15;
const MAX_ALPHA = 1.0;
const LOG_SCALE_FACTOR = 2;

const canvasContainer = ref<HTMLElement | null>(null);
const chargesStore = useChargesStore();
const chargesGraphics = new Map<string, PIXI.Graphics>(); // Map to keep track of drawn charges

let animationFrameId: number;
let app: PIXI.Application | null = null;
let lastForceUpdateTime = 0;
const FORCE_UPDATE_THROTTLE = 100; // Only update forces every 100ms during drag
let isDragging = false;
let needsForceUpdate = false;

const MOVEMENT_STEP = 10; // pixels per keypress

// Function to actually update the forces
function updateElectricForces() {
  if (!app || !chargesStore.showForces || chargesStore.mode !== 'electric') {
    return;
  }

  // Use non-null assertion since we already checked app is not null
  const application = app!;

  // Clear existing force vectors
  application.stage.children
    .filter(child =>
      child.name === 'electricForceVector' ||
      child.name?.startsWith('electricForceVector-from-')
    )
    .forEach(child => application.stage.removeChild(child));

  // Calculate and draw new forces
  calculateElectricForce(chargesStore.charges);
  chargesStore.charges.forEach(charge => {
    drawElectricForceForCharge(application, charge);
  });

  needsForceUpdate = false;
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    event.preventDefault(); // Prevent default tab behavior

    const charges = chargesStore.charges;
    if (charges.length === 0) return;

    if (!chargesStore.selectedChargeId) {
      chargesStore.setSelectedCharge(charges[0].id);
    } else {
      const currentIndex = charges.findIndex(c => c.id === chargesStore.selectedChargeId);
      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + charges.length) % charges.length
        : (currentIndex + 1) % charges.length;
      chargesStore.setSelectedCharge(charges[nextIndex].id);
    }
    return;
  }

  if (!chargesStore.selectedChargeId) return;

  const charge = chargesStore.charges.find(c => c.id === chargesStore.selectedChargeId);
  if (!charge) return;

  switch (event.key) {
    case 'ArrowUp':
      chargesStore.updateChargePosition(charge.id, {
        x: charge.position.x,
        y: charge.position.y - MOVEMENT_STEP
      });
      break;
    case 'ArrowDown':
      chargesStore.updateChargePosition(charge.id, {
        x: charge.position.x,
        y: charge.position.y + MOVEMENT_STEP
      });
      break;
    case 'ArrowLeft':
      chargesStore.updateChargePosition(charge.id, {
        x: charge.position.x - MOVEMENT_STEP,
        y: charge.position.y
      });
      break;
    case 'ArrowRight':
      chargesStore.updateChargePosition(charge.id, {
        x: charge.position.x + MOVEMENT_STEP,
        y: charge.position.y
      });
      break;
  }
};

const updateChargeMotion = () => {
  if (!chargesStore.isAnimating) return;

  chargesStore.charges.forEach(charge => {
    const force = calculateMagneticForce(charge, chargesStore.magneticField);
    charge.velocity.direction.x += force.x * FORCE_SCALING;
    charge.velocity.direction.y += force.y * FORCE_SCALING;
    charge.position.x += charge.velocity.direction.x * ANIMATION_SPEED;
    charge.position.y += charge.velocity.direction.y * ANIMATION_SPEED;
  });
  animationFrameId = requestAnimationFrame(updateChargeMotion);
};

onMounted(async () => {
  // Initialize PixiJS Application
  app = new PIXI.Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Enable zIndex sorting so that graphics with higher zIndex render on top
  app.stage.sortableChildren = true;

  // Append the canvas to the container
  if (canvasContainer.value && app.canvas) {
    canvasContainer.value.appendChild(app.canvas);
  }

  // Resize the canvas if the window is resized
  window.addEventListener('resize', resize);

  // Set up stage interactivity and pointer events
  app.stage.interactive = true;
  app.stage.hitArea = app.screen;
  app.stage.on('pointermove', (event) => {
    chargesStore.charges.forEach((charge) => {
      const graphic = chargesGraphics.get(charge.id);
      if (graphic && graphic.dragging) {
        isDragging = true;
        const newPosition = event.data.getLocalPosition(graphic.parent);
        graphic.position.set(newPosition.x, newPosition.y);
        chargesStore.updateChargePosition(charge.id, { x: newPosition.x, y: newPosition.y });

        // Use optimized field drawing and throttled force updates during drag
        if (chargesStore.mode === 'electric') {
          // Use throttled field updates too
          const now = Date.now();
          if (now - lastForceUpdateTime > FORCE_UPDATE_THROTTLE) {
            drawElectricFieldDuringDrag(app!, chargesStore.charges);

            if (chargesStore.showForces) {
              updateElectricForces();
            }
            lastForceUpdateTime = now;
          } else {
            // Just mark that we need an update, it will happen at the end of drag
            needsForceUpdate = true;
          }
        }
      }
    });
  });

  app.stage.on('pointerup', () => {
    chargesStore.charges.forEach((charge) => {
      const graphic = chargesGraphics.get(charge.id);
      if (graphic) {
        graphic.dragging = false;
        graphic.data = null;
        graphic.alpha = 1;
      }
    });

    // If we were dragging and have a pending update, redraw everything properly
    if (isDragging) {
      isDragging = false;
      if (chargesStore.mode === 'electric') {
        drawElectricField(app!, chargesStore.charges);
        if (needsForceUpdate && chargesStore.showForces) {
          updateElectricForces();
        }
      }
    }
  });

  app.stage.on('pointerdown', (event) => {
    if (event.target === app?.stage) {
      chargesStore.setSelectedCharge(null);
    }
  });

  // Watch for changes in the charges array with decreased sensitivity
  watch(
    () => chargesStore.charges,
    (newCharges) => {
      if (isDragging && chargesStore.mode === 'electric' && chargesStore.showForces) {
        // During drag operations, we already handle force updates with throttling
        // Only update the fields and charges here
        drawElectricField(app!, newCharges);
        updateChargesOnCanvas(newCharges);
      } else {
        // For non-drag updates, do the full update
        if (chargesStore.mode === 'electric') {
          drawElectricField(app!, newCharges);

          if (chargesStore.showForces) {
            updateElectricForces();
          }
        } else {
          drawMagneticField(app!, chargesStore.magneticField);
          drawMagneticForcesOnAllCharges(app!, chargesStore);
        }
        updateChargesOnCanvas(newCharges);
      }
    },
    { deep: true, immediate: true }
  );

  // Watch for mode changes
  watch(
    () => chargesStore.mode,
    (newMode) => {
      if (!app) return;

      // Clear all field and force vectors
      app.stage.children
        .filter(child =>
          child.name === 'fieldVector' ||
          child.name === 'electricForceVector' ||
          child.name?.startsWith('electricForceVector-from-') ||
          child.name?.startsWith('magneticForceVector-')
        )
        .forEach(child => app!.stage.removeChild(child));

      if (newMode === 'electric') {
        drawElectricField(app, chargesStore.charges);

        // Draw forces if enabled
        if (chargesStore.showForces) {
          updateElectricForces();
        }
      } else {
        // Clean up any remaining electric-specific elements
        app.stage.children
          .filter(child =>
            child.name === 'fieldVector' ||
            child.name === 'electricForceVector' ||
            child.name?.startsWith('electricForceVector-from-')
          )
          .forEach(child => app!.stage.removeChild(child));

        drawMagneticField(app!, chargesStore.magneticField);
        drawMagneticForcesOnAllCharges(app!, chargesStore);
      }
    }
  );

  watch(
    () => chargesStore.magneticField,
    () => {
      if (chargesStore.mode === 'magnetic') {
        drawMagneticField(app!, chargesStore.magneticField)
        drawMagneticForcesOnAllCharges(app!, chargesStore);
      }
    },
    { deep: true, immediate: true }
  );

  // Add keyboard event listener
  window.addEventListener('keydown', handleKeyDown);

  app.ticker.add(() => {
    updateChargeMotion();
  });
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  if (app) {
    app.destroy(true, { children: true });
    app = null;
  }
  window.removeEventListener('resize', resize);
  window.removeEventListener('keydown', handleKeyDown);
});

const resize = () => {
  if (app) {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    if (chargesStore.mode === 'electric') {
      drawElectricField(app, chargesStore.charges);
    } else {
      drawMagneticField(app!, chargesStore.magneticField)
      drawMagneticForcesOnAllCharges(app!, chargesStore);
    }
    updateChargesOnCanvas(chargesStore.charges);
  }
};

const updateChargesOnCanvas = (charges: Charge[]) => {
  if (!app) return;

  // Remove graphics for charges that no longer exist
  for (const [id, graphic] of chargesGraphics) {
    if (!charges.find((charge) => charge.id === id)) {
      app.stage.removeChild(graphic);
      chargesGraphics.delete(id);
    }
  }

  // Add or update graphics for current charges
  charges.forEach((charge) => {
    let graphic = chargesGraphics.get(charge.id);
    if (!graphic) {
      graphic = new PIXI.Graphics();
      // Set a high zIndex so that charges render on top of arrows
      graphic.zIndex = 10;
      chargesGraphics.set(charge.id, graphic);
      app?.stage.addChild(graphic);

      // Enable interactivity
      graphic.interactive = true;
      graphic.buttonMode = true;

      // Event handlers for selection
      graphic.on('pointerdown', () => {
        chargesStore.setSelectedCharge(charge.id);
      });

      // Event handlers for dragging
      graphic
        .on('pointerdown', (event) => {
          graphic!.data = event.data;
          graphic!.dragging = true;
        })
        .on('pointerup', () => {
          graphic!.dragging = false;
          graphic!.data = null;
        })
        .on('pointerupoutside', () => {
          graphic!.dragging = false;
          graphic!.data = null;
        });
    } else {
      graphic.clear();
    }

    const color = charge.polarity === 'positive' ? 0xD55E00 : 0x0072B2;
    const polarity = charge.polarity === 'positive' ? "+" : "-";

    // Draw the charge circle
    graphic.beginFill(color);
    graphic.lineStyle(0);
    graphic.drawCircle(0, 0, 20);
    graphic.endFill();

    // Set position
    graphic.position.set(charge.position.x, charge.position.y);

    // Create or update the text label for the charge magnitude
    let text = graphic.getChildByName('chargeLabel') as PIXI.Text;
    if (!text) {
      text = new PIXI.Text(polarity + charge.magnitude.toString() + 'C', {
        fontSize: 14,
        fill: 0xffffff,
        align: 'center'
      });
      text.name = 'chargeLabel';
      graphic.addChild(text);
    } else {
      text.text = polarity + charge.magnitude.toString() + 'C';
    }

    text.anchor.set(0.5);
    text.position.set(0, 0);
  });
};

// Add a watch for showForces changes
watch(
  () => chargesStore.showForces,
  (showForces) => {
    if (!app) return;

    // Clear existing electric force vectors - more thorough cleanup
    app!.stage.children
      .filter(child =>
        child.name === 'electricForceVector' ||
        child.name.startsWith('electricForceVector-from-') ||
        child.name?.startsWith('magneticForceVector-')
      )
      .forEach(child => app!.stage.removeChild(child));

    // Only redraw if in electric mode and showForces is true
    if (chargesStore.mode === 'electric' && showForces) {
      console.log("Showing electric forces, charge count:", chargesStore.charges.length);

      calculateElectricForce(chargesStore.charges);

      // Log more detailed info about the forces
      chargesStore.charges.forEach(charge => {
        console.log(`Charge ${charge.id} (${charge.polarity}, ${charge.magnitude}C):`);
        console.log(`- Total force: magnitude = ${charge.electricForce?.totalForce?.magnitude.toExponential(4)}, direction = (${charge.electricForce?.totalForce?.direction.x.toFixed(2)}, ${charge.electricForce?.totalForce?.direction.y.toFixed(2)})`);

        if (charge.electricForce?.partialForces) {
          console.log(`- Partial forces (${charge.electricForce.partialForces.length}):`);
          charge.electricForce.partialForces.forEach(pf => {
            const sourceId = pf.sourceChargeId || 'unknown';
            console.log(`  - From charge ${sourceId}: magnitude = ${pf.magnitude.toExponential(4)}, direction = (${pf.direction.x.toFixed(2)}, ${pf.direction.y.toFixed(2)})`);
          });
        }

        drawElectricForceForCharge(app!, charge);
      });
    } else if (chargesStore.mode === 'magnetic' && showForces) {
      console.log("Showing magnetic forces, charge count:", chargesStore.charges.length);
      // Re-draw magnetic forces
      drawMagneticForcesOnAllCharges(app!, chargesStore);
    }
  }
);

// Add an optimized electric field drawing function during drag
function drawElectricFieldDuringDrag(app: PIXI.Application, charges: Charge[]) {
  if (!app) return;

  // Use a larger spacing during drag to improve performance
  const LARGER_SPACING = FIELD_SPACING * 2;

  // Clear existing field vectors
  app.stage.children
    .filter(child => child.name === 'fieldVector')
    .forEach(child => app.stage.removeChild(child));

  // Draw electric field with a larger spacing
  if (charges.length === 0) return;

  let maxFieldMagnitude = 0;
  let minFieldMagnitude = Infinity;

  // First pass to find min/max magnitudes for proper scaling
  for (let x = 0; x < app.screen.width; x += LARGER_SPACING) {
    for (let y = 0; y < app.screen.height; y += LARGER_SPACING) {
      const fieldVector = { x: 0, y: 0 };
      charges.forEach(charge => {
        const chargeField = calculateElectricField(
          charge.position,
          charge.magnitude,
          { x, y },
          charge.polarity === 'positive',
        );
        fieldVector.x += chargeField.x;
        fieldVector.y += chargeField.y;
      });

      const magnitude = Math.sqrt(fieldVector.x ** 2 + fieldVector.y ** 2);
      maxFieldMagnitude = Math.max(maxFieldMagnitude, magnitude);
      if (magnitude > 0) {
        minFieldMagnitude = Math.min(minFieldMagnitude, magnitude);
      }
    }
  }

  // Draw the vectors with optimized settings
  for (let x = 0; x < app.screen.width; x += LARGER_SPACING) {
    for (let y = 0; y < app.screen.height; y += LARGER_SPACING) {
      const fieldVector = { x: 0, y: 0 };
      charges.forEach(charge => {
        const chargeField = calculateElectricField(
          charge.position,
          charge.magnitude,
          { x, y },
          charge.polarity === 'positive',
        );
        fieldVector.x += chargeField.x;
        fieldVector.y += chargeField.y;
      });

      const magnitude = Math.sqrt(fieldVector.x ** 2 + fieldVector.y ** 2);
      // Skip vectors with very small magnitudes during drag
      if (magnitude < minFieldMagnitude * 5) continue;

      const logMin = Math.log(minFieldMagnitude || 1e-10);
      const logMax = Math.log(maxFieldMagnitude);
      const logCurrent = Math.log(magnitude || 1e-10);
      const normalizedMagnitude = (logCurrent - logMin) / (logMax - logMin);
      const alpha = MIN_ALPHA + (MAX_ALPHA - MIN_ALPHA) * Math.pow(normalizedMagnitude, 1 / LOG_SCALE_FACTOR);
      const length = Math.min(magnitude * VECTOR_LENGTH_SCALE, MAX_VECTOR_LENGTH);

      // Draw field vector with simple style
      const arrow = new PIXI.Graphics();
      arrow.name = 'fieldVector';
      arrow.zIndex = 0;
      arrow.lineStyle(2, 0xffffff, alpha);
      arrow.moveTo(x, y);
      const endX = x + (fieldVector.x / magnitude) * length;
      const endY = y + (fieldVector.y / magnitude) * length;
      arrow.lineTo(endX, endY);
      app.stage.addChild(arrow);
    }
  }
}
</script>

<style scoped>
.canvas-container {
  flex-grow: 1;
  height: 100%;
  overflow: hidden;
}
</style>
