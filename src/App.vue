<script setup lang="ts">
import { ref } from 'vue';
import PixiCanvas from './components/PixiCanvas.vue';
import ControlBar from './components/ControlBar.vue';
import { useChargesStore } from './stores/charges';
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();
const drawerOpen = ref(true);

const controlBarRef = ref();

const chargesStore = useChargesStore();

// Creating a key that will change whenever the mode or showForces state changes
const controlBarKey = computed(() => `${chargesStore.mode}-${chargesStore.showForces}`);

function handleChargeOffScreen() {
  console.warn('Handling charge off-screen event. Stopping and resetting in 3 seconds.');

  setTimeout(() => {
    if (controlBarRef.value) {
      controlBarRef.value.stopAnimation();
      controlBarRef.value.resetAnimation();
      controlBarRef.value.highlightStartButton();
    }
  }, 3000);
}
</script>

<template>
  <div id="app" class="relative flex font-[Poppins] h-screen w-screen overflow-hidden"
    :class="{ 'dyslexia-font': settingsStore.dyslexiaMode }">
    <!-- Main canvas area -->
    <PixiCanvas @chargeOffScreen="handleChargeOffScreen" />


    <!-- Toggle Tab Button -->
    <button @click="drawerOpen = !drawerOpen" class="absolute z-30 right-0 top-1/2 -translate-y-1/2 translate-x-1/2
       w-10 h-12 bg-gray-900 hover:bg-gray-800 text-white shadow-lg
       rounded-l-full flex items-center justify-center transition-all duration-300
       cursor-pointer" aria-label="Toggle Control Panel">


      <!-- SHOW chevron-right when open -->
      <svg v-if="drawerOpen" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        class="lucide lucide-chevron-right">
        <path d="m9 18 6-6-6-6" />
      </svg>
      <!-- SHOW chevron-left when closed -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        class="lucide lucide-chevron-left">
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>

    <!-- ControlBar Drawer -->
    <transition name="slide">
      <div v-show="drawerOpen"
        class="w-[320px] h-full bg-white shadow-lg z-10 transition-transform duration-300 ease-in-out">
        <ControlBar :key="controlBarKey" ref="controlBarRef" />
      </div>
    </transition>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

html {
  overscroll-behavior: none;
}

html,
body {
  overflow-x: hidden;
  /* Prevent horizontal scrolling */
  overflow-y: auto;
  /* Allow vertical scrolling */
  height: 100%;
  margin: 0;
  -webkit-overflow-scrolling: touch;
  /* Smooth scrolling on iOS */
}

#app {
  display: flex;
  font-family: 'Poppins', sans-serif;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: relative;
}

/* Dyslexia mode */
@font-face {
  font-family: 'OpenDyslexic';
  src: url('/fonts/OpenDyslexic-Regular.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}

#app.dyslexia-font {
  font-family: 'OpenDyslexic', sans-serif;
}

body.dyslexia-font,
body.dyslexia-font * {
  font-family: 'OpenDyslexic', sans-serif !important;
}

body.dark-mode {
  background-color: #121212;
  color: #eee;
}

body.dark-mode .controls-container {
  background-color: #1e1e1e;
  color: #eee;
}

body.dark-mode .settings-modal {
  background-color: #1e1e1e;
  color: #eee;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease-in-out;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(100%);
}
</style>
