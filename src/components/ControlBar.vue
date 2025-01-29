<template>
  <div class="controls-container">
    <div class="logo">
      Cynthia.EM
    </div>

    <div class="mode-toggle">
      <label>Mode:</label>
      <div class="toggle-buttons">
        <button
          :class="['mode-button', { active: mode === 'electric' }]"
          @click="setMode('electric')"
        >
          Electric
        </button>
        <button
          :class="['mode-button', { active: mode === 'magnetic' }]"
          @click="setMode('magnetic')"
        >
          Magnetic
        </button>
      </div>
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

      <template v-if="mode === 'magnetic'">
        <div class="form-group">
          <label>Velocity:</label>
          <div class="velocity-inputs">
            <div class="velocity-input">
              <label>Magnitude:</label>
              <input
                type="number"
                v-model="velocityMagnitude"
                :disabled="isEditing && !selectedChargeExists"
                min="0"
                step="0.1"
                class="input-field"
                placeholder="Speed"
              />
            </div>
          </div>
          <div class="velocity-direction">
            <label>Direction:</label>
            <div class="direction-inputs">
              <div class="direction-input">
                <label>X:</label>
                <input
                  type="number"
                  v-model="velocityDirectionX"
                  :disabled="isEditing && !selectedChargeExists"
                  step="0.1"
                  min="-1"
                  max="1"
                  class="input-field"
                  placeholder="-1 to 1"
                />
              </div>
              <div class="direction-input">
                <label>Y:</label>
                <input
                  type="number"
                  v-model="velocityDirectionY"
                  :disabled="isEditing && !selectedChargeExists"
                  step="0.1"
                  min="-1"
                  max="1"
                  class="input-field"
                  placeholder="-1 to 1"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="magField">Uniform Magnetic Field (T):</label>
          <input
            type="number"
            id="magField"
            v-model="magneticFieldValue"
            step="0.1"
            class="input-field"
            placeholder="e.g. 1.0 (Tesla)"
          />
        </div>

        <div class="form-group">
          <label>Magnetic Field Direction:</label>
          <button @click="toggleMagneticFieldDirection" class="direction-toggle">
            {{ magneticFieldDirection === 'out' ? '⬆ Out of Page' : '⬇ Into Page' }}
          </button>
        </div>
      </template>

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
import { useChargesStore, type SimulationMode } from '@/stores/charges';

const chargesStore = useChargesStore();

// Form state
const chargeValue = ref<string>('');
const polarity = ref<'positive' | 'negative'>('positive');

// Add velocity refs
const velocityMagnitude = ref('0');
const velocityDirectionX = ref('0');
const velocityDirectionY = ref('0');

// Add computed for current mode
const mode = computed(() => chargesStore.mode);

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
      velocityMagnitude.value = selectedCharge.velocity.magnitude.toString();
      velocityDirectionX.value = selectedCharge.velocity.direction.x.toString();
      velocityDirectionY.value = selectedCharge.velocity.direction.y.toString();
    }
  } else {
    resetForm();
  }
});

// Magnetic Field State
const magneticFieldValue = ref('0');
const magneticFieldDirection = ref<'in' | 'out'>('out'); // Default: Out of the page

// Watch for Magnetic Field Changes
watch([magneticFieldValue, magneticFieldDirection], ([newValue, newDirection]) => {
  const parsed = parseFloat(newValue) || 0;
  const zComponent = newDirection === 'out' ? parsed : -parsed;
  chargesStore.setMagneticField({ x: 0, y: 0, z: zComponent });
});

// Function to Toggle Magnetic Field Direction
const toggleMagneticFieldDirection = () => {
  magneticFieldDirection.value = magneticFieldDirection.value === 'out' ? 'in' : 'out';
};

// Handlers
const handleAddCharge = () => {
  if (!isValid.value) return;

  // Normalize direction vector
  const dirX = Number(velocityDirectionX.value);
  const dirY = Number(velocityDirectionY.value);
  const length = Math.sqrt(dirX * dirX + dirY * dirY) || 1;

  chargesStore.addCharge({
    magnitude: Number(chargeValue.value),
    polarity: polarity.value,
    velocity: {
      magnitude: Number(velocityMagnitude.value),
      direction: {
        x: dirX / length,
        y: dirY / length
      }
    }
  });

  resetForm();
};

const handleEditCharge = () => {
  if (!isValid.value || !selectedChargeExists.value) return;

  const dirX = Number(velocityDirectionX.value);
  const dirY = Number(velocityDirectionY.value);
  const length = Math.sqrt(dirX * dirX + dirY * dirY) || 1;

  chargesStore.updateCharge({
    id: chargesStore.selectedChargeId!,
    magnitude: Number(chargeValue.value),
    polarity: polarity.value,
    velocity: {
      magnitude: Number(velocityMagnitude.value),
      direction: {
        x: dirX / length,
        y: dirY / length
      }
    }
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
  velocityMagnitude.value = '0';
  velocityDirectionX.value = '0';
  velocityDirectionY.value = '0';
};

// Add mode setter
const setMode = (newMode: SimulationMode) => {
  chargesStore.setMode(newMode);
};
</script>

<style scoped>
.controls-container {
  width: 300px;
  min-width: 300px;
  background-color: #f5f5f5;
  height: 100vh;
  padding: 20px;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  overflow-x: hidden;
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
  width: 100%;
  box-sizing: border-box;
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

.mode-toggle {
  margin-bottom: 20px;
}

.toggle-buttons {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.mode-button {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f5f5f5;
  cursor: pointer;
}

.mode-button.active {
  background: #3498db;
  color: white;
  border-color: #2980b9;
}

.velocity-inputs {
  display: flex;
  gap: 8px;
  width: 100%;
}

.velocity-input {
  flex: 1;
  min-width: 0;
}

.velocity-input input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.velocity-input label {
  font-size: 0.9em;
  color: #666;
}

.velocity-direction {
  margin-top: 10px;
}

.direction-inputs {
  display: flex;
  gap: 8px;
  width: 100%;
}

.direction-input {
  flex: 1;
  min-width: 0;
}

.direction-input label {
  font-size: 0.9em;
  color: #666;
}
</style>
