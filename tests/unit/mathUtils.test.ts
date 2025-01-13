import { describe, it, expect } from 'vitest'
import {
  calculateElectricField,
  calculateMagneticForce,
  normalizeAndScale,
} from '../../src/utils/mathUtils'
import { K } from '../../src/consts/consts'

describe('mathUtils', () => {
  describe('calculateElectricField', () => {
    it('calculates the electric field at a point due to a positive charge', () => {
      const chargePosition = { x: 0, y: 0 }
      const chargeMagnitude = 5
      const point = { x: 3, y: 4 }
      const isPositive = true

      const result = calculateElectricField(
        chargePosition,
        chargeMagnitude,
        point,
        isPositive,
      )

      const rSquared = 3 ** 2 + 4 ** 2
      const expectedMagnitude = (K * chargeMagnitude) / rSquared

      expect(result.x).toBeCloseTo((expectedMagnitude * 3) / 5, 6)
      expect(result.y).toBeCloseTo((expectedMagnitude * 4) / 5, 6)
    })

    it('calculates the electric field at a point due to a negative charge', () => {
      const chargePosition = { x: 0, y: 0 }
      const chargeMagnitude = 5
      const point = { x: 3, y: 4 }
      const isPositive = false

      const result = calculateElectricField(
        chargePosition,
        chargeMagnitude,
        point,
        isPositive,
      )

      const rSquared = 3 ** 2 + 4 ** 2
      const expectedMagnitude = (K * chargeMagnitude) / rSquared

      expect(result.x).toBeCloseTo(-(expectedMagnitude * 3) / 5, 6)
      expect(result.y).toBeCloseTo(-(expectedMagnitude * 4) / 5, 6)
    })

    it('returns {0, 0} when the point is at the charge position to avoid division by zero', () => {
      const chargePosition = { x: 0, y: 0 }
      const chargeMagnitude = 5
      const point = { x: 0, y: 0 }
      const isPositive = true

      const result = calculateElectricField(
        chargePosition,
        chargeMagnitude,
        point,
        isPositive,
      )

      expect(result).toEqual({ x: 0, y: 0 })
    })
  })

  describe('calculateMagneticForce', () => {
    it('calculates the magnetic force vector correctly', () => {
      const chargeMagnitude = 2
      const chargeVelocity = { x: 1, y: 0, z: 0 }
      const magneticField = { x: 0, y: 1, z: 0 }

      const result = calculateMagneticForce(
        chargeMagnitude,
        chargeVelocity,
        magneticField,
      )

      expect(result).toEqual({ x: 0, y: 0, z: 2 })
    })

    it('returns a zero vector when the charge velocity is zero', () => {
      const chargeMagnitude = 5
      const chargeVelocity = { x: 0, y: 0, z: 0 }
      const magneticField = { x: 0, y: 1, z: 0 }

      const result = calculateMagneticForce(
        chargeMagnitude,
        chargeVelocity,
        magneticField,
      )

      expect(result).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('returns a zero vector when the magnetic field is zero', () => {
      const chargeMagnitude = 5
      const chargeVelocity = { x: 1, y: 0, z: 0 }
      const magneticField = { x: 0, y: 0, z: 0 }

      const result = calculateMagneticForce(
        chargeMagnitude,
        chargeVelocity,
        magneticField,
      )

      expect(result).toEqual({ x: 0, y: 0, z: 0 })
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
