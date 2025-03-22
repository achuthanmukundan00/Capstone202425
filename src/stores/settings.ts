// settings.ts
import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    colorblindMode: 'default' as 'default' | 'protanopia' | 'deuteranopia' | 'tritanopia',
  }),
  actions: {
    setColorblindMode(mode: 'default' | 'protanopia' | 'deuteranopia' | 'tritanopia') {
      this.colorblindMode = mode
    },
  },
})
