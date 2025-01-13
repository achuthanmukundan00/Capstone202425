import { defineStore } from 'pinia'

// Define the structure of a charge object
export interface Charge {
  id: string // Unique identifier for each charge
  magnitude: number // Strength of the charge (Q)
  polarity: 'positive' | 'negative' // Whether it's a positive or negative charge
  position: { x: number; y: number } // Position on the canvas
  velocity: { x: number; y: number } // Velocity vector of the charge
  force?: { x: number; y: number; z: number } // Optional: Magnetic force vector
}

// Create a Pinia store for managing charges
export const useChargesStore = defineStore('charges', {
  // Initial state of the store
  state: () => ({
    charges: [] as Charge[], // Array to hold all charges in the simulation
    selectedChargeId: null as string | null,
  }),

  // Actions that can be performed on the store
  actions: {
    // Add a new charge to the simulation
    // Takes partial charge data (omitting id and position which are generated)
    addCharge(charge: Omit<Charge, 'id' | 'position'>) {
      const newCharge: Charge = {
        id: crypto.randomUUID(), // Generate unique ID for the charge
        magnitude: charge.magnitude,
        polarity: charge.polarity,
        position: { x: 400, y: 300 }, // Place charge in center of canvas initially
        velocity: { x: 0, y: 0 },
      }
      this.charges.push(newCharge)
    },
    removeCharge(chargeId: string) {
      this.charges = this.charges.filter(charge => charge.id !== chargeId)
    },
    updateChargePosition(id: string, newPosition: { x: number; y: number }) {
      const charge = this.charges.find(c => c.id === id)
      if (charge) {
        charge.position = newPosition
      }
    },
    setSelectedCharge(id: string | null) {
      this.selectedChargeId = id
    },
    updateCharge(updatedCharge: Partial<Charge> & { id: string }) {
      const charge = this.charges.find(c => c.id === updatedCharge.id)
      if (charge) {
        if (updatedCharge.magnitude !== undefined) {
          charge.magnitude = updatedCharge.magnitude
        }
        if (updatedCharge.polarity !== undefined) {
          charge.polarity = updatedCharge.polarity
        }
      }
    },
  },
})
