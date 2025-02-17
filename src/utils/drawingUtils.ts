import * as PIXI from 'pixi.js';
import { calculateElectricField, calculateMagneticForce, normalizeAndScale } from './mathUtils';
import type { Charge } from '@/stores/charges';
import type { ChargesStore } from '@/stores/charges';
import { FIELD_SPACING, VECTOR_LENGTH_SCALE, MAX_VECTOR_LENGTH, ARROWHEAD_LENGTH, MAG_FORCE_ARROW_COLOUR, MAG_FORCE_ARROW_FACTOR } from '../consts';

// Update constants at the top of the file
const MIN_ALPHA = 0.15;  // Slightly lower minimum for better contrast
const MAX_ALPHA = 1.0;   // Keep maximum the same
const LOG_SCALE_FACTOR = 2; // Adjust this to control sensitivity of brightness changes

export function drawElectricField(app: PIXI.Application, charges: Charge[]) {
  // Clear existing field graphics
  app.stage.children
    .filter(child => child.name === 'fieldVector')
    .forEach(child => app.stage.removeChild(child));

  if (charges.length === 0) return; // Don't draw anything if there are no charges

  let maxFieldMagnitude = 0;
  let minFieldMagnitude = Infinity;  // Track minimum magnitude as well

  // First pass: calculate magnitude range
  for (let x = 0; x < app.screen.width; x += FIELD_SPACING) {
    for (let y = 0; y < app.screen.height; y += FIELD_SPACING) {
      const fieldVector = { x: 0, y: 0 };
      charges.forEach(charge => {
        const chargeField = calculateElectricField(
          charge.position,
          charge.magnitude,
          { x, y },
          charge.polarity === 'positive'
        );
        fieldVector.x += chargeField.x;
        fieldVector.y += chargeField.y;
      });

      const magnitude = Math.sqrt(fieldVector.x ** 2 + fieldVector.y ** 2);
      maxFieldMagnitude = Math.max(maxFieldMagnitude, magnitude);
      if (magnitude > 0) {  // Ignore zero field points
        minFieldMagnitude = Math.min(minFieldMagnitude, magnitude);
      }
    }
  }

  // Second pass: draw vectors with logarithmic alpha scaling
  for (let x = 0; x < app.screen.width; x += FIELD_SPACING) {
    for (let y = 0; y < app.screen.height; y += FIELD_SPACING) {
      const fieldVector = { x: 0, y: 0 };
      charges.forEach(charge => {
        const chargeField = calculateElectricField(
          charge.position,
          charge.magnitude,
          { x, y },
          charge.polarity === 'positive'
        );
        fieldVector.x += chargeField.x;
        fieldVector.y += chargeField.y;
      });

      const magnitude = Math.sqrt(fieldVector.x ** 2 + fieldVector.y ** 2);

      // Use logarithmic scaling for alpha
      const logMin = Math.log(minFieldMagnitude || 1e-10);
      const logMax = Math.log(maxFieldMagnitude);
      const logCurrent = Math.log(magnitude || 1e-10);

      // Calculate normalized alpha using log scale
      const normalizedMagnitude =
        (logCurrent - logMin) / (logMax - logMin);

      // Apply exponential scaling for more dramatic differences
      const alpha = MIN_ALPHA +
        (MAX_ALPHA - MIN_ALPHA) * Math.pow(normalizedMagnitude, 1/LOG_SCALE_FACTOR);

      // Scale the vector length based on the field strength
      const length = Math.min(magnitude * VECTOR_LENGTH_SCALE, MAX_VECTOR_LENGTH);
      const normalizedVector = {
        x: (fieldVector.x / magnitude) * length,
        y: (fieldVector.y / magnitude) * length
      };

      // Draw the vector as an arrow with calculated alpha
      const arrow = new PIXI.Graphics();
      arrow.name = 'fieldVector';
      arrow.lineStyle(2, 0xffffff, alpha); // Use calculated alpha for line opacity

      // Draw main line
      arrow.moveTo(x, y);
      const endX = x + normalizedVector.x;
      const endY = y + normalizedVector.y;
      arrow.lineTo(endX, endY);

      // Calculate arrowhead angle
      const angle = Math.atan2(normalizedVector.y, normalizedVector.x);

      // Draw arrowhead
      arrow.lineTo(
        endX - ARROWHEAD_LENGTH * Math.cos(angle - Math.PI / 6),
        endY - ARROWHEAD_LENGTH * Math.sin(angle - Math.PI / 6)
      );
      arrow.moveTo(endX, endY);
      arrow.lineTo(
        endX - ARROWHEAD_LENGTH * Math.cos(angle + Math.PI / 6),
        endY - ARROWHEAD_LENGTH * Math.sin(angle + Math.PI / 6)
      );

      arrow.beginFill(0xffffff, alpha); // Use same alpha for fill
      arrow.endFill();

      app.stage.addChild(arrow);
    }
  }
}

export function drawMagneticForce(
  app: PIXI.Application,
  charge: Charge,
  magneticField: { x: number; y: number; z: number }
) {
  // Clear existing magnetic force vector
  app.stage.children
    .filter(child => child.name === `magneticForceVector-${charge.id}`)
    .forEach(child => app.stage.removeChild(child));

  // Calculate the magnetic force vector on the charge
  const magneticForce = calculateMagneticForce(charge, magneticField);

  // Normalize and scale the vector for visualization
  const scaledForce = normalizeAndScale(magneticForce, VECTOR_LENGTH_SCALE);
  const length = Math.min(
    Math.sqrt(scaledForce.x ** 2 + scaledForce.y ** 2 + (scaledForce.z || 0) ** 2),
    MAX_VECTOR_LENGTH
  ) / VECTOR_LENGTH_SCALE;

  const normalizedForce = {
    x: (scaledForce.x / length) * length,
    y: (scaledForce.y / length) * length,
  };

  // Create a PIXI Graphics object for the arrow
  const arrow = new PIXI.Graphics();
  arrow.name = `magneticForceVector-${charge.id}`;
  arrow.lineStyle(10, MAG_FORCE_ARROW_COLOUR, 1);

  // Anchor the tail of the vector at the charge's position
  const startX = charge.position.x;
  const startY = charge.position.y;
  // Calculate the tip of the vector
  const endX = startX + MAG_FORCE_ARROW_FACTOR * normalizedForce.x;
  const endY = startY + MAG_FORCE_ARROW_FACTOR * normalizedForce.y;

  // Draw the main line for the vector
  arrow.moveTo(startX, startY);
  arrow.lineTo(endX, endY);

  // Calculate the angle of the vector for arrowhead direction
  const angle = Math.atan2(normalizedForce.y, normalizedForce.x);

  // Draw the arrowhead
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * Math.cos(angle - Math.PI / 6),
    endY - ARROWHEAD_LENGTH * Math.sin(angle - Math.PI / 6)
  );
  arrow.moveTo(endX, endY);
  arrow.lineTo(
    endX - ARROWHEAD_LENGTH * Math.cos(angle + Math.PI / 6),
    endY - ARROWHEAD_LENGTH * Math.sin(angle + Math.PI / 6)
  );

  arrow.beginFill(0x6832a8);
  arrow.endFill();

  // Add the arrow to the stage
  app.stage.addChild(arrow);
}

export function drawMagneticField(app: PIXI.Application, magneticField: { x: number; y: number; z: number }) {
  if (!app) {
    return
  }
  // Clear existing magnetic field graphics
  app.stage.children
    .filter(child => child.name === 'magneticFieldSymbol')
    .forEach(child => app.stage.removeChild(child));


  const fieldStrength = Math.abs(magneticField.z);
  if (fieldStrength === 0) {
    return;
  }

  const fieldDirection = magneticField.z >= 0 ? 'out' : 'in';

  // Adjust grid density based on field strength
  const baseGridSize = FIELD_SPACING;
  const gridSpacing = Math.max(10, baseGridSize - fieldStrength * 5); // Closer spacing for stronger fields

  for (let x = gridSpacing / 2; x < app.screen.width; x += gridSpacing) {
    for (let y = gridSpacing / 2; y < app.screen.height; y += gridSpacing) {
      const symbol = new PIXI.Text(fieldDirection === 'out' ? '×' : '•', {
        fontFamily: 'Arial',
        fontSize: Math.max(10, 20 - fieldStrength), // Adjust size dynamically
        fill: '#ffffff',
        align: 'center',
      });

      symbol.name = 'magneticFieldSymbol';
      symbol.x = x;
      symbol.y = y;
      symbol.anchor.set(0.5);

      app.stage.addChild(symbol);
    }
  }
}
export function drawMagneticForcesOnAllCharges(app: PIXI.Application, chargesStore: ChargesStore) {
  if (!app) {
    return
  }
  // Clear previous force vectors
  app.stage.children
    .filter(child => child.name?.startsWith('magneticForceVector-'))
    .forEach(child => app!.stage.removeChild(child));

  // Draw force for each charge
  chargesStore.charges.forEach((charge) => {
    drawMagneticForce(app!, charge, chargesStore.magneticField);
  });
};
