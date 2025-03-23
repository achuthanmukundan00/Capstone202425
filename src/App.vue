<script setup lang="ts">
import PixiCanvas from './components/PixiCanvas.vue';
import ControlBar from './components/ControlBar.vue';
import { useSettingsStore } from '@/stores/settings';
const settingsStore = useSettingsStore();
</script>

<template>
  <div id="app" :class="{ 'dyslexia-font': settingsStore.dyslexiaMode }">
    <PixiCanvas />
    <ControlBar />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

body {
  margin: 0;
}

#app {
  display: flex;
  font-family: 'Poppins', sans-serif;
  height: 100vh;
  /* Ensures full height of viewport */
  width: 100vw;
  /* Ensures full width of viewport */
  overflow: hidden;
}

@font-face {
  font-family: 'OpenDyslexic';
  src: url('/fonts/OpenDyslexic-Regular.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}

#app.dyslexia-font {
  font-family: 'OpenDyslexic', sans-serif;
}
</style>
