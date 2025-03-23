// settings.ts
import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    colorblindMode: 'default' as 'default' | 'protanopia' | 'deuteranopia' | 'tritanopia',
    dyslexiaMode: false
  }),
  actions: {
    setColorblindMode(mode: 'default' | 'protanopia' | 'deuteranopia' | 'tritanopia') {
      this.colorblindMode = mode
    },
    setDyslexiaMode(val: boolean) {
      this.dyslexiaMode = val;
    }
  },
})
