<template>
    <div class="controls-container">
    <!-- Add your controls here -->
    <div class="logo">
        Cynthia.EM
    </div>

    <div class="charge-container">
        Charge
        <form>
            <label for="q">Q:</label>
            <input type="text" id="q" name="q"><br>

            <label for="polarity">Polarity: </label>
            <input type="radio" id="positive" name="positive" value="positive">
            <label for="positive">+</label>
            <input type="radio" id="negative" name="negative" value="negative">
            <label for="negative">-</label><br>
            
            <button>Add charge</button>
        </form>
        
    </div>
  </div>
</template>

<style scoped>
  .controls-container {
    width: 300px;
    background-color: white;
    height: 100%; /* Ensures it takes full height */
    box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  }

  .logo {
    font-size: 30px;
    font-weight: 500;
    text-align: center;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .charge-container {
    font-size: 18px;
    padding: 8px;
  }

  .charge-container form {
    padding-top: 10px;
    padding: 15px;
    font-size: 14px;
  }

  .charge-container button {
    text-align: right;
  }
</style>