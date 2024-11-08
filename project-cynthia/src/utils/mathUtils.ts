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

// Normalize a vector and scale it
export function normalizeAndScale(vector: { x: number; y: number }, scale: number) {
    const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    return {
        x: (vector.x / magnitude) * scale,
        y: (vector.y / magnitude) * scale
    };
}
