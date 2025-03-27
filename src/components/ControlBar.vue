<template>
  <div class="controls-container">
    <div class="header-bar">
      <div class="logo">Cynthia.EM</div>
      <button class="outlined-icon-button" @click="isSettingsModalOpen = true" title="Settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          class="lucide lucide-cog">
          <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
          <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
          <path d="M12 2v2" />
          <path d="M12 22v-2" />
          <path d="m17 20.66-1-1.73" />
          <path d="M11 10.27 7 3.34" />
          <path d="m20.66 17-1.73-1" />
          <path d="m3.34 7 1.73 1" />
          <path d="M14 12h8" />
          <path d="M2 12h2" />
          <path d="m20.66 7-1.73 1" />
          <path d="m3.34 17 1.73-1" />
          <path d="m17 3.34-1 1.73" />
          <path d="m11 13.73-4 6.93" />
        </svg>
        <span class="settings-label">Settings</span>
      </button>
    </div>



    <div class="mode-toggle">
      <label>Mode:</label>
      <div class="toggle-buttons">
        <button :class="['mode-button', { active: mode === 'electric' }]" @click="setMode('electric')">
          Electric
        </button>
        <button :class="['mode-button', { active: mode === 'magnetic' }]" @click="setMode('magnetic')">
          Magnetic
        </button>
      </div>
    </div>

    <div class="charge-form">
      <div v-if="selectedChargeExists" class="selection-controls">
        <span class="selection-label">Editing Charge</span>
        <button class="close-button" @click="handleDeselect" title="Exit edit mode">
          ×
        </button>
      </div>

      <div v-if="selectedChargeExists" class="edit-mode-indicator">
        Changes are applied in real-time
      </div>

      <RangeSlider v-model="chargeValueNum" :min="CHARGE_MAGNITUDE_BOUNDS.MIN" :max="CHARGE_MAGNITUDE_BOUNDS.MAX"
        :step="CHARGE_MAGNITUDE_BOUNDS.STEP" label="Charge Magnitude" unit="C" :precision="1" />

      <!-- <template v-if="mode === 'electric'">
        <div class="form-group">
          <button @click="toggleForceVisibility" class="action-button force-toggle">
            {{ chargesStore.showForces ? 'Hide Forces' : 'Show Forces' }}
          </button>
        </div>
      </template> -->

      <template v-if="mode === 'magnetic'">
        <RangeSlider v-model="magneticFieldValueNum" :min="MAGNETIC_FIELD_BOUNDS.MIN" :max="MAGNETIC_FIELD_BOUNDS.MAX"
          :step="MAGNETIC_FIELD_BOUNDS.STEP" label="Magnetic Field Strength" unit="T" :precision="1" />

        <RangeSlider v-model="velocityMagnitudeNum" :min="VELOCITY_BOUNDS.MIN" :max="VELOCITY_BOUNDS.MAX"
          :step="VELOCITY_BOUNDS.STEP" label="Velocity" unit="m/s" :precision="0" />

        <div class="button-group">
          <button class="action-button start-button" :class="{ active: animationMode === AnimationMode.start }"
            @click="startAnimation"
            :disabled="!(animationMode === AnimationMode.stop || animationMode === AnimationMode.reset)">
            Start Animation
          </button>

          <button class="action-button stop-button" :class="{ active: animationMode === AnimationMode.stop }"
            @click="stopAnimation" :disabled="animationMode !== AnimationMode.start">
            Stop Animation
          </button>

          <button class="action-button reset-button" :class="{ active: animationMode === AnimationMode.reset }"
            @click="resetAnimation" :disabled="animationMode !== AnimationMode.stop">
            Reset Animation
          </button>
        </div>
        <div class="form-group">
          <label>Velocity:</label>
          <div class="velocity-inputs">
            <div class="velocity-input">
              <label>Magnitude:</label>
              <input type="number" v-model="velocityMagnitude" min="0" step="0.1" class="input-field"
                placeholder="Speed" @focus="checkChargeSelected" />
            </div>
          </div>
          <div class="velocity-direction">
            <label>Direction:</label>
            <div class="direction-inputs">
              <div class="direction-input">
                <label>X:</label>
                <input type="number" v-model="velocityDirectionX" step="0.1" min="-1" max="1" class="input-field"
                  placeholder="-1 to 1" @focus="checkChargeSelected" />
              </div>
              <div class="direction-input">
                <label>Y:</label>
                <input type="number" v-model="velocityDirectionY" step="0.1" min="-1" max="1" class="input-field"
                  placeholder="-1 to 1" @focus="checkChargeSelected" />
              </div>
            </div>
          </div>
          <div v-if="velocityInputError" class="error-message">
            {{ velocityInputError }}
          </div>
        </div>

        <div class="form-group">
          <label for="magField">Uniform Magnetic Field (T):</label>
          <input type="number" id="magField" v-model="magneticFieldValueNum" step="0.1" class="input-field"
            placeholder="e.g. 1.0 (Tesla)" />
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
            <input type="radio" v-model="polarity" value="positive" />
            Positive (+)
          </label>
          <label>
            <input type="radio" v-model="polarity" value="negative" />
            Negative (-)
          </label>
        </div>
      </div>

      <div class="button-group">
        <!-- Add Button -->
        <button class="action-button add-button" :disabled="!isValid || selectedChargeExists"
          :class="{ 'active': !selectedChargeExists }" @click="handleAddCharge">
          Add Charge
        </button>

        <!-- Delete Button -->
        <button class="action-button delete-button" :disabled="!selectedChargeExists" @click="handleDeleteCharge">
          Delete Charge
        </button>

        <!-- Force Toggle Button - only in electric mode -->
        <button v-if="mode === 'electric'" class="action-button force-toggle" @click="toggleForceVisibility">
          {{ chargesStore.showForces ? 'Hide Forces' : 'Show Forces' }}
        </button>

      </div>
    </div>
  </div>

  <template v-if="isSettingsModalOpen">
    <div class="settings-modal-overlay" @click.self="isSettingsModalOpen = false">
      <div class="settings-modal">
        <button class="close-modal" @click="isSettingsModalOpen = false">×</button>
        <h2>Settings</h2>

        <div class="setting-section">
          <label for="colorblind-mode">Colorblind Mode:</label>
          <select id="colorblind-mode" v-model="settingsStore.colorblindMode"
            @change="settingsStore.setColorblindMode(settingsStore.colorblindMode)">
            <option v-for="mode in colorblindModes" :key="mode" :value="mode">
              {{ mode.charAt(0).toUpperCase() + mode.slice(1) }}
            </option>
          </select>
        </div>

        <div class="setting-section toggles">
          <div class="toggle-row">
            <span>Dyslexia-Friendly Font</span>

            <label class="toggle-switch">
              <input class="switch-input" type="checkbox" :checked="settingsStore.dyslexiaMode" @change="toggleDyslexiaFont" />
              <span class="switch-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <span>Dark Mode</span>
            <label class="toggle-switch">
              <input class="switch-input" type="checkbox" :checked="isDarkMode" @change="toggleDarkMode" />
              <span class="switch-slider"></span>
            </label>

          </div>

        </div>

        <p class="modal-credit">
          Designed in 2025 by Achu Mukundan, Mehdi Essoussi, Justin Chang and Son Phatpanichot at The University of
          Toronto.
        </p>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { AnimationMode, useChargesStore, type SimulationMode } from '@/stores/charges';
import RangeSlider from './ui/RangeSlider.vue';
import { CHARGE_MAGNITUDE_BOUNDS, MAGNETIC_FIELD_BOUNDS, VELOCITY_BOUNDS } from '@/consts';
import { useSettingsStore } from '@/stores/settings'

const chargesStore = useChargesStore();
const velocityInputError = ref('');
const isSettingsModalOpen = ref(false);
const isDarkMode = ref(false); // or pull this from your settings store if global

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  document.body.classList.toggle('dark-mode', isDarkMode.value);
};

const toggleDyslexiaFont = () => {
  settingsStore.setDyslexiaMode(!settingsStore.dyslexiaMode);
};

const startAnimation = () => {
  if (animationMode.value === AnimationMode.stop || animationMode.value === AnimationMode.reset) {
    chargesStore.startAnimation();
    animationMode.value = AnimationMode.start;
  }
};

const stopAnimation = () => {
  if (animationMode.value === AnimationMode.start) {
    chargesStore.stopAnimation();
    animationMode.value = AnimationMode.stop;
  }
};

const resetAnimation = () => {
  if (animationMode.value === AnimationMode.stop) {
    chargesStore.resetAnimation();
    animationMode.value = AnimationMode.reset;
  }
};

const checkChargeSelected = (event: FocusEvent) => {
  if (!selectedChargeExists.value) {
    velocityInputError.value = 'Please select a charge first.';
    (event.target as HTMLInputElement).blur();
  } else {
    velocityInputError.value = '';
  }
};

// Form state
const chargeValue = ref('0');
const polarity = ref<'positive' | 'negative'>('positive');
const velocityMagnitude = ref('0');
const velocityDirectionX = ref('0');
const velocityDirectionY = ref('0');
const animationMode = ref<AnimationMode>(AnimationMode.stop);


// Add computed for current mode
const mode = computed(() => chargesStore.mode);

// Computed properties
const isValid = computed(() => {
  return chargeValue.value !== '' && !isNaN(Number(chargeValue.value));
});

const selectedChargeExists = computed(() => {
  return chargesStore.selectedChargeId !== null;
});

watch(selectedChargeExists, (newVal) => {
  if (newVal) {
    const selectedCharge = chargesStore.charges.find(c => c.id === chargesStore.selectedChargeId);
    if (selectedCharge) {
      chargeValue.value = selectedCharge.magnitude.toString();
      polarity.value = selectedCharge.polarity;
      // Only update velocity inputs if they differ from the charge's current values
      if (velocityMagnitude.value !== selectedCharge.velocity.magnitude.toString()) {
        velocityMagnitude.value = selectedCharge.velocity.magnitude.toString();
      }
      velocityDirectionX.value = selectedCharge.rawDirection?.x?.toString() || selectedCharge.velocity.direction.x.toString();
      velocityDirectionY.value = selectedCharge.rawDirection?.y?.toString() || selectedCharge.velocity.direction.y.toString();      
    }
    velocityInputError.value = '';
  } else {
    resetForm();
  }
});

watch([velocityMagnitude, velocityDirectionX, velocityDirectionY], () => {
  if (!chargesStore.selectedChargeId) return;

  const chargeId = chargesStore.selectedChargeId;
  const charge = chargesStore.charges.find(c => c.id === chargeId);
  if (!charge) return;

  // Parse and validate inputs
  const dirX = parseFloat(velocityDirectionX.value) || 0;
  const dirY = parseFloat(velocityDirectionY.value) || 0;
  const magnitude = parseFloat(velocityMagnitude.value) || 0;

  // Compare with the existing charge values
  const existingDirX = charge.velocity.direction.x;
  const existingDirY = charge.velocity.direction.y;
  const existingMagnitude = charge.velocity.magnitude;

  // Only update if the values have changed
  if (
    dirX !== existingDirX ||
    dirY !== existingDirY ||
    magnitude !== existingMagnitude
  ) {
    // Calculate length of the direction vector
    const length = Math.sqrt(dirX * dirX + dirY * dirY);

    // Handle edge cases for length
    let normalizedX = dirX;
    let normalizedY = dirY;
    if (length > 0) {
      normalizedX = dirX / length;
      normalizedY = dirY / length;
    }

    // Update the charge in the store
    chargesStore.updateCharge({
      id: chargeId,
      velocity: {
        magnitude: magnitude,
        direction: {
          x: normalizedX * magnitude, // Scale by magnitude
          y: -normalizedY * magnitude, // Scale by magnitude
        },
      },
      rawDirection: {
      x: dirX, // Preserve raw user input
      y: dirY, // Preserve raw user input
    },
  });

    console.log(`Updated charge ${chargeId} velocity:`, chargesStore.charges.find(c => c.id === chargeId)?.velocity);
  }
});

// Watch for changes in polarity to automatically update the selected charge
watch(polarity, (newPolarity) => {
  if (!chargesStore.selectedChargeId) return;

  chargesStore.updateCharge({
    id: chargesStore.selectedChargeId,
    polarity: newPolarity
  });

  console.log(`Updated charge ${chargesStore.selectedChargeId} polarity to ${newPolarity}`);
});

// Convert string values to numbers for the sliders
const chargeValueNum = computed({
  get: () => Number(chargeValue.value),
  set: (val: number) => {
    chargeValue.value = val.toString();
    // Update selected charge if editing
    if (chargesStore.selectedChargeId) {
      chargesStore.updateCharge({
        id: chargesStore.selectedChargeId,
        magnitude: val
      });
      console.log(`Updated charge ${chargesStore.selectedChargeId} magnitude to ${val}`);
    }
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
    },
    electricForce: {
      partialForces: [],
      totalForce: {
        magnitude: 0,
        direction: { x: 0, y: 0 }
      }
    }
  });

  resetForm();
};

const handleDeleteCharge = () => {
  if (!selectedChargeExists.value) return;

  chargesStore.removeCharge(chargesStore.selectedChargeId!);
  chargesStore.setSelectedCharge(null);
  resetForm();
};

// Update resetForm function to reset values to 0
const resetForm = () => {
  chargeValue.value = '0';
  polarity.value = 'positive';
  velocityMagnitude.value = '0';
  velocityDirectionX.value = '0';
  velocityDirectionY.value = '0';
};

// Add mode setter
const setMode = (newMode: SimulationMode) => {
  chargesStore.setMode(newMode);
};

// Add a watch for mode changes to ensure UI updates properly
watch(() => chargesStore.mode, (newMode) => {
  console.log(`Mode changed to: ${newMode}`);
  // Force reactive updates when switching between modes
  // This ensures the correct sidebar UI is displayed
  if (newMode === 'electric') {
    // If coming back to electric mode, check if we need to reset any state
    if (chargesStore.selectedChargeId === null) {
      resetForm();
    }
  } else {
    // If switching to magnetic mode, ensure magnetic-specific fields are reset appropriately
    if (magneticFieldValue.value === '0' && chargesStore.magneticField.z !== 0) {
      // Sync UI with actual magnetic field value from store
      magneticFieldValue.value = Math.abs(chargesStore.magneticField.z).toString();
      magneticFieldDirection.value = chargesStore.magneticField.z >= 0 ? 'out' : 'in';
    }
  }
});

const magneticFieldValueNum = computed({
  get: () => Number(magneticFieldValue.value) || 0,
  set: (val: number) => { magneticFieldValue.value = val.toString(); }
});

const velocityMagnitudeNum = computed({
  get: () => Number(velocityMagnitude.value) || 0,
  set: (val: number) => { velocityMagnitude.value = val.toString(); }
});

// Add deselect handler
const handleDeselect = () => {
  chargesStore.setSelectedCharge(null);
  resetForm();
};

// Add available colorblind modes (you can add more as needed)
const settingsStore = useSettingsStore()
const colorblindModes = ['default', 'protanopia', 'deuteranopia', 'tritanopia'] as const;
// Toggle function cycles through the modes
//const toggleColorblindMode = () => {
  //const currentIndex = colorblindModes.value.indexOf(selectedColorblindMode.value);
  //const nextIndex = (currentIndex + 1) % colorblindModes.value.length;
  //selectedColorblindMode.value = colorblindModes.value[nextIndex];

  // Update the document body (or a wrapper element) with the new mode's class.
  // This will allow CSS rules to apply different color schemes.
  //document.body.classList.remove(...colorblindModes.value);
  //document.body.classList.add(selectedColorblindMode.value);
//};

// Add the toggle function
const toggleForceVisibility = () => {
  chargesStore.toggleShowForces();
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

.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap; /* Allow items to wrap instead of overflowing */
  margin-bottom: 20px;
  gap: 12px;
}

.logo {
  font-size: 28px;
  /* larger size */
  font-weight: 800;
  color: #2c3e50;
}

.charge-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
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

/* Highlight active buttons */
.action-button.active {
  background-color: #27ae60;
  /* Green for active state */
  color: white;
}

/* Prevent hover effect on disabled buttons */
.action-button:hover:not(:disabled) {
  opacity: 0.9;
}

/* Specific styles for Start, Stop, and Reset buttons */
.start-button.active {
  background-color: #2ecc71;
  /* Bright green when animation is started */
}

.stop-button.active {
  background-color: #e74c3c;
  /* Red when animation is stopped */
}

.reset-button.active {
  background-color: #f39c12;
  /* Orange when animation is reset */
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

.selection-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
}

.error-message {
  color: #e74c3c;
  font-size: 0.9em;
  margin-top: 5px;
}

.selection-label {
  font-size: 0.9em;
  color: #666;
}

.close-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  color: #666;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.close-button:hover {
  background: #e0e0e0;
  color: #333;
}

.edit-mode-indicator {
  font-size: 0.8em;
  font-style: italic;
  color: #2980b9;
  text-align: center;
  margin-bottom: 12px;
  padding: 4px 8px;
  background-color: rgba(41, 128, 185, 0.1);
  border-radius: 4px;
}

/* Protanopia friendly mode */
body.protanopia .controls-container {
  background-color: #e0e0e0;
  /* Adjust text colors and other styles as needed */
}

/* Deuteranopia friendly mode */
body.deuteranopia .controls-container {
  background-color: #d0d0d0;
}

/* Tritanopia friendly mode */
body.tritanopia .controls-container {
  background-color: #c0c0c0;
}

.force-toggle {
  width: 100%;
  padding: 8px 12px;
  background-color: #9b59b6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.force-toggle:hover {
  background-color: #8e44ad;
}

.settings-wrapper {
  margin-bottom: 20px;
}

.outlined-icon-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 0.9rem;
  background: #ffffff;
  border: 1px solid #ccc;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  color: #2c3e50;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.outlined-icon-button:hover {
  background: #f0f0f0;
  border-color: #aaa;
}

.outlined-icon-button svg {
  stroke: #2c3e50;
}

.settings-label {
  font-size: 0.95em;
}

.settings-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.settings-modal {
  background: white;
  width: 90%;
  max-width: 320px;
  padding: 20px;
  border-radius: 10px;
  position: relative;
}

.close-modal {
  position: absolute;
  top: 10px;
  right: 14px;
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #666;
}

.setting-section {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-section label {
  font-weight: 500;
}

.modal-credit {
  margin-top: 24px;
  font-size: 0.75rem;
  font-style: italic;
  color: #888;
  text-align: center;
}

.setting-section.toggles {
  gap: 16px;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-switch {
  position: relative;
  width: 40px;
  height: 22px;
}

.switch-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  background-color: #ccc;
  border-radius: 22px;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  transition: background-color 0.2s;
}

.switch-slider::before {
  content: "";
  position: absolute;
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.switch-input:checked + .switch-slider {
  background-color: #4CAF50;
}

.switch-input:checked + .switch-slider::before {
  transform: translateX(18px);
}


/* ========================== */
/* DARK MODE IMPROVEMENTS     */
/* ========================== */

body.dark-mode .controls-container {
  background-color: #1f1f1f;
  color: #f5f5f5;
}

body.dark-mode .logo {
  color: #f5f5f5;
}

body.dark-mode .outlined-icon-button {
  background-color: #2b2b2b;
  border: 1px solid #555;
  color: #f5f5f5;
}

body.dark-mode .outlined-icon-button:hover {
  background-color: #3a3a3a;
  border-color: #777;
}

body.dark-mode .outlined-icon-button svg {
  stroke: #f5f5f5;
}

body.dark-mode .mode-button {
  background-color: #2b2b2b;
  color: #ccc;
  border-color: #444;
}

body.dark-mode .mode-button.active {
  background-color: #3498db;
  color: white;
  border-color: #2980b9;
}

body.dark-mode .input-field {
  background-color: #2c2c2c;
  color: #f5f5f5;
  border: 1px solid #555;
}

body.dark-mode .selection-controls {
  background: #2c2c2c;
  color: #ccc;
}

body.dark-mode .action-button {
  background-color: #2b2b2b;
  color: #f5f5f5;
  border: 1px solid #555;
}

body.dark-mode .action-button.active {
  background-color: #27ae60;
  color: white;
}

body.dark-mode .action-button:hover:not(:disabled) {
  background-color: #349e68;
}

body.dark-mode .edit-button {
  background-color: #2980b9;
}

body.dark-mode .edit-button:hover:not(:disabled) {
  background-color: #2471a3;
}

body.dark-mode .delete-button {
  background-color: #c0392b;
}

body.dark-mode .delete-button:hover:not(:disabled) {
  background-color: #a93226;
}

/* Mobile styles */
@media screen and (max-width: 600px) {
  .controls-container {
    width: 100%;
    min-width: unset;
    padding: 10px 15px 10px 10px; /* extra right padding */
    max-height: 100vh;
    overflow-y: auto; /* Vertical scroll if needed */
    overflow-x: auto; /* Allow horizontal scroll if absolutely necessary */
    box-sizing: border-box; /* Ensure padding is included in the width */
  }

  .header-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .logo {
    font-size: 20px;
  }

  .outlined-icon-button {
    padding: 4px 6px;
    font-size: 0.8rem;
  }

  .charge-form {
    padding: 10px;
  }

  .input-field {
    padding: 6px;
    font-size: 0.9rem;
  }

  .mode-toggle {
    margin-bottom: 16px;
  }

  /* Ensure text wraps correctly */
  .selection-controls,
  .settings-modal,
  .form-group {
    overflow-wrap: break-word;
  }
}


</style>