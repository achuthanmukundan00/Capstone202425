<template>
    <div ref="canvasContainer" style="width: 100%; height: 100%;" class="canvas-container"></div>
</template>

<script setup lang="ts">
    import { ref, onMounted, onBeforeUnmount } from 'vue';
    import * as PIXI from 'pixi.js';

    const canvasContainer = ref<HTMLElement | null>(null);
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

        // Draw a rectangle
        const rectangle = new PIXI.Graphics()
            .rect(200, 200, 150, 100)
            .fill({
                color: 0xdb1f48
            })
        app.stage.addChild(rectangle);

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
</script>

<style scoped>
  .canvas-container {
    flex-grow: 1;
    height: 100%; /* Ensures it takes full height */
    overflow: hidden;
  }
</style>
  