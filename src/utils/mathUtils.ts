import { K } from '../consts'

// Calculate electric field at a given point due to a charge
export function calculateElectricField(chargePosition: { x: number; y: number }, chargeMagnitude: number, point: { x: number; y: number }, isPositive: boolean) {
    const dx = point.x - chargePosition.x;
    const dy = point.y - chargePosition.y;
    const rSquared = dx * dx + dy * dy;
    const r = Math.sqrt(rSquared);

    if (r === 0) return { x: 0, y: 0 }; // Avoid division by zero

    const fieldMagnitude = K * chargeMagnitude / rSquared;
    const angle = Math.atan2(dy, dx);

    const fieldX = fieldMagnitude * Math.cos(angle);
    const fieldY = fieldMagnitude * Math.sin(angle);

    // Reverse direction for negative charges
    return isPositive ? { x: fieldX, y: fieldY } : { x: -fieldX, y: -fieldY };
}

// Calculate the magnetic force vector on a moving point charge
export function calculateMagneticForce(
  chargeMagnitude: number,
  chargeVelocity: { x: number; y: number; z: number },
  magneticField: { x: number; y: number; z: number }
): { x: number; y: number; z: number } {
  // Cross product: v x B
  const crossProduct = {
    x: chargeVelocity.y * magneticField.z - chargeVelocity.z * magneticField.y,
    y: chargeVelocity.z * magneticField.x - chargeVelocity.x * magneticField.z,
    z: chargeVelocity.x * magneticField.y - chargeVelocity.y * magneticField.x,
  };

  // Scale by charge magnitude
  return {
    x: chargeMagnitude * crossProduct.x,
    y: chargeMagnitude * crossProduct.y,
    z: chargeMagnitude * crossProduct.z,
  };
}

// Normalize a vector and scale it
export function normalizeAndScale(vector: { x: number; y: number }, scale: number) {
    const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    return {
        x: (vector.x / magnitude) * scale,
        y: (vector.y / magnitude) * scale
    };
}
