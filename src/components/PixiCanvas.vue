<template>
  <div ref="canvasContainer" style="width: 100%; height: 100%;" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as PIXI from 'pixi.js';
import type { Charge } from '@/stores/charges';
import { useChargesStore} from '@/stores/charges';
import { drawElectricField, drawMagneticField } from '@/utils/drawingUtils';

const canvasContainer = ref<HTMLElement | null>(null);
const chargesStore = useChargesStore();
const chargesGraphics = new Map<string, PIXI.Graphics>(); // Map to keep track of drawn charges

let app: PIXI.Application | null = null;

const MOVEMENT_STEP = 10; // pixels per keypress

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    event.preventDefault(); // Prevent default tab behavior

    const charges = chargesStore.charges;
    if (charges.length === 0) return;

    if (!chargesStore.selectedChargeId) {
      // If no charge is selected, select the first one
      chargesStore.setSelectedCharge(charges[0].id);
    } else {
      // Find current charge index
      const currentIndex = charges.findIndex(c => c.id === chargesStore.selectedChargeId);

      // Calculate next index (with wraparound)
      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + charges.length) % charges.length // Shift+Tab goes backwards
        : (currentIndex + 1) % charges.length;                 // Tab goes forwards

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

onMounted(async () => {
  // Initialize PixiJS Application
  app = new PIXI.Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Append the canvas to the container
  if (canvasContainer.value && app.canvas) {
    canvasContainer.value.appendChild(app.canvas);
  }

  // Prevent the page from scrolling
  //app.canvas.style.position = 'absolute';

  // Resize the canvas if the window is resized
  window.addEventListener('resize', resize);

  // Add click handler to the stage for deselection
  app.stage.interactive = true;
  app.stage.hitArea = app.screen;

  // Global pointermove event
  app.stage.on('pointermove', (event) => {
    chargesStore.charges.forEach((charge) => {
      const graphic = chargesGraphics.get(charge.id);
      if (graphic && graphic.dragging) {
        const newPosition = event.data.getLocalPosition(graphic.parent);
        graphic.position.set(newPosition.x, newPosition.y);

        // Update the charge position in the store
        chargesStore.updateChargePosition(charge.id, { x: newPosition.x, y: newPosition.y });
      }
    });
  });

  // Ensure pointerup events are handled globally
  app.stage.on('pointerup', () => {
    chargesStore.charges.forEach((charge) => {
      const graphic = chargesGraphics.get(charge.id);
      if (graphic) {
        graphic.dragging = false;
        graphic.data = null;
        graphic.alpha = 1; // Reset appearance
      }
    });
  });

  app.stage.on('pointerdown', (event) => {
    // Only deselect if clicking directly on the stage (not on a charge)
    if (event.target === app?.stage) {
      chargesStore.setSelectedCharge(null);
    }
  });

  // Watch for changes in the charges array
  watch(
    () => chargesStore.charges,
    (newCharges) => {
      // Only draw electric field if in electric mode
      if (chargesStore.mode === 'electric') {
        drawElectricField(app!, newCharges);
      } else {
        drawMagneticField(app!, chargesStore.magneticField)
      }
      updateChargesOnCanvas(newCharges);
    },
    { deep: true, immediate: true }
  );

  // Watch for mode changes
  watch(
    () => chargesStore.mode,
    (newMode) => {
      if (!app) return;

      // Clear existing field visualization
      app.stage.children
        .filter(child => child.name === 'fieldVector' || child.name.startsWith('magneticForceVector-'))
        .forEach(child => app!.stage.removeChild(child));

      // Only redraw electric field in electric mode
      if (newMode === 'electric') {
        drawElectricField(app, chargesStore.charges);
      } else {
        drawMagneticField(app!, chargesStore.magneticField)
      }
      // We'll implement magnetic field visualization later
    }
  );

  // Watch for changes in the magnetic field
  watch(
    () => chargesStore.magneticField,
    () => {
      // Only draw electric field if in electric mode
      if (chargesStore.mode === 'magnetic') {
        drawMagneticField(app!, chargesStore.magneticField)
      }
    },
    { deep: true, immediate: true }
  );

  // Add keyboard event listener
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
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
    // Only draw electric field if in electric mode
    if (chargesStore.mode === 'electric') {
      drawElectricField(app, chargesStore.charges);
    } else {
        drawMagneticField(app!, chargesStore.magneticField)
      }
    updateChargesOnCanvas(chargesStore.charges)
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
      // Create a new graphic if it doesn't exist
      graphic = new PIXI.Graphics();
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
        })
    } else {
      // Clear the graphic to redraw
      graphic.clear();
    }

    // Set color based on polarity
    const color = charge.polarity === 'positive' ? 0xff0000 : 0x0000ff; // Red for positive, blue for negative
    const polarity = charge.polarity === 'positive' ? "+" : "-";


    // Draw the normal circle
    graphic.beginFill(color);       // Set the fill color
    graphic.lineStyle(0);           // Ensure no border
    graphic.drawCircle(0, 0, 20);   // Draw normal circle
    graphic.endFill();              // End the fill


    // Set position based on the store data, so it persists even after adding a new charge
    graphic.position.set(charge.position.x, charge.position.y);

    // Create or update the text label for the charge magnitude
    let text = graphic.getChildByName('chargeLabel') as PIXI.Text;
    if (!text) {
      text = new PIXI.Text(polarity + charge.magnitude.toString() + 'C', {
        fontSize: 14,
        fill: 0xffffff, // White text color for visibility
        align: 'center'
      });
      text.name = 'chargeLabel';
      graphic.addChild(text);
    } else {
      // Update the text if the magnitude has changed
      text.text = polarity + charge.magnitude.toString() + 'C';
    }

    // Center the text within the circle
    text.anchor.set(0.5); // Centers the text
    text.position.set(0, 0); // Position text at the center of the circle
  });
};


</script>

<style scoped>
.canvas-container {
  flex-grow: 1;
  height: 100%;
  /* Ensures it takes full height */
  overflow: hidden;
}
</style>
