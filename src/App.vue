<script setup lang="ts">
  import PixiCanvas from './components/PixiCanvas.vue';
  import ControlBar from './components/ControlBar.vue';
  import { useChargesStore } from './stores/charges';
  import { computed } from 'vue';

  const chargesStore = useChargesStore();

  // Creating a key that will change whenever the mode or showForces state changes
  const controlBarKey = computed(() => `${chargesStore.mode}-${chargesStore.showForces}`);
</script>

<template>
   <div id="app">
    <PixiCanvas />
    <ControlBar :key="controlBarKey" />
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
    height: 100vh; /* Ensures full height of viewport */
    width: 100vw;  /* Ensures full width of viewport */
    overflow: hidden;
  }
</style>
