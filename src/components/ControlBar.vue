<template>
  <div class="controls-container">
    <div class="logo">
      Cynthia.EM
    </div>

    <div class="charge-form">
      <div class="form-group">
        <label for="magnitude">Magnitude (C):</label>
        <input
          type="number"
          id="magnitude"
          v-model="chargeValue"
          :disabled="isEditing && !selectedChargeExists"
          placeholder="Enter magnitude"
          min="0"
          step="0.1"
          class="input-field"
        />
      </div>

      <div class="form-group">
        <label>Polarity:</label>
        <div class="polarity-controls">
          <label>
            <input
              type="radio"
              v-model="polarity"
              value="positive"
              :disabled="isEditing && !selectedChargeExists"
            />
            Positive (+)
          </label>
          <label>
            <input
              type="radio"
              v-model="polarity"
              value="negative"
              :disabled="isEditing && !selectedChargeExists"
            />
            Negative (-)
          </label>
        </div>
      </div>

      <div class="button-group">
        <!-- Add Button -->
        <button
          class="action-button add-button"
          :disabled="!isValid || selectedChargeExists"
          :class="{ 'active': !selectedChargeExists }"
          @click="handleAddCharge"
        >
          Add Charge
        </button>

        <!-- Edit Button -->
        <button
          class="action-button edit-button"
          :disabled="!isValid || !selectedChargeExists"
          @click="handleEditCharge"
        >
          Edit Charge
        </button>

        <!-- Delete Button -->
        <button
          class="action-button delete-button"
          :disabled="!selectedChargeExists"
          @click="handleDeleteCharge"
        >
          Delete Charge
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useChargesStore } from '@/stores/charges';

const chargesStore = useChargesStore();

// Form state
const chargeValue = ref<string>('');
const polarity = ref<'positive' | 'negative'>('positive');

// Computed properties
const isValid = computed(() => {
  return chargeValue.value !== '' && !isNaN(Number(chargeValue.value));
});

const selectedChargeExists = computed(() => {
  return chargesStore.selectedChargeId !== null;
});

const isEditing = computed(() => {
  return selectedChargeExists.value;
});

// Watch for selected charge to populate form
watch(() => chargesStore.selectedChargeId, (newId) => {
  if (newId) {
    const selectedCharge = chargesStore.charges.find(c => c.id === newId);
    if (selectedCharge) {
      chargeValue.value = selectedCharge.magnitude.toString();
      polarity.value = selectedCharge.polarity;
    }
  } else {
    resetForm();
  }
});

// Handlers
const handleAddCharge = () => {
  if (!isValid.value || selectedChargeExists.value) return;

  chargesStore.addCharge({
    magnitude: Number(chargeValue.value),
    polarity: polarity.value,
    velocity: {x: 0, y: 0, z: 0},
  });

  resetForm();
};

const handleEditCharge = () => {
  if (!isValid.value || !selectedChargeExists.value) return;

  chargesStore.updateCharge({
    id: chargesStore.selectedChargeId!,
    magnitude: Number(chargeValue.value),
    polarity: polarity.value
  });

  chargesStore.setSelectedCharge(null);
  resetForm();
};

const handleDeleteCharge = () => {
  if (!selectedChargeExists.value) return;

  chargesStore.removeCharge(chargesStore.selectedChargeId!);
  chargesStore.setSelectedCharge(null);
  resetForm();
};

const resetForm = () => {
  chargeValue.value = '';
  polarity.value = 'positive';
};
</script>

<style scoped>
.controls-container {
  width: 300px;
  background-color: #f5f5f5;
  height: 100vh;
  padding: 20px;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
}

.logo {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 30px;
  color: #2c3e50;
}

.charge-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-field {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.polarity-controls {
  display: flex;
  gap: 20px;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.action-button {
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.action-button:disabled {
  background-color: #bdc3c7;
  color: #7f8c8d;
  opacity: 0.5;
  cursor: not-allowed;
}

.add-button {
  background-color: #2ecc71;
  color: white;
}

.add-button.active {
  background-color: #2ecc71;
}

.add-button:disabled {
  background-color: #bdc3c7;
  color: #7f8c8d;
}

.add-button:hover:not(:disabled) {
  background-color: #27ae60;
}

.edit-button {
  background-color: #3498db;
  color: white;
}

.edit-button:hover:not(:disabled) {
  background-color: #2980b9;
}

.delete-button {
  background-color: #e74c3c;
  color: white;
}

.delete-button:hover:not(:disabled) {
  background-color: #c0392b;
}
</style>
