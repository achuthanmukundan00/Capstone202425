import { describe, it, expect } from 'vitest'
import {
  calculateElectricField,
  calculateMagneticForce,
  normalizeAndScale,
} from '../../src/utils/mathUtils'
import { K } from '../../src/consts'
import type { Charge } from '../../src/stores/Charges'

describe('MathUtils', () => {
  describe('calculateElectricField', () => {
    it('calculates the electric field at a point due to a positive charge', () => {
      const charge: Charge = {
        id: 'test-charge-pos',
        magnitude: 5,
        polarity: 'positive',
        position: { x: 0, y: 0 },
        velocity: {
          magnitude: 0,
          direction: { x: 0, y: 0 },
        },
      }
      const point = { x: 3, y: 4 }

      // Derive isPositive from polarity
      const result = calculateElectricField(
        charge.position,
        charge.magnitude,
        point,
        charge.polarity === 'positive',
      )

      const rSquared = 3 ** 2 + 4 ** 2
      const expectedMagnitude = (K * charge.magnitude) / rSquared

      // The direction from (0,0) to (3,4) is a 3-4-5 triangle
      expect(result.x).toBeCloseTo((expectedMagnitude * 3) / 5, 6)
      expect(result.y).toBeCloseTo((expectedMagnitude * 4) / 5, 6)
    })

    it('calculates the electric field at a point due to a negative charge', () => {
      const charge: Charge = {
        id: 'test-charge-neg',
        magnitude: 5,
        polarity: 'negative',
        position: { x: 0, y: 0 },
        velocity: {
          magnitude: 0,
          direction: { x: 0, y: 0 },
        },
      }
      const point = { x: 3, y: 4 }

      const result = calculateElectricField(
        charge.position,
        charge.magnitude,
        point,
        charge.polarity === 'positive', // This will be false
      )

      const rSquared = 3 ** 2 + 4 ** 2
      const expectedMagnitude = (K * charge.magnitude) / rSquared

      expect(result.x).toBeCloseTo(-(expectedMagnitude * 3) / 5, 6)
      expect(result.y).toBeCloseTo(-(expectedMagnitude * 4) / 5, 6)
    })

    it('returns {0, 0} when the point is at the charge position to avoid division by zero', () => {
      const charge: Charge = {
        id: 'test-charge-zero-dist',
        magnitude: 5,
        polarity: 'positive',
        position: { x: 0, y: 0 },
        velocity: {
          magnitude: 0,
          direction: { x: 0, y: 0 },
        },
      }
      const point = { x: 0, y: 0 }

      const result = calculateElectricField(
        charge.position,
        charge.magnitude,
        point,
        charge.polarity === 'positive',
      )

      expect(result).toEqual({ x: 0, y: 0 })
    })
  })

  describe('calculateMagneticForce', () => {
    it('calculates the magnetic force vector correctly', () => {
      const charge: Charge = {
        id: 'test-charge-magnetic',
        magnitude: 2,
        polarity: 'positive',
        position: { x: 0, y: 0 },
        velocity: {
          magnitude: 1,
          direction: { x: 1, y: 0 }, // Velocity = (1,0) in 2D
        },
      }
      const magneticField = { x: 0, y: 1, z: 0 }

      // Cross product of (1,0,0) with (0,1,0) => (0,0,1)
      // Then scaled by the charge magnitude (2) => (0,0,2)
      const result = calculateMagneticForce(charge, magneticField)
      expect(result).toEqual({ x: 0, y: -0, z: 2 })
    })

    it('returns a zero vector when the charge velocity is zero', () => {
      const charge: Charge = {
        id: 'test-charge-zero-vel',
        magnitude: 5,
        polarity: 'positive',
        position: { x: 0, y: 0 },
        velocity: {
          magnitude: 0,
          direction: { x: 0, y: 0 },
        },
      }
      const magneticField = { x: 0, y: 1, z: 0 }

      const result = calculateMagneticForce(charge, magneticField)
      expect(result).toEqual({ x: 0, y: -0, z: 0 })
    })

    it('returns a zero vector when the magnetic field is zero', () => {
      const charge: Charge = {
        id: 'test-charge-zero-field',
        magnitude: 5,
        polarity: 'positive',
        position: { x: 0, y: 0 },
        velocity: {
          magnitude: 1,
          direction: { x: 1, y: 0 },
        },
      }
      const magneticField = { x: 0, y: 0, z: 0 }

      const result = calculateMagneticForce(charge, magneticField)
      expect(result).toEqual({ x: 0, y: -0, z: 0 })
    })
  })

  describe('normalizeAndScale', () => {
    it('normalizes and scales a 2D non-zero vector correctly', () => {
      const vector = { x: 3, y: 4 } // Magnitude: 5
      const scale = 10

      const result = normalizeAndScale(vector, scale)

      expect(result).toEqual({
        x: (3 / 5) * 10,
        y: (4 / 5) * 10,
      })
    })

    it('normalizes and scales a 3D non-zero vector correctly', () => {
      const vector = { x: 1, y: 2, z: 2 } // Magnitude: sqrt(1^2 + 2^2 + 2^2) = 3
      const scale = 6

      const result = normalizeAndScale(vector, scale)

      expect(result).toEqual({
        x: (1 / 3) * 6,
        y: (2 / 3) * 6,
        z: (2 / 3) * 6,
      })
    })

    it('returns {0, 0} for a 2D zero vector', () => {
      const vector = { x: 0, y: 0 }
      const scale = 10

      const result = normalizeAndScale(vector, scale)

      expect(result).toEqual({ x: 0, y: 0 })
    })

    it('returns {0, 0, 0} for a 3D zero vector', () => {
      const vector = { x: 0, y: 0, z: 0 }
      const scale = 10

      const result = normalizeAndScale(vector, scale)

      expect(result).toEqual({ x: 0, y: 0, z: 0 })
    })
  })
})
