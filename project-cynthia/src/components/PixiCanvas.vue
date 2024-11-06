<template>
    <div ref="canvasContainer" style="width: 100%; height: 100%;" class="canvas-container"></div>
</template>

<script setup lang="ts">
    import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
    import * as PIXI from 'pixi.js';
    import type { Charge } from '@/stores/charges';
    import { useChargesStore } from '@/stores/charges';

    const canvasContainer = ref<HTMLElement | null>(null);
    const chargesStore = useChargesStore();
    const chargesGraphics = new Map<string, PIXI.Graphics>(); // Map to keep track of drawn charges

    let app: PIXI.Application | null = null;

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

        // Watch for changes in the charges array
        watch(
            () => chargesStore.charges,
            (newCharges) => {
                updateChargesOnCanvas(newCharges);
            },
            { deep: true, immediate: true }
        );

        // Someone else can try drawing a shape here and following the same technique.
    });

    onBeforeUnmount(() => {
        if (app) {
            app.destroy(true, { children: true });
            app = null;
        }
        window.removeEventListener('resize', resize);
    });

    const resize = () => {
        if (app) {
            app.renderer.resize(window.innerWidth, window.innerHeight);
        }
    };

    const drawCircle = () => {
        if (app) {
            const circle = new PIXI.Graphics()
                .circle(Math.random() * app.canvas.width, Math.random() * app.canvas.height, 25) // Center at (0,0) with radius 50
                .fill(0x01949a);

            // Add the circle to the stage
            app.stage.addChild(circle);
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
                .on('pointermove', () => {
                    if (graphic!.dragging) {
                        const newPosition = graphic!.data.getLocalPosition(graphic!.parent);
                        graphic!.position.set(newPosition.x, newPosition.y);
                    }
                });

        } else {
            // Clear the graphic to redraw
            graphic.clear();
        }

        // Set color based on polarity
        const color = charge.polarity === 'positive' ? 0xff0000 : 0x0000ff; // Red for positive, blue for negative

        // Draw the charge as a circle
        graphic.beginFill(color);
        graphic.drawCircle(0, 0, 20); // Draw at (0,0) because we'll set the position
        graphic.endFill();

        // Set position
        graphic.position.set(charge.position.x, charge.position.y);
    });
};
</script>

<style scoped>
  .canvas-container {
    flex-grow: 1;
    height: 100%; /* Ensures it takes full height */
    overflow: hidden;
  }
</style>
  