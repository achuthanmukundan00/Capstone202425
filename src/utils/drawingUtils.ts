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
  MAG_FORCE_ARROW_COLOUR,
  MAG_FORCE_ARROW_FACTOR,
} from '../consts'

const MIN_ALPHA = 0.15
const MAX_ALPHA = 1.0
const LOG_SCALE_FACTOR = 2

// Object pool for force vectors to avoid creating/destroying graphics objects
// This significantly improves performance when redrawing forces frequently
const forceVectorPool: PIXI.Graphics[] = [];
const MAX_POOL_SIZE = 100;

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

export function drawElectricField(app: PIXI.Application, charges: Charge[]) {
  app.stage.children
    .filter(child => child.name === 'fieldVector')
    .forEach(child => app.stage.removeChild(child))

  if (charges.length === 0) return
  // const chargesStore = useChargesStore()
  // if (!chargesStore.showForces) return
  let maxFieldMagnitude = 0
  let minFieldMagnitude = Infinity

  for (let x = 0; x < app.screen.width; x += FIELD_SPACING) {
    for (let y = 0; y < app.screen.height; y += FIELD_SPACING) {
      const fieldVector = { x: 0, y: 0 }
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
      maxFieldMagnitude = Math.max(maxFieldMagnitude, magnitude)
      if (magnitude > 0) {
        minFieldMagnitude = Math.min(minFieldMagnitude, magnitude)
      }
    }
  }

  for (let x = 0; x < app.screen.width; x += FIELD_SPACING) {
    for (let y = 0; y < app.screen.height; y += FIELD_SPACING) {
      const fieldVector = { x: 0, y: 0 }
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
      const logMin = Math.log(minFieldMagnitude || 1e-10)
      const logMax = Math.log(maxFieldMagnitude)
      const logCurrent = Math.log(magnitude || 1e-10)
      const normalizedMagnitude = (logCurrent - logMin) / (logMax - logMin)
      const alpha =
        MIN_ALPHA +
        (MAX_ALPHA - MIN_ALPHA) *
          Math.pow(normalizedMagnitude, 1 / LOG_SCALE_FACTOR)
      const length = Math.min(
        magnitude * VECTOR_LENGTH_SCALE,
        MAX_VECTOR_LENGTH,
      )
      const normalizedVector = {
        x: (fieldVector.x / magnitude) * length,
        y: (fieldVector.y / magnitude) * length,
      }

      const arrow = new PIXI.Graphics()
      arrow.name = 'fieldVector'
      // Set arrow zIndex low so charges render above them
      arrow.zIndex = 0
      arrow.lineStyle(2, 0xffffff, alpha)
      arrow.moveTo(x, y)
      const endX = x + normalizedVector.x
      const endY = y + normalizedVector.y
      arrow.lineTo(endX, endY)
      const angle = Math.atan2(normalizedVector.y, normalizedVector.x)
      arrow.lineTo(
        endX - ARROWHEAD_LENGTH * Math.cos(angle - Math.PI / 6),
        endY - ARROWHEAD_LENGTH * Math.sin(angle - Math.PI / 6),
      )
      arrow.moveTo(endX, endY)
      arrow.lineTo(
        endX - ARROWHEAD_LENGTH * Math.cos(angle + Math.PI / 6),
        endY - ARROWHEAD_LENGTH * Math.sin(angle + Math.PI / 6),
      )
      arrow.beginFill(0xffffff, alpha)
      arrow.endFill()
      app.stage.addChild(arrow)
    }
  }
}

export function drawElectricForce(app: PIXI.Application, force: { direction: { x: number; y: number }; magnitude: number }, position: { x: number; y: number }, isTotal: boolean = false, sourceChargeId?: string) {
  // Use object pooling for better performance
  const arrow = getVectorFromPool();
  arrow.name = isTotal ? 'electricForceVector' : `electricForceVector-from-${sourceChargeId || 'unknown'}`;
  arrow.zIndex = 5; // Higher than field vectors but lower than charges

  // Use different colors and line styles for total vs partial forces
  const color = isTotal ? 0xff0000 : 0x00aaff; // Red for total, Blue for partial
  const lineWidth = isTotal ? 3 : 2; // Thicker line for total force

  arrow.lineStyle(lineWidth, color, 1);

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
  arrow.beginFill(color);
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

    significantForces.forEach((partialForce) => {
      const sourceChargeId = partialForce.sourceChargeId || 'unknown';
      drawElectricForce(app, partialForce, charge.position, false, sourceChargeId);
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
) {
  app.stage.children
    .filter(child => child.name === `magneticForceVector-${charge.id}`)
    .forEach(child => app.stage.removeChild(child))

  const magneticForce = calculateMagneticForce(charge, magneticField)
  const scaledForce = normalizeAndScale(magneticForce, VECTOR_LENGTH_SCALE)
  const length =
    Math.min(
      Math.sqrt(
        scaledForce.x ** 2 + scaledForce.y ** 2 + (scaledForce.z || 0) ** 2,
      ),
      MAX_VECTOR_LENGTH,
    ) / VECTOR_LENGTH_SCALE

  const normalizedForce = {
    x: (scaledForce.x / length) * length,
    y: (scaledForce.y / length) * length,
  }

  const arrow = new PIXI.Graphics()
  arrow.name = `magneticForceVector-${charge.id}`
  // Ensure arrows are rendered behind charges
  arrow.zIndex = 0
  arrow.lineStyle(10, MAG_FORCE_ARROW_COLOUR, 1)
  const startX = charge.position.x
  const startY = charge.position.y
  const endX = startX + MAG_FORCE_ARROW_FACTOR * normalizedForce.x
  const endY = startY + MAG_FORCE_ARROW_FACTOR * normalizedForce.y
  arrow.moveTo(startX, startY)
  arrow.lineTo(endX, endY)
  const angle = Math.atan2(normalizedForce.y, normalizedForce.x)
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * Math.cos(angle - Math.PI / 6),
    endY - ARROWHEAD_LENGTH * Math.sin(angle - Math.PI / 6),
  )
  arrow.moveTo(endX, endY)
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * Math.cos(angle + Math.PI / 6),
    endY - ARROWHEAD_LENGTH * Math.sin(angle + Math.PI / 6),
  )
  arrow.beginFill(0x6832a8)
  arrow.endFill()
  app.stage.addChild(arrow)
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

  const fieldStrength = Math.abs(magneticField.z)
  if (fieldStrength === 0) return

  const fieldDirection = magneticField.z >= 0 ? 'out' : 'in'
  const baseGridSize = FIELD_SPACING
  const gridSpacing = Math.max(10, baseGridSize - fieldStrength * 5)

  for (let x = gridSpacing / 2; x < app.screen.width; x += gridSpacing) {
    for (let y = gridSpacing / 2; y < app.screen.height; y += gridSpacing) {
      const symbol = new PIXI.Text(fieldDirection === 'out' ? '×' : '•', {
        fontFamily: 'Arial',
        fontSize: Math.max(10, 20 - fieldStrength),
        fill: '#ffffff',
        align: 'center',
      })
      symbol.name = 'magneticFieldSymbol'
      // Lower zIndex so symbols are drawn behind charges
      symbol.zIndex = 0
      symbol.x = x
      symbol.y = y
      symbol.anchor.set(0.5)
      app.stage.addChild(symbol)
    }
  }
}

export function drawMagneticForcesOnAllCharges(
  app: PIXI.Application,
  chargesStore: ChargesStore,
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
    drawMagneticForce(app!, charge, chargesStore.magneticField)
  })
}
