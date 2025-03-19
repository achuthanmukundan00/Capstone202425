// Physics
export const K = 8.9875517923e9; // Coulomb constant (N·m²/C²)

// Vector Field Consts
export const FIELD_SPACING = 40; // Spacing between field vectors in pixels
export const VECTOR_LENGTH_SCALE = 0.0005; // Scaling factor for vector length
export const ARROWHEAD_LENGTH = 8; // Length of the arrowhead
export const MAX_VECTOR_LENGTH = 30; // Maximum length for the vectors (to prevent too long arrows)
export const MAG_FORCE_ARROW_FACTOR = 500000; // Scaling factor for drawing magnetic force arrows

// Colors
export const MAG_FORCE_ARROW_COLOUR = 0xff7f00;
export const VELOCITY_ARROW_COLOUR = 0x1E90FF;

// Animation
export const ANIMATION_SPEED = 8e-2;
export const FORCE_SCALING = 4e-5;

// UI Bounds
export const CHARGE_MAGNITUDE_BOUNDS = {
  MIN: 0,
  MAX: 10,
  STEP: 0.1,
} as const;

export const MAGNETIC_FIELD_BOUNDS = {
  MIN: 0,
  MAX: 5,
  STEP: 0.1,
} as const;

export const VELOCITY_BOUNDS = {
  MIN: 0,
  MAX: 100,
  STEP: 1,
} as const;
