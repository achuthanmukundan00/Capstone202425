import * as PIXI from 'pixi.js'
import {
  calculateElectricField,
  calculateMagneticForce,
  normalizeAndScale,
} from './mathUtils'
import type { Charge } from '@/stores/charges'
import type { ChargesStore } from '@/stores/charges'
import {
  FIELD_SPACING,
  VECTOR_LENGTH_SCALE,
  MAX_VECTOR_LENGTH,
  ARROWHEAD_LENGTH,
  MAG_FORCE_ARROW_FACTOR,
} from '../consts'
import { createElectricFieldArrow, createMagneticFieldSymbol } from '@/utils/drawingPrimitives'

const MIN_ALPHA = 0.1
const MAX_ALPHA = 1.0
const LOG_SCALE_FACTOR = 2

// Object pool for force vectors to avoid creating/destroying graphics objects
// This significantly improves performance when redrawing forces frequently
const forceVectorPool: PIXI.Graphics[] = [];
const MAX_POOL_SIZE = 100;

// Map to store charge ID to simple label mapping (C1, C2, etc.)
const chargeIdToLabel = new Map<string, string>();

// Get a vector from the pool or create a new one
function getVectorFromPool(): PIXI.Graphics {
  if (forceVectorPool.length > 0) {
    const vector = forceVectorPool.pop()!;
    vector.clear();
    return vector;
  }
  return new PIXI.Graphics();
}

// Return a vector to the pool for reuse
function returnVectorToPool(vector: PIXI.Graphics) {
  if (forceVectorPool.length < MAX_POOL_SIZE) {
    forceVectorPool.push(vector);
  }
}

// Clear all vectors of a certain type and return them to the pool
function clearAndPoolVectors(app: PIXI.Application, filter: (child: PIXI.Container) => boolean) {
  const vectorsToRemove = app.stage.children.filter(filter);
  vectorsToRemove.forEach(child => {
    app.stage.removeChild(child);
    if (child instanceof PIXI.Graphics) {
      returnVectorToPool(child);
    }
  });
}

export function removeFields(app: PIXI.Application) {
  app.stage.children
    .filter(child => child.name === 'magneticFieldSymbol')
    .forEach(child => app.stage.removeChild(child))
  app.stage.children
    .filter(child => child.name === 'fieldVector')
    .forEach(child => app.stage.removeChild(child))
}

export function drawElectricField(
  app: PIXI.Application,
  charges: Charge[],
  //eslint-disable-next-line
  colorPalette: any,
) {
  // Clear existing field arrows
  app.stage.children
    .filter(child => child.name === 'fieldVector')
    .forEach(child => app.stage.removeChild(child))

  if (charges.length === 0) return
  // const chargesStore = useChargesStore()
  // if (!chargesStore.showForces) return

  // Increase clusterFactor to draw fewer arrows.
  // For example, a factor of 2 draws one arrow per 2x2 block.
  const clusterFactor = 2
  const sampleSpacing = FIELD_SPACING * clusterFactor

  const gridPoints = []
  let maxFieldMagnitude = 0
  let minFieldMagnitude = Infinity

  // Single pass: compute the field vector at each sampled grid point
  for (let x = 0; x < app.screen.width; x += sampleSpacing) {
    for (let y = 0; y < app.screen.height; y += sampleSpacing) {
      const fieldVector = { x: 0, y: 0 }

      // Sum contributions from all charges
      charges.forEach(charge => {
        const chargeField = calculateElectricField(
          charge.position,
          charge.magnitude,
          { x, y },
          charge.polarity === 'positive',
        )
        fieldVector.x += chargeField.x
        fieldVector.y += chargeField.y
      })

      const magnitude = Math.sqrt(fieldVector.x ** 2 + fieldVector.y ** 2)
      if (magnitude > 0) {
        maxFieldMagnitude = Math.max(maxFieldMagnitude, magnitude)
        minFieldMagnitude = Math.min(minFieldMagnitude, magnitude)
      }
      gridPoints.push({ x, y, fieldVector, magnitude })
    }
  }

  // Precompute logarithms for normalization (avoid log(0))
  const logMin = Math.log(minFieldMagnitude || 1e-10)
  const logMax = Math.log(maxFieldMagnitude)

  // Draw arrows for the precomputed grid points
  gridPoints.forEach(point => {
    if (point.magnitude === 0) return

    const logCurrent = Math.log(point.magnitude || 1e-10)
    const normalizedMagnitude = (logCurrent - logMin) / (logMax - logMin)
    const alpha =
      MIN_ALPHA +
      (MAX_ALPHA - MIN_ALPHA) *
        Math.pow(normalizedMagnitude, 1 / LOG_SCALE_FACTOR)
    const length = Math.min(
      point.magnitude * VECTOR_LENGTH_SCALE,
      MAX_VECTOR_LENGTH,
    )

    // Create the arrow for the electric field vector
    const arrow = createElectricFieldArrow({
      length,
      thickness: 2,
      color: colorPalette.fieldVector,
      renderer: app.renderer,
    })

    arrow.name = 'fieldVector'
    arrow.zIndex = 0
    arrow.alpha = alpha
    arrow.position.set(point.x, point.y)
    arrow.rotation = Math.atan2(point.fieldVector.y, point.fieldVector.x)

    app.stage.addChild(arrow)
  })
}

export function drawElectricForce(app: PIXI.Application, force: { direction: { x: number; y: number }; magnitude: number }, position: { x: number; y: number }, isTotal: boolean = false, sourceChargeId?: string, alpha: number = 1.0) {
  // Use object pooling for better performance
  const arrow = getVectorFromPool();
  arrow.name = isTotal ? 'electricForceVector' : `electricForceVector-from-${sourceChargeId || 'unknown'}`;
  arrow.zIndex = 5; // Higher than field vectors but lower than charges

  // Ensure arrow doesn't interfere with mouse events on charges
  arrow.eventMode = 'none'; // PIXI v7
  arrow.interactive = false; // PIXI v6

  // Use different colors and line styles for total vs partial forces
  const color = isTotal ? 0xff0000 : 0x00aaff; // Red for total, Blue for partial
  const lineWidth = isTotal ? 3 : 2; // Thicker line for total force

  arrow.lineStyle(lineWidth, color, alpha);

  // Calculate the force vector endpoint
  // Increase the scale factor to make forces more visible
  const scaleFactor = 200; // Base scale factor

  // Make arrow length proportional to force magnitude
  // But use log scaling to handle wide range of magnitudes
  const magnitude = Math.max(0.001, force.magnitude); // Avoid log(0)
  const logScaledMagnitude = Math.log(magnitude * 1e10 + 1) / Math.log(10);
  const arrowLength = Math.min(scaleFactor * logScaledMagnitude, 300); // Cap maximum length

  const endX = position.x + force.direction.x * arrowLength;
  const endY = position.y + force.direction.y * arrowLength;

  // Draw the main line
  arrow.moveTo(position.x, position.y);
  arrow.lineTo(endX, endY);

  // Draw arrowhead
  const angle = Math.atan2(endY - position.y, endX - position.x);
  const arrowheadSize = isTotal ? ARROWHEAD_LENGTH * 1.2 : ARROWHEAD_LENGTH;

  // Create filled arrowhead
  arrow.beginFill(color, alpha);
  arrow.moveTo(endX, endY);
  arrow.lineTo(
    endX - arrowheadSize * Math.cos(angle - Math.PI / 6),
    endY - arrowheadSize * Math.sin(angle - Math.PI / 6)
  );
  arrow.lineTo(
    endX - arrowheadSize * Math.cos(angle + Math.PI / 6),
    endY - arrowheadSize * Math.sin(angle + Math.PI / 6)
  );
  arrow.lineTo(endX, endY);
  arrow.endFill();

  // If this is a partial force, add a small indicator of the source charge
  if (!isTotal && sourceChargeId) {
    // Position for the indicator (halfway along the force vector)
    const indicatorX = position.x + (force.direction.x * arrowLength * 0.5);
    const indicatorY = position.y + (force.direction.y * arrowLength * 0.5);

    // Create a small dot indicator
    const indicatorSize = 6;
    arrow.beginFill(color, alpha);
    arrow.drawCircle(indicatorX, indicatorY, indicatorSize);
    arrow.endFill();

    // Get or create a simple charge label (C1, C2, etc.)
    let chargeLabel = chargeIdToLabel.get(sourceChargeId);
    if (!chargeLabel) {
      chargeLabel = `C${chargeIdToLabel.size + 1}`;
      chargeIdToLabel.set(sourceChargeId, chargeLabel);
    }

    // Create a non-interactive label using our helper
    const labelName = `label-for-${arrow.name}`;
    const label = createNonInteractiveLabel(
      chargeLabel,
      {
        fontSize: 10,
        fill: color,
        fontWeight: 'bold',
        align: 'center'
      },
      labelName
    );

    label.alpha = alpha;
    label.anchor.set(0.5);
    label.position.set(indicatorX, indicatorY - 10);

    // Add label to stage
    app.stage.addChild(label);
  }

  app.stage.addChild(arrow);
  return arrow;
}

export function drawElectricForceForCharge(app: PIXI.Application, charge: Charge) {
  // Skip if no forces calculated
  if (!charge.electricForce || !charge.electricForce.totalForce) return;

  const totalForce = charge.electricForce.totalForce;

  // Use a higher threshold to avoid drawing very small forces
  // This improves performance by drawing fewer vectors
  const MIN_FORCE_THRESHOLD = 0.00001; // Increased from 0.000001

  // First draw partial forces if they exist - but only if they're significant enough
  if (charge.electricForce.partialForces && charge.electricForce.partialForces.length > 0) {
    // Sort partial forces by magnitude (largest first) to ensure the most significant ones are drawn
    const significantForces = charge.electricForce.partialForces
      .filter(pf => pf.magnitude > MIN_FORCE_THRESHOLD)
      .sort((a, b) => b.magnitude - a.magnitude)
      // Limit the number of partial forces to draw for performance
      .slice(0, 5); // Only show top 5 most significant forces

    // Draw partial forces with lower alpha by default (muted appearance)
    const defaultPartialForceAlpha = 0.5;

    significantForces.forEach((partialForce) => {
      const sourceChargeId = partialForce.sourceChargeId || 'unknown';
      drawElectricForce(app, partialForce, charge.position, false, sourceChargeId, defaultPartialForceAlpha);
    });
  }

  // Always draw the total force on top if it's significant
  if (totalForce.magnitude > MIN_FORCE_THRESHOLD) {
    drawElectricForce(app, totalForce, charge.position, true);
  }
}

export function drawMagneticForce(
  app: PIXI.Application,
  charge: Charge,
  magneticField: { x: number; y: number; z: number },
  //eslint-disable-next-line
  colorPalette: any
) {
  const scaleFactor = app.screen.width < 900 ? 0.6 : 1.0;
  // Remove any existing magnetic force vectors for this charge
  app.stage.children
    .filter(child => child.name === `magneticForceVector-${charge.id}`)
    .forEach(child => app.stage.removeChild(child))

  const magneticForce = calculateMagneticForce(charge, magneticField)
  const scaledForce = normalizeAndScale(magneticForce, VECTOR_LENGTH_SCALE)

  // Calculate the length and then adjust it by the scale factor.
  const length = Math.min(
    Math.sqrt(
      scaledForce.x ** 2 + scaledForce.y ** 2 + (scaledForce.z || 0) ** 2,
    ),
    MAX_VECTOR_LENGTH
  ) / VECTOR_LENGTH_SCALE * scaleFactor

  // Normalize the force using the scaled length
  const normalizedForce = {
    x: (scaledForce.x / length) * length,
    y: (scaledForce.y / length) * length,
  }

  const arrow = new PIXI.Graphics()
  arrow.name = `magneticForceVector-${charge.id}`
  arrow.zIndex = 0

  // Scale the line thickness by the scale factor.
  arrow.lineStyle(10 * scaleFactor, colorPalette.magneticForceVector, 1)

  const startX = charge.position.x
  const startY = charge.position.y
  // Apply scale factor to the arrow's length offset
  const endX = startX + MAG_FORCE_ARROW_FACTOR * normalizedForce.x * scaleFactor
  const endY = startY + MAG_FORCE_ARROW_FACTOR * normalizedForce.y * scaleFactor

  arrow.moveTo(startX, startY)
  arrow.lineTo(endX, endY)

  const angle = Math.atan2(normalizedForce.y, normalizedForce.x)
  // Multiply ARROWHEAD_LENGTH by scaleFactor so arrowheads are appropriately sized
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * scaleFactor * Math.cos(angle - Math.PI / 6),
    endY - ARROWHEAD_LENGTH * scaleFactor * Math.sin(angle - Math.PI / 6)
  )
  arrow.moveTo(endX, endY)
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * scaleFactor * Math.cos(angle + Math.PI / 6),
    endY - ARROWHEAD_LENGTH * scaleFactor * Math.sin(angle + Math.PI / 6)
  )
  arrow.beginFill(colorPalette.magneticForceVector)
  arrow.endFill()
  app.stage.addChild(arrow)

  // Create a label "F" near the arrow
  const forceLabel = new PIXI.Text('F', {
    fontSize: 24 * scaleFactor, // Scale text size
    fill: colorPalette.magneticForceVector,
    fontWeight: 'bold',
  })

  forceLabel.name = `magneticForceVector-label-${charge.id}`
  // Offset the label by a value multiplied by scaleFactor
  forceLabel.x = endX + 10 * scaleFactor
  forceLabel.y = endY - 10 * scaleFactor

  app.stage.addChild(forceLabel)
}

export function drawMagneticField(
  app: PIXI.Application,
  magneticField: { x: number; y: number; z: number },
) {
  if (!app) return

  // Clean up all magnetic and electric field/force elements using pooling
  clearAndPoolVectors(app, child =>
    child.name === 'magneticFieldSymbol' ||
    child.name === 'fieldVector' ||
    child.name === 'electricForceVector' ||
    child.name?.startsWith('electricForceVector-from-')
  );

// to check back here. Conflict resolution. I commented out this nect portion and replace with this clear and pool vector from above.
//   app.stage.children
//     .filter(child => child.name === 'magneticFieldSymbol')
//     .forEach(child => app.stage.removeChild(child));

  const fieldStrength = Math.abs(magneticField.z);
  if (fieldStrength === 0) return;

  const direction = magneticField.z >= 0 ? 'out' : 'in';
  const baseGridSize = FIELD_SPACING;
  const gridSpacing = Math.max(10, baseGridSize - fieldStrength * 5);

  for (let x = gridSpacing / 2; x < app.screen.width; x += gridSpacing) {
    for (let y = gridSpacing / 2; y < app.screen.height; y += gridSpacing) {
      const symbol = createMagneticFieldSymbol(direction, {
        size: 6,
        color: 0xffffff,
        alpha: 0.7,
      });

      symbol.name = 'magneticFieldSymbol';
      symbol.zIndex = 0;
      symbol.position.set(x, y);

      app.stage.addChild(symbol);
    }
  }
}


export function drawMagneticForcesOnAllCharges(
  app: PIXI.Application,
  chargesStore: ChargesStore,
  //eslint-disable-next-line
  colorPalette: any,
) {
  if (!app) return

  // Clear all force vectors (both magnetic and electric) using pooling
  clearAndPoolVectors(app, child =>
    child.name?.startsWith('magneticForceVector-') ||
    child.name === 'electricForceVector' ||
    child.name?.startsWith('electricForceVector-from-')
  );

  // If forces are hidden, don't draw new ones
  if (!chargesStore.showForces) return

  // Draw forces for each charge
  chargesStore.charges.forEach(charge => {
    drawMagneticForce(app!, charge, chargesStore.magneticField, colorPalette)
  })
}

export function drawVelocity(
  app: PIXI.Application,
  charge: Charge,
  //eslint-disable-next-line
  colorPalette: any,
) {
  const scaleFactor = app.screen.width < 900 ? 0.6 : 1.0;
  app.stage.children
    .filter(child => child.name === `velocityVector-${charge.id}`)
    .forEach(child => app.stage.removeChild(child))

  const scaledVelocity = {
    x:
      (charge.velocity.direction.x / charge.velocity.magnitude) *
      VECTOR_LENGTH_SCALE,
    y:
      (charge.velocity.direction.y / charge.velocity.magnitude) *
      VECTOR_LENGTH_SCALE,
  }
  // Multiply the computed length by scaleFactor
  const length = 0.5 * Math.min(
      Math.sqrt(scaledVelocity.x ** 2 + scaledVelocity.y ** 2),
      MAX_VECTOR_LENGTH,
    ) / VECTOR_LENGTH_SCALE * scaleFactor

  const normalizedVelocity = {
    x: (scaledVelocity.x / length) * length,
    y: (scaledVelocity.y / length) * length,
  }

  const arrow = new PIXI.Graphics()
  arrow.name = `velocityVector-${charge.id}`
  arrow.zIndex = 0

  // Multiply line thickness by scaleFactor
  arrow.lineStyle(10 * scaleFactor, colorPalette.velocityVector, 1)

  const startX = charge.position.x
  const startY = charge.position.y
  // Multiply the arrow's extension factor by scaleFactor
  const endX = startX + MAG_FORCE_ARROW_FACTOR * normalizedVelocity.x * scaleFactor
  const endY = startY + MAG_FORCE_ARROW_FACTOR * normalizedVelocity.y * scaleFactor

  arrow.moveTo(startX, startY)
  arrow.lineTo(endX, endY)
  const angle = Math.atan2(normalizedVelocity.y, normalizedVelocity.x)
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * scaleFactor * Math.cos(angle - Math.PI / 6),
    endY - ARROWHEAD_LENGTH * scaleFactor * Math.sin(angle - Math.PI / 6)
  )
  arrow.moveTo(endX, endY)
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * scaleFactor * Math.cos(angle + Math.PI / 6),
    endY - ARROWHEAD_LENGTH * scaleFactor * Math.sin(angle + Math.PI / 6)
  )
  arrow.beginFill(colorPalette.velocityVector)
  arrow.endFill()
  app.stage.addChild(arrow)

  // Create a label "V" near the arrow
  const velocityLabel = new PIXI.Text('V', {
    fontSize: 24 * scaleFactor, // Scale text size
    fill: colorPalette.velocityVector,
    fontWeight: 'bold',
  })

  velocityLabel.name = `velocityVector-label-${charge.id}`
  // Multiply offset values by scaleFactor
  velocityLabel.x = endX + 10 * scaleFactor
  velocityLabel.y = endY - 10 * scaleFactor

  app.stage.addChild(velocityLabel)
}

export function drawVelocityOnAllCharges(
  app: PIXI.Application,
  chargesStore: ChargesStore,
  //eslint-disable-next-line
  colorPalette: any,
) {
  if (!app) return
  app.stage.children
    .filter(child => child.name?.startsWith('velocityVector-'))
    .forEach(child => app!.stage.removeChild(child))

  chargesStore.charges.forEach(charge => {
    drawVelocity(app!, charge, colorPalette)
  })
}

// Function to reset the charge label mapping
export function resetChargeLabelMapping() {
  chargeIdToLabel.clear();
}

// Helper function to create a non-interactive label
export function createNonInteractiveLabel(
  text: string,
  options: PIXI.TextStyle | Partial<PIXI.TextStyle> | undefined,
  name: string
) {
  const label = new PIXI.Text(text, options);
  label.name = name;

  // Ensure label doesn't interfere with mouse events
  label.eventMode = 'none'; // PIXI v7
  label.interactive = false; // PIXI v6

  return label;
}

// Clear all force vectors and their labels
export function removeAllForceElements(app: PIXI.Application) {
  if (!app) return;

  // Clean up all force vectors and their labels using pooling
  clearAndPoolVectors(app, child =>
    child.name === 'electricForceVector' ||
    child.name?.startsWith('electricForceVector-from-')
  );

  // Remove all force-related labels (which aren't pooled)
  app.stage.children
    .filter(child => child.name?.startsWith('label-for-'))
    .forEach(child => app.stage.removeChild(child));

  // Reset the charge label mapping
  resetChargeLabelMapping();
}
