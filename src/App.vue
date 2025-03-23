<script setup lang="ts">
  import PixiCanvas from './components/PixiCanvas.vue';
  import ControlBar from './components/ControlBar.vue';
</script>

<template>
   <div id="app">
    <PixiCanvas />
    <ControlBar />
  </div>
</template>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
  @import url('https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic/web/OpenDyslexic.css');
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
