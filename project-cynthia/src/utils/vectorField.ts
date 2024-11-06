import * as PIXI from 'pixi.js';
import { calculateElectricField, normalizeAndScale } from './mathUtils';
import type { Charge } from '@/stores/charges';

const FIELD_SPACING = 64; // Spacing between field vectors in pixels
const VECTOR_LENGTH_SCALE = 20; // Scaling factor for vector length
const ARROWHEAD_LENGTH = 8; // Length of the arrowhead

export function drawElectricField(app: PIXI.Application, charges: Charge[]) {    
    // Clear existing field graphics
    app.stage.children
        .filter(child => child.name === 'fieldVector')
        .forEach(child => app.stage.removeChild(child));
        
    // Generate field vectors across a grid
    for (let x = 0; x < app.screen.width; x += FIELD_SPACING) {
        for (let y = 0; y < app.screen.height; y += FIELD_SPACING) {
            let fieldVector = { x: 0, y: 0 };
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
            arrow.lineStyle(2, 0xffffff, 1); // Red color for better visibility

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

            arrow.beginFill(0xffffff); // Blue color for test rectangles
            arrow.endFill();

            // Add the arrow to the stage
            app.stage.addChild(arrow);
        }
    }
}
