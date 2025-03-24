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
  if (!app) return;

  app.stage.children
    .filter(child => child.name === 'magneticFieldSymbol')
    .forEach(child => app.stage.removeChild(child));

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
  app.stage.children
    .filter(child => child.name?.startsWith('magneticForceVector-'))
    .forEach(child => app!.stage.removeChild(child))

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
