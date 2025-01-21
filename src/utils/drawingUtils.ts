import * as PIXI from 'pixi.js';
import { calculateElectricField, calculateMagneticForce, normalizeAndScale } from './mathUtils';
import type { Charge } from '@/stores/charges';
import { FIELD_SPACING, VECTOR_LENGTH_SCALE, MAX_VECTOR_LENGTH, ARROWHEAD_LENGTH } from '../consts';

export function drawElectricField(app: PIXI.Application, charges: Charge[]) {
    // Clear existing field graphics
    app.stage.children
        .filter(child => child.name === 'fieldVector')
        .forEach(child => app.stage.removeChild(child));

    // Generate field vectors across a grid
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

            // Calculate the magnitude of the field vector
            const magnitude = Math.sqrt(fieldVector.x ** 2 + fieldVector.y ** 2);

            // Scale the vector length based on the field strength
            const length = Math.min(magnitude * VECTOR_LENGTH_SCALE, MAX_VECTOR_LENGTH);
            const normalizedVector = {
                x: (fieldVector.x / magnitude) * length,
                y: (fieldVector.y / magnitude) * length
            };

            // Draw the vector as an arrow
            const arrow = new PIXI.Graphics();
            arrow.name = 'fieldVector';
            arrow.lineStyle(2, 0xffffff, 1);

            // Draw main line for the vector
            arrow.moveTo(x, y);
            const endX = x + normalizedVector.x;
            const endY = y + normalizedVector.y;
            arrow.lineTo(endX, endY);

            // Calculate the angle of the vector for arrowhead direction
            const angle = Math.atan2(normalizedVector.y, normalizedVector.x);

            // Draw arrowhead on the end of the vector
            arrow.lineTo(
                endX - ARROWHEAD_LENGTH * Math.cos(angle - Math.PI / 6),
                endY - ARROWHEAD_LENGTH * Math.sin(angle - Math.PI / 6)
            );
            arrow.moveTo(endX, endY);
            arrow.lineTo(
                endX - ARROWHEAD_LENGTH * Math.cos(angle + Math.PI / 6),
                endY - ARROWHEAD_LENGTH * Math.sin(angle + Math.PI / 6)
            );

            arrow.beginFill(0xffffff);
            arrow.endFill();

            // Add the arrow to the stage
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
  );

  const normalizedForce = {
    x: (scaledForce.x / length) * length,
    y: (scaledForce.y / length) * length,
  };

  // Create a PIXI Graphics object for the arrow
  const arrow = new PIXI.Graphics();
  arrow.name = `magneticForceVector-${charge.id}`;
  arrow.lineStyle(2, 0xff0000, 1); // Red color for magnetic force vectors

  // Anchor the tail of the vector at the charge's position
  const startX = charge.position.x;
  const startY = charge.position.y;

  // Calculate the tip of the vector
  const endX = startX + normalizedForce.x;
  const endY = startY + normalizedForce.y;

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

  arrow.beginFill(0xff0000);
  arrow.endFill();

  // Add the arrow to the stage
  app.stage.addChild(arrow);
}
