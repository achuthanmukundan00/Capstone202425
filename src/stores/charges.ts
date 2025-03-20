import { defineStore } from 'pinia'
import type { Store } from 'pinia'

// Define the structure of a charge object
export interface Charge {
  id: string // Unique identifier for each charge
  magnitude: number // Strength of the charge (Q)
  polarity: 'positive' | 'negative' // Whether it's a positive or negative charge
  position: { x: number; y: number } // Position on the canvas
  velocity: {
    magnitude: number
    direction: { x: number; y: number }
  }
  force?: { x: number; y: number; z: number } // Optional: Magnetic force vector
  preAnimationPosition?: { x: number; y: number } // position on canvas before animation starts
  preAnimationVelocity?: {
    magnitude: number
    direction: { x: number; y: number }
  }
}

// Add mode type
export type SimulationMode = 'electric' | 'magnetic';

// Create a Pinia store for managing charges
export const useChargesStore = defineStore('charges', {
  // Initial state of the store
  state: () => ({
    charges: [] as Charge[], // Array to hold all charges in the simulation
    selectedChargeId: null as string | null,
    mode: 'electric' as SimulationMode, // Simulation mode can be "electric" or "magnetic"

    // Uniform magnetic field state (in Teslas, e.g. { x: 0, y: 0, z: 1 })
    magneticField: { x: 0, y: 0, z: 0 },
    isAnimating: false,
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
        position: { x: 400, y: 300 }, // Place charge in the center of canvas initially
        velocity: {
          magnitude: 0,
          direction: { x: 0, y: 0 }
        },
      }
      this.charges.push(newCharge)
    },

    // Remove charge by ID
    removeCharge(chargeId: string) {
      this.charges = this.charges.filter(charge => charge.id !== chargeId)
    },

    // Update charge position by ID
    updateChargePosition(id: string, newPosition: { x: number; y: number }) {
      const charge = this.charges.find(c => c.id === id)
      if (charge) {
        charge.position = newPosition
      }
    },

    // Set which charge is selected (for editing, highlighting, etc.)
    setSelectedCharge(id: string | null) {
      this.selectedChargeId = id
    },

    // Update existing charge fields (magnitude, polarity, velocity, etc.)
    updateCharge(updatedCharge: Partial<Charge> & { id: string }) {
      const charge = this.charges.find(c => c.id === updatedCharge.id)
      if (charge) {
        if (updatedCharge.magnitude !== undefined) {
          charge.magnitude = updatedCharge.magnitude
        }
        if (updatedCharge.polarity !== undefined) {
          charge.polarity = updatedCharge.polarity
        }
        if (updatedCharge.velocity !== undefined) {
          charge.velocity = updatedCharge.velocity
        }
      }
    },

    // Switch between "electric" or "magnetic" mode
    setMode(mode: SimulationMode) {
      this.mode = mode
    },

    // Set the uniform magnetic field (in Teslas)
    setMagneticField(newField: { x: number; y: number; z: number }) {
      this.magneticField = newField
    },

    startAnimation() {
      this.charges.forEach(charge => {
        charge.preAnimationPosition = { x: charge.position.x, y: charge.position.y };
        charge.preAnimationVelocity = { 
          magnitude: charge.velocity.magnitude, 
          direction: { 
            x: charge.velocity.direction.x, 
            y: charge.velocity.direction.y 
          }
        };
      });
      this.isAnimating = true;
    },

    resetAnimation() {
      this.isAnimating = false;
      this.charges.forEach(charge => {
        charge.position = { x: charge.preAnimationPosition?.x ?? 300, y: charge.preAnimationPosition?.y ?? 400 };
        charge.velocity = { magnitude: charge.preAnimationVelocity?.magnitude ?? 0, direction: charge.preAnimationVelocity?.direction ?? { x: 0, y: 0}};
      });
    },
  },
})

export interface ChargesStore extends Store {
  charges: Charge[];
  magneticField: { x: number; y: number; z: number };
}

