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
  rawDirection?: {
    x: number;
    y: number;
  }
  electricForce: {
    partialForces: {
      direction: { x: number; y: number };
      magnitude: number;
      sourceChargeId?: string; // ID of the charge causing this force
    }[]
    totalForce: { magnitude: number; direction: { x: number; y: number } }
  }
  force?: { x: number; y: number; z: number } // Optional: Magnetic force vector
  preAnimationPosition?: { x: number; y: number } // position on canvas before animation starts
  preAnimationVelocity?: {
    magnitude: number
    direction: { x: number; y: number }
  }
  trail?: { x: number; y: number }[]
  trailSampleCounter?: number
}

// Add mode type
export type SimulationMode = 'electric' | 'magnetic';
export enum AnimationMode {start, stop, reset}

function generateRandomPosition() {
  // Ensure charges appear fully inside the canvas
  const x = Math.random() * 0.7 * (innerWidth - 2) + 24;
  const y = Math.random() * (innerHeight - 2) + 24;
  return { x, y };
}

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
    showForces: true,
    animationMode: AnimationMode.stop,
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
        position: generateRandomPosition(),
        velocity: {
          magnitude: charge.velocity.magnitude || 1,
          direction: { x: charge.velocity.direction.x || 0, y: charge.velocity.direction.y || 0 }
        },
        electricForce: {
          partialForces: [],
          totalForce: {
            magnitude: 0,
            direction: { x: 0, y: 0 }
          }
        }
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
      // Only update if the selection actually changes
      if (this.selectedChargeId !== id) {
        this.selectedChargeId = id;
      }
    },

    // Update existing charge fields (magnitude, polarity, velocity, etc.)
    updateCharge(updatedCharge: Partial<Charge> & { id: string }) {
      const charge = this.charges.find(c => c.id === updatedCharge.id);
      if (charge) {
        if (updatedCharge.magnitude !== undefined) {
          charge.magnitude = updatedCharge.magnitude;
        }
        if (updatedCharge.polarity !== undefined) {
          charge.polarity = updatedCharge.polarity;
        }
        if (updatedCharge.velocity !== undefined) {
          charge.velocity = updatedCharge.velocity;
        }
        if (updatedCharge.rawDirection !== undefined) {
          charge.rawDirection = updatedCharge.rawDirection; // Preserve raw user inputs
        }
      }
    },

    // Switch between "electric" or "magnetic" mode
    setMode(mode: SimulationMode) {
      // If we're actually changing modes (not just re-setting the same mode)
      if (this.mode !== mode) {
        const previousMode = this.mode;
        this.mode = mode;

        // Reset animation when switching modes
        if (this.isAnimating) {
          this.resetAnimation();
        }

        // When returning to electric mode, ensure the UI is freshly updated
        if (mode === 'electric' && previousMode === 'magnetic') {
          // Trigger reactivity by toggling and toggling back if forces are showing
          if (this.showForces) {
            // This is a hack to ensure reactive updates when needed
            const currentShowForces = this.showForces;
            this.showForces = !currentShowForces;
            setTimeout(() => {
              this.showForces = currentShowForces;
            }, 0);
          }
        }
      }
    },

    // Set the uniform magnetic field (in Teslas)
    setMagneticField(newField: { x: number; y: number; z: number }) {
      this.magneticField = newField
    },

    startAnimation() {
      this.charges.forEach(charge => {
        charge.preAnimationPosition = charge.preAnimationPosition ?? { x: charge.position.x, y: charge.position.y };
        charge.preAnimationVelocity = charge.preAnimationVelocity ?? {
          magnitude: charge.velocity.magnitude,
          direction: {
            x: charge.velocity.direction.x,
            y: charge.velocity.direction.y
          }
        };
      });
      this.animationMode = AnimationMode.start;
    },

    stopAnimation() {
      this.animationMode = AnimationMode.stop;
    },

    resetAnimation() {
      this.animationMode = AnimationMode.reset;
      this.charges.forEach(charge => {
        charge.position = { x: charge.preAnimationPosition?.x ?? 300, y: charge.preAnimationPosition?.y ?? 400 };
        charge.velocity = { magnitude: charge.preAnimationVelocity?.magnitude ?? 0, direction: charge.preAnimationVelocity?.direction ?? { x: 0, y: 0}};
        delete charge.preAnimationPosition;
        delete charge.preAnimationVelocity;
        charge.trail = [];
        delete charge.trailSampleCounter;
      });
    },

    toggleShowForces() {
      this.showForces = !this.showForces;

      // When toggling forces, ensure we're calculating electric forces if needed
      if (this.mode === 'electric' && this.showForces && this.charges.length > 1) {
        // We trigger a reactivity update here to ensure that any components watching showForces
        // receive the update and redraw the forces correctly
        setTimeout(() => {
          // This just triggers reactivity without changing any values
          this.charges = [...this.charges];
        }, 0);
      }
    },
  },
})

export interface ChargesStore extends Store {
  charges: Charge[];
  magneticField: { x: number; y: number; z: number };
  showForces: boolean;
}
