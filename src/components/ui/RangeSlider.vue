<template>
  <div class="slider-container">
    <div class="slider-label">
      <span>{{ label }}</span>
      <span class="current-value">{{ displayValue }}</span>
    </div>
    <div class="slider-wrapper">
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        @input="handleInput"
        class="range-slider"
      />
      <div class="bounds">
        <span>{{ formatValue(min) }}</span>
        <span>{{ formatValue(max) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: number;
  min: number;
  max: number;
  step: number;
  label: string;
  unit?: string;
  precision?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

const formatValue = (value: number) => {
  const formatted = props.precision
    ? value.toFixed(props.precision)
    : value.toString();
  return props.unit ? `${formatted}${props.unit}` : formatted;
};

const displayValue = computed(() => formatValue(props.modelValue));

const handleInput = (event: Event) => {
  const value = parseFloat((event.target as HTMLInputElement).value);
  emit('update:modelValue', value);
};
</script>

<style scoped>
.slider-container {
  width: 100%;
  padding: 8px 0;
}

.slider-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  color: #666;
  font-size: 0.9em;
}

.current-value {
  font-weight: 600;
  color: #3498db;
}

.slider-wrapper {
  position: relative;
}

.range-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  background: #ddd;
  border-radius: 2px;
  outline: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3498db;
  cursor: pointer;
  transition: background .15s ease-in-out;
}

.range-slider::-webkit-slider-thumb:hover {
  background: #2980b9;
}

.bounds {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.8em;
  color: #999;
}
</style>
