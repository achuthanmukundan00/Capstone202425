import type { Charge } from '@/stores/charges'
import { useChargesStore } from '@/stores/charges'
import { K } from '../consts'

// Cache for electric field calculations to avoid recalculating
const fieldCache = new Map<string, { x: number, y: number }>();

// Function to generate cache key for field calculations
function getFieldCacheKey(chargePos: { x: number; y: number }, magnitude: number, point: { x: number; y: number }, isPositive: boolean): string {
  return `${chargePos.x.toFixed(0)},${chargePos.y.toFixed(0)},${magnitude},${point.x.toFixed(0)},${point.y.toFixed(0)},${isPositive}`;
}

// Calculate electric field at a given point due to a charge
export function calculateElectricField(
  chargePosition: { x: number; y: number },
  chargeMagnitude: number,
  point: { x: number; y: number },
  isPositive: boolean,
) {
  // Round point coordinates to reduce cache size and improve hit rate
  const roundedPoint = {
    x: Math.round(point.x),
    y: Math.round(point.y)
  };

  // Round charge position to reduce cache size
  const roundedChargePos = {
    x: Math.round(chargePosition.x),
    y: Math.round(chargePosition.y)
  };

  // Generate cache key
  const cacheKey = getFieldCacheKey(roundedChargePos, chargeMagnitude, roundedPoint, isPositive);

  // Check if result is in cache
  if (fieldCache.has(cacheKey)) {
    return fieldCache.get(cacheKey)!;
  }

  const dx = point.x - chargePosition.x
  const dy = point.y - chargePosition.y
  const rSquared = dx * dx + dy * dy
  const r = Math.sqrt(rSquared)

  if (r === 0) return { x: 0, y: 0 } // Avoid division by zero

  const fieldMagnitude = (K * chargeMagnitude) / rSquared
  const angle = Math.atan2(dy, dx)

  const fieldX = fieldMagnitude * Math.cos(angle)
  const fieldY = fieldMagnitude * Math.sin(angle)

  // Result based on charge polarity
  const result = isPositive ? { x: fieldX, y: fieldY } : { x: -fieldX, y: -fieldY };

  // Store in cache (limit cache size)
  if (fieldCache.size > 10000) {
    // Clear cache if it gets too large
    fieldCache.clear();
  }
  fieldCache.set(cacheKey, result);

  return result;
}

// Force calculation cache
const forceCache = new Map<string, {
  partialForces: Array<{
    direction: { x: number; y: number };
    magnitude: number;
    sourceChargeId?: string;
  }>,
  totalForce: { magnitude: number; direction: { x: number; y: number } }
}>();

// Generate a cache key for a pair of charges
function getForceCacheKey(charge1: Charge, charge2: Charge): string {
  return `${charge1.id}-${charge2.id}-${charge1.position.x.toFixed(0)}-${charge1.position.y.toFixed(0)}-${charge2.position.x.toFixed(0)}-${charge2.position.y.toFixed(0)}-${charge1.magnitude}-${charge2.magnitude}-${charge1.polarity}-${charge2.polarity}`;
}

// Calculate the partial and total electric force on a charge due to all other charges
export function calculateElectricForce(charges: Charge[]) {
  if (charges.length <= 1) return; // Need at least 2 charges to have forces

  // Results container to avoid direct charge mutation
  const forceResults = new Map<string, {
    partialForces: Array<{
      direction: { x: number; y: number };
      magnitude: number;
      sourceChargeId?: string;
    }>,
    totalForce: { magnitude: number; direction: { x: number; y: number } }
  }>();

  // Calculate forces between each pair of charges
  for (let i = 0; i < charges.length; i++) {
    const charge1 = charges[i];
    let totalForceX = 0;
    let totalForceY = 0;
    let totalForceMagnitude = 0;
    const partialForces: Array<{
      direction: { x: number; y: number };
      magnitude: number;
      sourceChargeId?: string;
    }> = [];

    for (let j = 0; j < charges.length; j++) {
      if (i === j) continue; // Skip self

      const charge2 = charges[j];

      // Try to get from cache first
      const cacheKey = getForceCacheKey(charge1, charge2);
      let partialForce;

      if (forceCache.has(cacheKey)) {
        partialForce = forceCache.get(cacheKey)!;
        partialForces.push({...partialForce.partialForces[0]});

        // Add to total
        totalForceX += partialForce.partialForces[0].direction.x * partialForce.partialForces[0].magnitude;
        totalForceY += partialForce.partialForces[0].direction.y * partialForce.partialForces[0].magnitude;
        totalForceMagnitude += partialForce.partialForces[0].magnitude;
        continue;
      }

      // Calculate distance between charges
      const dx = charge2.position.x - charge1.position.x;
      const dy = charge2.position.y - charge1.position.y;
      const distanceSquared = dx * dx + dy * dy;
      const distance = Math.sqrt(distanceSquared);

      if (distance < 1) continue; // Avoid division by zero

      // Calculate force magnitude (Coulomb's law)
      // F = k * q1 * q2 / r²
      const sign1 = charge1.polarity === 'positive' ? 1 : -1;
      const sign2 = charge2.polarity === 'positive' ? 1 : -1;
      const forceMagnitude = K * Math.abs(charge1.magnitude) * Math.abs(charge2.magnitude) / distanceSquared;

      // Force direction (unit vector from charge1 to charge2)
      const dirX = dx / distance;
      const dirY = dy / distance;

      // If like charges (++, --), they repel; if unlike charges (+-, -+), they attract
      const forceSign = sign1 * sign2 > 0 ? -1 : 1; // Repel if same sign, attract if different

      // Create partial force
      const newPartialForce = {
        magnitude: forceMagnitude,
        direction: {
          x: dirX * forceSign,
          y: dirY * forceSign
        },
        sourceChargeId: charge2.id // Store the ID of the charge causing this force
      };

      // Add this partial force to our collection
      partialForces.push(newPartialForce);

      // Update total force components
      totalForceX += dirX * forceSign * forceMagnitude;
      totalForceY += dirY * forceSign * forceMagnitude;
      totalForceMagnitude += forceMagnitude;

      // Cache this result for future use
      forceCache.set(cacheKey, {
        partialForces: [newPartialForce],
        totalForce: {
          magnitude: forceMagnitude,
          direction: { x: dirX * forceSign, y: dirY * forceSign }
        }
      });

      // Limit cache size
      if (forceCache.size > 500) {
        forceCache.clear();
      }
    }

    // Compute the total force direction
    const totalMagnitude = Math.sqrt(totalForceX * totalForceX + totalForceY * totalForceY);

    const totalForce = totalMagnitude > 0 ? {
      magnitude: totalForceMagnitude,
      direction: {
        x: totalForceX / totalMagnitude,
        y: totalForceY / totalMagnitude
      }
    } : {
      magnitude: 0,
      direction: { x: 0, y: 0 }
    };

    // Store the results for this charge
    forceResults.set(charge1.id, {
      partialForces,
      totalForce
    });
  }

  // Return the results to be applied by the caller
  return forceResults;
}

// Calculate the magnetic force vector on a moving point charge
export function calculateMagneticForce(
  charge: Charge,
  magneticField: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  // Cross product: v x B
  const crossProduct = {
    x: charge.velocity.magnitude * (charge.velocity.direction.y * magneticField.z),
    y: charge.velocity.magnitude * (-charge.velocity.direction.x * magneticField.z),
    z: charge.velocity.magnitude * (charge.velocity.direction.x * magneticField.y - charge.velocity.direction.y * magneticField.x),
  };

  // Scale by charge magnitude
  return {
    x:  (charge.polarity === 'positive' ? 1 : -1) * charge.magnitude * crossProduct.x,
    y: (charge.polarity === 'positive' ? 1 : -1) * charge.magnitude * crossProduct.y,
    z: (charge.polarity === 'positive' ? 1 : -1) * charge.magnitude * crossProduct.z,
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
