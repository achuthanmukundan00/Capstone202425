import type { Charge } from '@/stores/charges'
import { useChargesStore } from '@/stores/charges'
import { K } from '../consts'

// Calculate electric field at a given point due to a charge
export function calculateElectricField(
  chargePosition: { x: number; y: number },
  chargeMagnitude: number,
  point: { x: number; y: number },
  isPositive: boolean,
) {
  const dx = point.x - chargePosition.x
  const dy = point.y - chargePosition.y
  const rSquared = dx * dx + dy * dy
  const r = Math.sqrt(rSquared)

  if (r === 0) return { x: 0, y: 0 } // Avoid division by zero

  const fieldMagnitude = (K * chargeMagnitude) / rSquared
  const angle = Math.atan2(dy, dx)

  const fieldX = fieldMagnitude * Math.cos(angle)
  const fieldY = fieldMagnitude * Math.sin(angle)

  // Reverse direction for negative charges
  return isPositive ? { x: fieldX, y: fieldY } : { x: -fieldX, y: -fieldY }
}

// Calculate the magnetic force vector on a moving point charge
export function calculateMagneticForce(
  charge: Charge,
  magneticField: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  // Cross product: v x B
  // console.log('mag field:', magneticField);
  // console.log('charge', charge);
  const crossProduct = {
    x:
      charge.velocity.magnitude * charge.velocity.direction.y * magneticField.z,
    y: (-1) * charge.velocity.magnitude * charge.velocity.direction.x * magneticField.z,
    z: charge.velocity.magnitude * charge.velocity.direction.x * magneticField.y - charge.velocity.magnitude * charge.velocity.direction.y * magneticField.x,
  }
  // console.log('crossProduct', crossProduct);


  // Scale by charge magnitude
  return {
    x: charge.magnitude * crossProduct.x,
    y: charge.magnitude * crossProduct.y,
    z: charge.magnitude * crossProduct.z,
  }
}

// Normalize a vector and scale it - works with 2D and 3D vectors
export function normalizeAndScale(
  vector: { x: number; y: number; z?: number },
  scale: number,
): { x: number; y: number; z?: number } {
  // Calculate the magnitude
  const magnitude = Math.sqrt(
    vector.x ** 2 + vector.y ** 2 + (vector.z ? vector.z ** 2 : 0),
  )

  // Handle zero vector case
  if (magnitude === 0) {
    return { x: 0, y: 0, z: vector.z !== undefined ? 0 : undefined }
  }

  // Normalize and scale the vector
  return {
    x: (vector.x / magnitude) * scale,
    y: (vector.y / magnitude) * scale,
    z: vector.z !== undefined ? (vector.z / magnitude) * scale : undefined,
  }
}

export function getNetElectricFieldAtPoint(point: { x: number; y: number }) {
  const store = useChargesStore()
  const charges = store.charges

  // eslint-disable-next-line
  let netField = { x: 0, y: 0 }

  charges.forEach(charge => {
    const field = calculateElectricField(
      charge.position,
      charge.magnitude,
      point,
      charge.polarity === 'positive'
    )
    netField.x += field.x
    netField.y += field.y
  })

  return netField
}
