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
  VELOCITY_ARROW_COLOUR,
} from '../consts'

const MIN_ALPHA = 0.15
const MAX_ALPHA = 1.0
const LOG_SCALE_FACTOR = 2

export function drawElectricField(app: PIXI.Application, charges: Charge[]) {
  app.stage.children
    .filter(child => child.name === 'fieldVector')
    .forEach(child => app.stage.removeChild(child))

  if (charges.length === 0) return

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

  // Create a label "V" near the arrow
  const forceLabel = new PIXI.Text("F", {
    fontSize: 24,
    fill: 0xffffff, // White color for contrast
    fontWeight: "bold",
  });

  forceLabel.name = `forceVector-label-${charge.id}`;

  // Position the label slightly offset from the arrow tip
  forceLabel.x = endX + 10; // Offset for better visibility
  forceLabel.y = endY - 10;

  app.stage.addChild(forceLabel);
}

export function drawMagneticField(
  app: PIXI.Application,
  magneticField: { x: number; y: number; z: number },
) {
  if (!app) return
  app.stage.children
    .filter(child => child.name === 'magneticFieldSymbol')
    .forEach(child => app.stage.removeChild(child))

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
  app.stage.children
    .filter(child => child.name?.startsWith('magneticForceVector-'))
    .forEach(child => app!.stage.removeChild(child))

  chargesStore.charges.forEach(charge => {
    drawMagneticForce(app!, charge, chargesStore.magneticField)
  })
}

export function drawVelocity(
  app: PIXI.Application,
  charge: Charge,
) {
  console.log("We be drawin")
  app.stage.children
    .filter(child => child.name === `velocityVector-${charge.id}`)
    .forEach(child => app.stage.removeChild(child))

  const scaledVelocity = {
    x: (charge.velocity.direction.x / charge.velocity.magnitude) * VECTOR_LENGTH_SCALE,
    y: (charge.velocity.direction.y / charge.velocity.magnitude) * VECTOR_LENGTH_SCALE
  }
  const length =
    Math.min(
      Math.sqrt(
        scaledVelocity.x ** 2 + scaledVelocity.y ** 2,
      ),
      MAX_VECTOR_LENGTH,
    ) / VECTOR_LENGTH_SCALE

  const normalizedVelocity = {
    x: (scaledVelocity.x / length) * length,
    y: (scaledVelocity.y / length) * length,
  }
  
  const arrow = new PIXI.Graphics()
  arrow.name = `velocityVector-${charge.id}`
  // Ensure arrows are rendered behind charges
  arrow.zIndex = 0
  arrow.lineStyle(10, VELOCITY_ARROW_COLOUR, 1)
  const startX = charge.position.x
  const startY = charge.position.y
  const endX = startX + MAG_FORCE_ARROW_FACTOR * normalizedVelocity.x
  const endY = startY + MAG_FORCE_ARROW_FACTOR * normalizedVelocity.y
  arrow.moveTo(startX, startY)
  arrow.lineTo(endX, endY)
  const angle = Math.atan2(normalizedVelocity.y, normalizedVelocity.x)
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * Math.cos(angle - Math.PI / 6),
    endY - ARROWHEAD_LENGTH * Math.sin(angle - Math.PI / 6),
  )
  arrow.moveTo(endX, endY)
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * Math.cos(angle + Math.PI / 6),
    endY - ARROWHEAD_LENGTH * Math.sin(angle + Math.PI / 6),
  )
  arrow.beginFill(0xffffff)
  arrow.endFill()
  app.stage.addChild(arrow)

  // Create a label "V" near the arrow
  const velocityLabel = new PIXI.Text("V", {
    fontSize: 24,
    fill: 0xffffff, // White color for contrast
    fontWeight: "bold",
  });

  velocityLabel.name = `velocityVector-label-${charge.id}`;

  // Position the label slightly offset from the arrow tip
  velocityLabel.x = endX + 10; // Offset for better visibility
  velocityLabel.y = endY - 10;

  app.stage.addChild(velocityLabel);
}

export function drawVelocityOnAllCharges(
  app: PIXI.Application,
  chargesStore: ChargesStore,
) {
  if (!app) return
  app.stage.children
    .filter(child => child.name?.startsWith('velocityVector-'))
    .forEach(child => app!.stage.removeChild(child))
  
  chargesStore.charges.forEach(charge => {
    drawVelocity(app!, charge)
  })
}