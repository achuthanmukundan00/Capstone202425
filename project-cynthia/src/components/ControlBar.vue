<template>
  <div class="controls-container">
    <!-- Application logo -->
    <div class="logo">
      Cynthia.EM
    </div>

    <!-- Charge creation form container -->
    <div class="charge-container">
      <h2 class="section-title">Add Charge</h2>
      <!-- Form with prevent default to handle submission -->
      <form @submit.prevent="handleAddCharge">
        <!-- Magnitude input field -->
        <div class="form-group">
          <label for="q">Magnitude (Q):</label>
          <input 
            type="number" 
            id="q" 
            v-model="chargeValue"
            min="0"
            step="0.1"
            class="input-field"
            placeholder="Enter charge magnitude"
          >
        </div>

        <!-- Polarity selection radio buttons -->
        <div class="form-group">
          <label class="polarity-label">Polarity:</label>
          <div class="polarity-options">
            <!-- Positive charge option -->
            <label class="radio-label">
              <input 
                type="radio" 
                v-model="polarity" 
                value="positive"
                name="polarity"
              >
              <span class="radio-text positive">+</span>
            </label>
            <!-- Negative charge option -->
            <label class="radio-label">
              <input 
                type="radio" 
                v-model="polarity" 
                value="negative"
                name="polarity"
              >
              <span class="radio-text negative">−</span>
            </label>
          </div>
        </div>
        
        <!-- Submit button - disabled when form is invalid -->
        <button type="submit" class="submit-button" :disabled="!isValid">
          Add Charge
        </button>
      </form>
    </div>

    <!-- Debug section to show current charges in store -->
    <div class="debug-section">
      <h3>Debug: Charges in Store</h3>
      <pre>{{ chargesStore.charges }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useChargesStore } from '@/stores/charges';

// Initialize the charges store
const chargesStore = useChargesStore();

// Form state management
const chargeValue = ref<string>(''); // Stores the magnitude input value
const polarity = ref<'positive' | 'negative'>('positive'); // Stores selected polarity

// Computed property to check if form input is valid
const isValid = computed(() => {
  return chargeValue.value !== '' && !isNaN(Number(chargeValue.value));
});

// Handler for form submission
const handleAddCharge = () => {
  if (!isValid.value) return; // Guard clause for invalid input
  
  // Add new charge to store
  chargesStore.addCharge({
    magnitude: Number(chargeValue.value),
    polarity: polarity.value
  });
  
  // Reset form after submission
  chargeValue.value = '';
};
</script>

<style scoped>
/* Container for the entire control panel */
.controls-container {
  width: 300px;
  background-color: white;
  height: 100%;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

/* Logo styling */
.logo {
  font-size: 30px;
  font-weight: 500;
  text-align: center;
  padding: 20px 0;
  border-bottom: 1px solid #eee;
}

/* Charge form container styling */
.charge-container {
  padding: 20px;
}

/* Section title styling */
.section-title {
  font-size: 20px;
  font-weight: 500;
  margin: 0 0 20px 0;
  color: #333;
}

/* Form group styling for input sections */
.form-group {
  margin-bottom: 16px;
}

/* Label styling for form inputs */
.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-size: 14px;
}

/* Input field styling */
.input-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
}

/* Input field focus state */
.input-field:focus {
  border-color: #4a90e2;
  outline: none;
}

/* Polarity label styling */
.polarity-label {
  margin-bottom: 8px;
  display: block;
  color: #555;
  font-size: 14px;
}

/* Container for polarity radio buttons */
.polarity-options {
  display: flex;
  gap: 20px;
}

/* Radio button label styling */
.radio-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

/* Radio input styling */
.radio-label input {
  margin-right: 8px;
}

/* Polarity indicator text styling */
.radio-text {
  font-size: 18px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 4px;
}

/* Positive charge indicator color */
.radio-text.positive {
  color: #2ecc71;
}

/* Negative charge indicator color */
.radio-text.negative {
  color: #e74c3c;
}

/* Submit button styling */
.submit-button {
  width: 100%;
  padding: 10px;
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

/* Submit button hover state */
.submit-button:hover:not(:disabled) {
  background-color: #357abd;
}

/* Submit button disabled state */
.submit-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* Debug section styling */
.debug-section {
  padding: 20px;
  border-top: 1px solid #eee;
  font-size: 12px;
}

/* Debug output styling */
.debug-section pre {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>