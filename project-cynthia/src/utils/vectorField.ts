import * as PIXI from 'pixi.js';
import { calculateElectricField, normalizeAndScale } from './mathUtils';
import type { Charge } from '@/stores/charges';

const FIELD_SPACING = 50; // Spacing between field vectors in pixels
const VECTOR_LENGTH_SCALE = 5e5; // Scaling factor for vector length

export function drawElectricField(app: PIXI.Application, charges: Charge[]) {
    // Clear existing field graphics
    app.stage.children
        .filter(child => child.name === 'fieldVector')
        .forEach(child => app.stage.removeChild(child));

    // Generate field vectors across a grid
    for (let x = 0; x < app.screen.width; x += FIELD_SPACING) {
        for (let y = 0; y < app.screen.height; y += FIELD_SPACING) {
            let fieldVector = { x: 0, y: 0 };

            // Sum the field contributions from all charges
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

            // Scale and normalize the field vector
            const normalizedVector = normalizeAndScale(fieldVector, VECTOR_LENGTH_SCALE);

            // Draw the vector as an arrow
            const arrow = new PIXI.Graphics();
            arrow.name = 'fieldVector';
            arrow.lineStyle(1, 0x00ff00, 0.6); // Green color for vectors

            // Draw line for the vector
            arrow.moveTo(x, y);
            arrow.lineTo(x + normalizedVector.x, y + normalizedVector.y);

            // Draw arrowhead
            const angle = Math.atan2(normalizedVector.y, normalizedVector.x);
            arrow.lineTo(
                x + normalizedVector.x - 5 * Math.cos(angle - Math.PI / 6),
                y + normalizedVector.y - 5 * Math.sin(angle - Math.PI / 6)
            );
            arrow.moveTo(x + normalizedVector.x, y + normalizedVector.y);
            arrow.lineTo(
                x + normalizedVector.x - 5 * Math.cos(angle + Math.PI / 6),
                y + normalizedVector.y - 5 * Math.sin(angle + Math.PI / 6)
            );

            app.stage.addChild(arrow);
        }
    }
}
