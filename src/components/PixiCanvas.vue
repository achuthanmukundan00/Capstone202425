<template>
  <div ref="canvasContainer" style="width: 100%; height: 100%;" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as PIXI from 'pixi.js';
import type { Charge } from '@/stores/charges';
import { useChargesStore } from '@/stores/charges';
import { drawElectricField, drawMagneticField, drawMagneticForcesOnAllCharges, drawVelocityOnAllCharges, removeFields } from '@/utils/drawingUtils';
import { calculateMagneticForce } from '@/utils/mathUtils';
import { ANIMATION_SPEED, FORCE_SCALING } from '@/consts';
import { getNetElectricFieldAtPoint } from '@/utils/mathUtils'

const canvasRef = ref<HTMLDivElement | null>(null);
const fieldReadout = ref('');
const canvasContainer = ref<HTMLElement | null>(null);
const chargesStore = useChargesStore();
const chargesGraphics = new Map<string, PIXI.Graphics>(); // Map to keep track of drawn charges

let animationFrameId: number;
let app: PIXI.Application | null = null;

const MOVEMENT_STEP = 10; // pixels per keypress

function handleMouseMove(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const field = getNetElectricFieldAtPoint({ x, y })

  fieldReadout.value = `Ex: ${field.x.toFixed(2)}, Ey: ${field.y.toFixed(2)}`
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

  canvasRef.value?.addEventListener('mousemove', handleMouseMove);

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
        const newPosition = event.data.getLocalPosition(graphic.parent);
        graphic.position.set(newPosition.x, newPosition.y);
        chargesStore.updateChargePosition(charge.id, { x: newPosition.x, y: newPosition.y });
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
  });

  app.stage.on('pointerdown', (event) => {
    if (event.target === app?.stage) {
      chargesStore.setSelectedCharge(null);
    }
  });

  // Watch for changes in the charges array
  watch(
    () => chargesStore.charges,
    (newCharges) => {
      if (chargesStore.mode === 'electric') {
        removeFields(app!);
        drawElectricField(app!, newCharges);
      } else {
        removeFields(app!);
        drawMagneticField(app!, chargesStore.magneticField);
        drawMagneticForcesOnAllCharges(app!, chargesStore);
        drawVelocityOnAllCharges(app!, chargesStore);
      }
      updateChargesOnCanvas(newCharges);
    },
    { deep: true, immediate: true }
  );

  // Watch for mode and magnetic field changes (code omitted for brevity)
  watch(
    () => chargesStore.mode,
    (newMode) => {
      if (!app) return;
      app.stage.children
        .filter(child => child.name === 'fieldVector' || child.name.startsWith('magneticForceVector-') || child.name.startsWith('velocityVector-'))
        .forEach(child => app!.stage.removeChild(child));

      if (newMode === 'electric') {
        removeFields(app!);
        drawElectricField(app, chargesStore.charges);
      } else {
        removeFields(app!);
        drawMagneticField(app!, chargesStore.magneticField);
        drawMagneticForcesOnAllCharges(app!, chargesStore);
        drawVelocityOnAllCharges(app!, chargesStore);
      }
    }
  );

  watch(
    () => chargesStore.magneticField,
    () => {
      if (chargesStore.mode === 'magnetic') {
        removeFields(app!);
        drawMagneticField(app!, chargesStore.magneticField)
        drawMagneticForcesOnAllCharges(app!, chargesStore);
        drawVelocityOnAllCharges(app!, chargesStore);
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
  canvasRef.value?.removeEventListener('mousemove', handleMouseMove);
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
      removeFields(app!);
      drawElectricField(app, chargesStore.charges);
    } else {
      removeFields(app!);
      drawMagneticField(app!, chargesStore.magneticField)
      drawMagneticForcesOnAllCharges(app!, chargesStore);
      drawVelocityOnAllCharges(app!, chargesStore);
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
</script>

<style scoped>
.canvas-container {
  flex-grow: 1;
  height: 100%;
  overflow: hidden;
}
</style>
