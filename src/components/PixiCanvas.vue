<template>
  <div ref="canvasContainer" style="width: 100%; height: 100%;" class="canvas-container">
    <div class="field-readout">{{ fieldReadout }}</div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import * as PIXI from 'pixi.js';
import type { Charge } from '@/stores/charges';
import { AnimationMode, useChargesStore } from '@/stores/charges';
import {
  drawElectricField,
  drawMagneticField,
  drawMagneticForcesOnAllCharges,
  drawVelocityOnAllCharges,
  removeFields,
  removeAllForceElements,
  resetChargeLabelMapping,
  drawElectricForcesGrid,
  drawElectricForcesGridDuringDrag,
  highlightForcesFromCharge
} from '@/utils/drawingUtils';
import { calculateMagneticForce, calculateElectricField } from '@/utils/mathUtils';
import { ANIMATION_SPEED, FORCE_SCALING, FIELD_SPACING, VECTOR_LENGTH_SCALE, MAX_VECTOR_LENGTH, MAX_GRAPHIC_POOL_SIZE } from '@/consts';
import { getNetElectricFieldAtPoint } from '@/utils/mathUtils'
import { useSettingsStore } from '@/stores/settings'
import { ColorPalettes } from '@/utils/colorPalettes'

// Debugging utilities for force arrow flickering
const DEBUG_FORCES = false; // Set to true to enable force vector debugging
const forceOperations = new Map<string, {
  createdAt: number,
  updates: Array<{ timestamp: number, operation: string, alpha?: number }>
}>();

// Only used when DEBUG_FORCES is true
// function logForceOperation(vectorId: string, operation: string, details: Record<string, unknown> = {}) {
//   if (!DEBUG_FORCES) return;

//   const now = Date.now();
//   const timestamp = performance.now().toFixed(2);

//   if (!forceOperations.has(vectorId)) {
//     forceOperations.set(vectorId, {
//       createdAt: now,
//       updates: []
//     });
//     console.log(`[${timestamp}] Force vector ${vectorId}: ${operation}`, details);
//   } else {
//     const entry = forceOperations.get(vectorId)!;
//     entry.updates.push({
//       timestamp: now,
//       operation,
//       ...details
//     });

//     // Log if we're seeing rapid updates within a short time window
//     const recentUpdates = entry.updates.filter(u => now - u.timestamp < 100).length;
//     if (recentUpdates > 2) {
//       console.warn(`[${timestamp}] Force vector ${vectorId}: ${operation} - ${recentUpdates} updates in last 100ms!`, details);
//     } else {
//       console.log(`[${timestamp}] Force vector ${vectorId}: ${operation}`, details);
//     }

//     // Keep only recent history to avoid memory bloat
//     if (entry.updates.length > 20) {
//       entry.updates = entry.updates.slice(-10);
//     }
//   }
// }

const graphicsPool: PIXI.Graphics[] = [];

function getGraphics(): PIXI.Graphics {
  if (graphicsPool.length > 0) {
    return graphicsPool.pop()!;
  }
  return new PIXI.Graphics(); // Create a new graphic if none are available
}

function releaseGraphics(graphic: PIXI.Graphics) {
  graphic.clear();
  graphic.visible = false;

  if (graphicsPool.length < MAX_GRAPHIC_POOL_SIZE) {
    graphicsPool.push(graphic);
  }
}

const emit = defineEmits(['chargeOffScreen']);

function isChargeOffScreen(charge: Charge): boolean {
  if (!app) return false;
  const { x, y } = charge.position;
  const { width, height } = app.view;
  return x < -50 || x > width + 50 || y < -50 || y > height + 50;
}

function checkChargesOffScreen() {
  const charges = Array.from(chargesStore.charges.values());
  if (charges.some(isChargeOffScreen)) {
    console.warn('Charge went off-screen. Emitting event to stop/reset animation.');
    emit('chargeOffScreen');
  }
}


function clearForceOperationLogs() {
  if (!DEBUG_FORCES) return;
  console.log(`[${performance.now().toFixed(2)}] Clearing force operation logs`);
  forceOperations.clear();
}

const settingsStore = useSettingsStore()
// Compute the palette based on the mode
const palette = computed(() => {
  return ColorPalettes[settingsStore.colorblindMode]
})

// Constants used for field drawing
const MIN_ALPHA = 0.15;
const MAX_ALPHA = 1.0;
const LOG_SCALE_FACTOR = 2;

// Batch update flag to reduce reactivity triggers
let isBatchingUpdates = false;

// Debounce function to limit how often force updates occur
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  return (...args: Parameters<T>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
      timeout = null;
    }, delay) as unknown as number;
  };
}

const fieldReadout = ref('');
const canvasContainer = ref<HTMLElement | null>(null);
const chargesStore = useChargesStore();
const chargesGraphics = new Map<string, PIXI.Graphics>(); // Map to keep track of drawn charges
const trailGraphicsMap = new Map<string, PIXI.Graphics>(); // keep track of drawn trails (k: charge.id, value: trail)

let app: PIXI.Application | null = null;
let lastForceUpdateTime = 0;
const FORCE_UPDATE_THROTTLE = 100; // Only update forces every 50ms during drag (was 100ms)
let isDragging = false;
let needsForceUpdate = false;
let isUpdatingForces = false; // Flag to prevent simultaneous force calculations

const MOVEMENT_STEP = 10; // pixels per keypress

// Additional flags to stabilize force rendering
let lastForceRenderState = {
  charges: [] as Charge[],
  timestamp: 0
};

const FORCE_STABILITY_THRESHOLD = 500; // ms - minimum time between force updates when nothing is changing

// Function to detect if charges are very close to each other (causes potential instability)
function detectChargeProximity() {
  if (!DEBUG_FORCES || !chargesStore.showForces) return;

  const charges = chargesStore.charges;
  if (charges.length < 2) return;

  const MIN_DISTANCE = 50; // Charges closer than this might cause instability
  const closeCharges = [];

  for (let i = 0; i < charges.length; i++) {
    for (let j = i + 1; j < charges.length; j++) {
      const charge1 = charges[i];
      const charge2 = charges[j];

      const dx = charge2.position.x - charge1.position.x;
      const dy = charge2.position.y - charge1.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MIN_DISTANCE) {
        closeCharges.push({
          id1: charge1.id,
          id2: charge2.id,
          distance: distance.toFixed(1)
        });
      }
    }
  }

  if (closeCharges.length > 0) {
    console.warn(`[${performance.now().toFixed(2)}] Detected ${closeCharges.length} close charge pairs that might cause force instability:`, closeCharges);
  }
}

// Function to actually update the forces
function updateElectricForcesImpl() {
  if (!app || isUpdatingForces || !chargesStore.showForces) return;

  // First check if we really need to update
  const now = performance.now();
  const timeSinceLastUpdate = now - lastForceRenderState.timestamp;

  // If it's been less than our stability threshold, and we have the same number of charges,
  // we'll skip this update unless we're dragging or have an explicit force update request
  if (timeSinceLastUpdate < FORCE_STABILITY_THRESHOLD &&
    chargesStore.charges.length === lastForceRenderState.charges.length &&
    !isDragging && !needsForceUpdate) {

    // Check if any charge positions have changed significantly
    const positionsChanged = chargesStore.charges.some((charge, index) => {
      const lastCharge = lastForceRenderState.charges[index];
      if (!lastCharge) return true;

      // Check if position has changed by more than 1 pixel
      const dx = Math.abs(charge.position.x - lastCharge.position.x);
      const dy = Math.abs(charge.position.y - lastCharge.position.y);
      return dx > 1 || dy > 1 || charge.id !== lastCharge.id;
    });

    if (!positionsChanged) {
      if (DEBUG_FORCES) {
        console.log(`[${now.toFixed(2)}] Skipping force update, no changes detected and only ${timeSinceLastUpdate.toFixed(0)}ms since last update`);
      }
      return;
    }
  }

  // Check for charges that are too close (potential instability)
  detectChargeProximity();

  if (DEBUG_FORCES) {
    console.log(`[${now.toFixed(2)}] Starting force update, charges: ${chargesStore.charges.length}`);
  }

  // Set the flag to prevent simultaneous updates
  isUpdatingForces = true;

  try {
    // Use non-null assertion since we already checked app is not null
    const application = app!;

    // Use our new grid-based force drawing approach
    drawElectricForcesGrid(application, chargesStore.charges);

    // Update our last render state with a deep copy of the charges
    lastForceRenderState = {
      charges: JSON.parse(JSON.stringify(chargesStore.charges)),
      timestamp: now
    };

    needsForceUpdate = false;
  } finally {
    // Always clear the flag when done, even if there was an error
    isUpdatingForces = false;
  }
}

// Debounced version of the update forces function - limits updates to once per 50ms
const updateElectricForces = debounce(updateElectricForcesImpl, 50);

// Track last highlight operation to avoid rapid changes
let highlightTimeout: number | null = null;

// Function to debounce highlight operations directly
function debouncedHighlight(app: PIXI.Application, sourceChargeId: string, isHighlighted: boolean): void {
  if (highlightTimeout !== null) {
    clearTimeout(highlightTimeout);
  }

  // Set states immediately to ensure other code knows about the hover state
  isHoveringCharge = isHighlighted;
  currentHoveredChargeId = isHighlighted ? sourceChargeId : null;

  highlightTimeout = setTimeout(() => {
    if ((isHighlighted && currentHoveredChargeId === sourceChargeId) ||
      (!isHighlighted && !isHoveringCharge)) {
      highlightPartialForces(app, sourceChargeId, isHighlighted);
    }
    highlightTimeout = null;
  }, 50) as unknown as number;
}

// Additional flag to track if we're currently in a hover operation
let isHoveringCharge = false;
let currentHoveredChargeId: string | null = null;

// Modify the highlightPartialForces function to set the hover flag
function highlightPartialForces(app: PIXI.Application, sourceChargeId: string, isHighlighted: boolean) {
  if (!app) return;

  // Update hover state
  isHoveringCharge = isHighlighted;
  currentHoveredChargeId = isHighlighted ? sourceChargeId : null;

  if (DEBUG_FORCES) {
    console.log(`[${performance.now().toFixed(2)}] Highlighting forces for charge ${sourceChargeId}, highlight=${isHighlighted}`);
  }

  // Use the new grid-based approach for highlighting
  highlightForcesFromCharge(app, sourceChargeId, isHighlighted);
}

function handleMouseMove(event: MouseEvent) {
  const rect = canvasContainer.value?.getBoundingClientRect();
  if (!rect) return;

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (chargesStore.mode === 'electric') {
    const field = getNetElectricFieldAtPoint({ x, y });
    const fieldX = Math.abs(field.x / 1e3) > 40000 ? `${field.x > 0 ? '+' : '-'}NaN` : (field.x / 1e3).toFixed(2);
    const fieldY = Math.abs(field.y / 1e3) > 40000 ? `${field.y > 0 ? '+' : '-'}NaN` : (-field.y / 1e3).toFixed(2);
    fieldReadout.value = `Ex: ${fieldX} kN/C, Ey: ${fieldY} kN/C`;
  } else if (chargesStore.mode === 'magnetic') {
    const selected = chargesStore.charges.find(c => c.id === chargesStore.selectedChargeId);
    if (!selected) {
      fieldReadout.value = `Fx: -- N, Fy: -- N`;
      return;
    }

    const force = calculateMagneticForce(selected, chargesStore.magneticField);
    fieldReadout.value = `Fx: ${force.x.toFixed(2)} N, Fy: ${-force.y.toFixed(2)} N`;
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    event.preventDefault(); // Prevent default tab behavior

    const charges = chargesStore.charges;
    if (charges.length === 0) return;

    if (!chargesStore.selectedChargeId) {
      chargesStore.setSelectedCharge(charges[0].id);
    } else {
      const currentIndex = charges.findIndex(c => c.id === chargesStore.selectedChargeId);
      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + charges.length) % charges.length
        : (currentIndex + 1) % charges.length;
      chargesStore.setSelectedCharge(charges[nextIndex].id);
    }
    return;
  }

  if (!chargesStore.selectedChargeId) return;

  const charge = chargesStore.charges.find(c => c.id === chargesStore.selectedChargeId);
  if (!charge) return;

  switch (event.key) {
    case 'ArrowUp':
      chargesStore.updateChargePosition(charge.id, {
        x: charge.position.x,
        y: charge.position.y - MOVEMENT_STEP
      });
      break;
    case 'ArrowDown':
      chargesStore.updateChargePosition(charge.id, {
        x: charge.position.x,
        y: charge.position.y + MOVEMENT_STEP
      });
      break;
    case 'ArrowLeft':
      chargesStore.updateChargePosition(charge.id, {
        x: charge.position.x - MOVEMENT_STEP,
        y: charge.position.y
      });
      break;
    case 'ArrowRight':
      chargesStore.updateChargePosition(charge.id, {
        x: charge.position.x + MOVEMENT_STEP,
        y: charge.position.y
      });
      break;
  }
};

function isWithinViewport(position: { x: number, y: number }, buffer: number = 100): boolean {
  if (!app) return false;
  const screenWidth = app.screen.width;
  const screenHeight = app.screen.height;
  return (
    position.x >= -buffer &&
    position.x <= screenWidth + buffer &&
    position.y >= -buffer &&
    position.y <= screenHeight + buffer
  );
}

const updateChargeTrail = (charge: Charge, trailGraphics: PIXI.Graphics) => {
  const positionSnapshot = { x: charge.position.x, y: charge.position.y };
  if (!isWithinViewport(positionSnapshot)) {
    return;
  }

  // Initialize the trail array if it doesn't exist
  if (!charge.trail) {
    charge.trail = [];
  }
  const scaleFactor = window.innerWidth < 600 ? 0.6 : 1.0;

  if (charge.trailSampleCounter === undefined) {
    charge.trailSampleCounter = 0;
  }

  const minDistance = 60 * scaleFactor; // Minimum distance traveled before taking a sample

  // Calculate distance from last sampled position
  if (charge.trail.length === 0 ||
    Math.hypot(
      charge.position.x - charge.trail[charge.trail.length - 1].x,
      charge.position.y - charge.trail[charge.trail.length - 1].y
    ) >= minDistance) {

    // Push a snapshot of the position
    charge.trail.push(positionSnapshot);
  }

  // Clear the previous trail drawing
  trailGraphics.clear();

  const dotRadius = 8 * scaleFactor;
  trailGraphics.beginFill(0xffffff, 0.7);
  for (const pos of charge.trail) {
    trailGraphics.drawCircle(pos.x, pos.y, dotRadius);
  }
  trailGraphics.endFill();
};

const clearTrails = () => {
  trailGraphicsMap.forEach(trailGraphic => {
    if (app) {
      app.stage.removeChild(trailGraphic);
    }
    releaseGraphics(trailGraphic);
  });
  trailGraphicsMap.clear();
};

const updateChargeMotion = () => {
  if (chargesStore.animationMode == AnimationMode.reset) {
    clearTrails();
    return;
  }
  else if (chargesStore.animationMode == AnimationMode.stop) {
    return;
  }
  else {
    chargesStore.charges.forEach(charge => {
      const force = calculateMagneticForce(charge, chargesStore.magneticField);
      charge.velocity.direction.x += force.x * FORCE_SCALING;
      charge.velocity.direction.y += force.y * FORCE_SCALING;
      charge.position.x += charge.velocity.magnitude * charge.velocity.direction.x * ANIMATION_SPEED;
      charge.position.y += charge.velocity.magnitude * charge.velocity.direction.y * ANIMATION_SPEED;

      let trailGraphics = trailGraphicsMap.get(charge.id);
      if (!trailGraphics) {
        trailGraphics = getGraphics();
        // Ensure the trail renders behind the charge
        trailGraphics.zIndex = 5;
        trailGraphicsMap.set(charge.id, trailGraphics);
        app!.stage.addChild(trailGraphics);
      }

      updateChargeTrail(charge, trailGraphics);
    });
  }
};

// Function to analyze force updates for rapid changes
function analyzeForceUpdates() {
  if (!DEBUG_FORCES) return;

  const now = Date.now();
  const FLICKER_THRESHOLD = 100; // Consider updates within 100ms of each other as potential flicker

  // Find force vectors with rapid updates
  const flickeringVectors: Array<{ vectorId: string, updates: number, timespan: number }> = [];

  forceOperations.forEach((data, vectorId) => {
    // Get updates within last 500ms
    const recentUpdates = data.updates.filter(update => now - update.timestamp < 500);

    if (recentUpdates.length > 2) {
      // Detect if any updates were very close together (potential flicker)
      let hasRapidUpdates = false;
      for (let i = 1; i < recentUpdates.length; i++) {
        const timeDiff = recentUpdates[i].timestamp - recentUpdates[i - 1].timestamp;
        if (timeDiff < FLICKER_THRESHOLD) {
          hasRapidUpdates = true;
          break;
        }
      }

      if (hasRapidUpdates) {
        flickeringVectors.push({
          vectorId,
          updates: recentUpdates.length,
          timespan: now - recentUpdates[0].timestamp
        });
      }
    }
  });

  if (flickeringVectors.length > 0) {
    console.warn(`[${performance.now().toFixed(2)}] Detected ${flickeringVectors.length} potentially flickering vectors:`, flickeringVectors);
  }
}

// Call this function periodically to analyze force updates
const startFlickerDetection = () => {
  if (!DEBUG_FORCES) return;

  console.log(`[${performance.now().toFixed(2)}] Starting force flicker detection`);

  // Check for potential flickering every 2 seconds
  const flickerDetectionInterval = setInterval(() => {
    if (chargesStore.mode === 'electric' && chargesStore.showForces) {
      analyzeForceUpdates();
    }
  }, 2000);

  // Add the interval to onBeforeUnmount cleanup
  onBeforeUnmount(() => {
    clearInterval(flickerDetectionInterval);
  });
};

onMounted(async () => {
  // Initialize PixiJS Application
  app = new PIXI.Application({
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
  });
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight
  });

  canvasContainer.value?.addEventListener('mousemove', handleMouseMove);

  // Enable zIndex sorting so that graphics with higher zIndex render on top
  app.stage.sortableChildren = true;

  // Append the canvas to the container
  if (canvasContainer.value && app.canvas) {
    canvasContainer.value.appendChild(app.canvas);
  }

  // Resize the canvas if the window is resized
  window.addEventListener('resize', resize);

  // Set up stage interactivity and pointer events
  app.stage.interactive = true;
  app.stage.eventMode = 'static'; // PIXI v7 property
  app.stage.hitArea = app.screen;

  app.stage.on('pointermove', (event) => {
    // Skip if we're already in the middle of a force update
    if (isUpdatingForces) return;

    chargesStore.charges.forEach((charge) => {
      const graphic = chargesGraphics.get(charge.id);
      if (graphic && graphic.dragging) {
        isDragging = true;
        const newPosition = event.data.getLocalPosition(graphic.parent);
        graphic.position.set(newPosition.x, newPosition.y);

        // Update position without triggering watcher cascades
        chargesStore.updateChargePosition(charge.id, { x: newPosition.x, y: newPosition.y });

        // Use optimized field drawing and throttled force updates during drag
        if (chargesStore.mode === 'electric') {
          // Use throttled field updates too
          const now = Date.now();
          if (now - lastForceUpdateTime > FORCE_UPDATE_THROTTLE) {
            if (DEBUG_FORCES) {
              console.log(`[${performance.now().toFixed(2)}] Updating during drag (throttled), time since last: ${now - lastForceUpdateTime}ms`);
            }

            // Always redraw the field during drag to avoid flickering
            drawElectricFieldDuringDrag(app!, chargesStore.charges);

            if (chargesStore.showForces && chargesStore.charges.length > 1) {
              // Use a direct force update (not debounced) during drag to avoid lag
              if (DEBUG_FORCES) {
                console.log(`[${performance.now().toFixed(2)}] Updating forces during drag`);
              }
              // Use the optimized grid-based approach during drag for better performance
              drawElectricForcesGridDuringDrag(app!, chargesStore.charges);
            }
            lastForceUpdateTime = now;
          } else {
            // Just mark that we need an update, it will happen at the end of drag
            if (!needsForceUpdate && DEBUG_FORCES) {
              console.log(`[${performance.now().toFixed(2)}] Marking force update needed (will update at end of drag)`);
            }
            needsForceUpdate = true;
          }
        }
      }
    });
  });

  app.stage.on('pointerup', () => {
    // End drag operations for all charges
    chargesStore.charges.forEach((charge) => {
      const graphic = chargesGraphics.get(charge.id);
      if (graphic) {
        graphic.dragging = false;
        graphic.data = null;
        graphic.alpha = 1;
      }
    });

    // If we were dragging and have a pending update, redraw everything properly
    if (isDragging) {
      isDragging = false;

      // Skip if we're already updating forces
      if (isUpdatingForces) return;

      if (chargesStore.mode === 'electric') {
        // Use the safe update pattern
        isUpdatingForces = true;

        try {
          if (DEBUG_FORCES) {
            console.log(`[${performance.now().toFixed(2)}] End of drag, redrawing field`);
          }

          // Always redraw the field at the end of drag
          removeFields(app!);
          drawElectricField(app!, chargesStore.charges, palette.value);

          // Always update forces at the end of drag if forces are enabled
          if (chargesStore.showForces && chargesStore.charges.length > 1) {
            if (DEBUG_FORCES) {
              console.log(`[${performance.now().toFixed(2)}] End of drag, updating forces`);
            }
            // Use grid-based approach for consistent force rendering at the end of drag
            drawElectricForcesGrid(app!, chargesStore.charges);
          }
        } finally {
          isUpdatingForces = false;
          needsForceUpdate = false;
        }
      }
    }
  });

  app.stage.on('pointerdown', (event) => {
    // Only deselect if we clicked on the stage itself, not on a child
    if (event.target === app?.stage) {
      // Reset highlights and deselect the charge
      resetAllPartialForceHighlights(app!);
      chargesStore.setSelectedCharge(null);
    }
  });

  // Watch for changes in colorblind mode.
  watch(
    () => settingsStore.colorblindMode,
    (newMode) => {
      console.log('Colorblind mode changed to:', newMode);

      if (chargesStore.mode === 'electric') {
        removeFields(app!);
        drawElectricField(app!, chargesStore.charges, palette.value);
      } else {
        removeFields(app!);
        drawMagneticField(app!, chargesStore.magneticField);
        drawMagneticForcesOnAllCharges(app!, chargesStore, palette.value);
        drawVelocityOnAllCharges(app!, chargesStore, palette.value);
      }
      updateChargesOnCanvas(chargesStore.charges);
    }
  );

  watch(() => settingsStore.dyslexiaMode, (enabled) => {
    document.body.classList.toggle('dyslexia-font', enabled);
  });


  // Watch for changes in the charges array with decreased sensitivity
  watch(
    () => chargesStore.charges,
    (newCharges, oldCharges = []) => {
      if (!app || isUpdatingForces) return;

      if (DEBUG_FORCES) {
        console.log(`[${performance.now().toFixed(2)}] Charges changed, count: ${newCharges.length}, isDragging: ${isDragging}`);
      }

      // Special case: If we had 2+ charges and now have 1 or 0, clear force arrows
      if (oldCharges.length > 1 && newCharges.length <= 1 && chargesStore.showForces) {
        if (DEBUG_FORCES) {
          console.log(`[${performance.now().toFixed(2)}] Charge count reduced to ${newCharges.length}, clearing force arrows`);
        }
        removeAllForceElements(app);
      }

      // During drag operations, we already handle force updates with throttling
      if (isDragging && chargesStore.mode === 'electric' && chargesStore.showForces) {
        // Only update the fields and charges here
        drawElectricField(app!, newCharges, palette.value);
        updateChargesOnCanvas(newCharges);
      } else {
        // For non-drag updates, do the full update safely
        isUpdatingForces = true;

        try {
          if (chargesStore.mode === 'electric') {
            if (DEBUG_FORCES) {
              console.log(`[${performance.now().toFixed(2)}] Redrawing field due to charges change`);
            }
            removeFields(app!);
            drawElectricField(app!, newCharges, palette.value);

            if (chargesStore.showForces && newCharges.length > 1) {
              // Check if a significant change happened that requires force update
              const now = performance.now();
              const timeSinceLastUpdate = now - lastForceRenderState.timestamp;
              const forceStabilityActive = timeSinceLastUpdate < FORCE_STABILITY_THRESHOLD &&
                newCharges.length === lastForceRenderState.charges.length;

              if (!forceStabilityActive || needsForceUpdate) {
                // Instead of directly updating forces here, schedule a debounced update
                if (DEBUG_FORCES) {
                  console.log(`[${performance.now().toFixed(2)}] Scheduling debounced force update due to charges change`);
                }
                updateElectricForces();
              } else if (DEBUG_FORCES) {
                console.log(`[${performance.now().toFixed(2)}] Skipping force update due to stability threshold`);
              }
            }
          } else {
            drawMagneticField(app!, chargesStore.magneticField);
            drawMagneticForcesOnAllCharges(app!, chargesStore, palette.value);
            drawVelocityOnAllCharges(app!, chargesStore, palette.value);
          }

          // Always update the charges on canvas
          updateChargesOnCanvas(newCharges);
        } finally {
          isUpdatingForces = false;
        }
      }
    },
    { deep: true, immediate: true }
  );

  // Watch for mode changes
  watch(
    () => chargesStore.mode,
    (newMode) => {
      if (!app) return;

      // Clean up all force vectors and reset state
      removeAllForceElements(app);

      // Also reset all highlights to ensure clean state
      resetAllPartialForceHighlights(app);

      // Reset force stability tracking
      lastForceRenderState = {
        charges: [],
        timestamp: 0
      };

      // Clear all field and force vectors
      app.stage.children
        .filter(child =>
          child.name === 'fieldVector' ||
          child.name?.startsWith('magneticForceVector-') ||
          child.name.startsWith('velocityVector-')
        )
        .forEach(child => app!.stage.removeChild(child));

      if (newMode === 'electric') {
        removeFields(app!);
        drawElectricField(app, chargesStore.charges, palette.value);

        // Draw forces if enabled
        if (chargesStore.showForces) {
          updateElectricForces();
        }
      } else {
        removeFields(app!);
        drawMagneticField(app!, chargesStore.magneticField);
        drawMagneticForcesOnAllCharges(app!, chargesStore, palette.value);
        drawVelocityOnAllCharges(app!, chargesStore, palette.value);
      }
    }
  );

  watch(
    () => chargesStore.magneticField,
    () => {
      if (chargesStore.mode === 'magnetic') {
        removeFields(app!);
        drawMagneticField(app!, chargesStore.magneticField)
        drawMagneticForcesOnAllCharges(app!, chargesStore, palette.value);
        drawVelocityOnAllCharges(app!, chargesStore, palette.value);
      }
    },
    { deep: true, immediate: true }
  );
  // Add keyboard event listener
  window.addEventListener('keydown', handleKeyDown);

  app.ticker.add(() => {
    checkChargesOffScreen();
    updateChargeMotion();
  });

  // Start the flicker detection after initialization
  startFlickerDetection();
});

onBeforeUnmount(() => {
  canvasContainer.value?.removeEventListener('mousemove', handleMouseMove);

  if (app) {
    app.destroy(true, { children: true });
    app = null;
  }
  window.removeEventListener('resize', resize);
  window.removeEventListener('keydown', handleKeyDown);
});

const resize = () => {
  if (!app) return;

  // If letting Pixi handle density, we don't manually set resolution at all:
  app.renderer.resize(window.innerWidth, window.innerHeight);

  if (chargesStore.mode === 'electric') {
    removeFields(app);
    drawElectricField(app, chargesStore.charges, palette.value);
  } else {
    removeFields(app);
    drawMagneticField(app, chargesStore.magneticField);
    drawMagneticForcesOnAllCharges(app, chargesStore, palette.value);
    drawVelocityOnAllCharges(app, chargesStore, palette.value);
  }
  updateChargesOnCanvas(chargesStore.charges);
};


// Function to reset all partial forces to non-highlighted state
function resetAllPartialForceHighlights(app: PIXI.Application) {
  if (!app) return;

  // Skip if we're in the middle of a hover operation to avoid flickering
  if (isHoveringCharge && !isUpdatingForces) {
    if (DEBUG_FORCES) {
      console.log(`[${performance.now().toFixed(2)}] Skipping reset highlights during hover`);
    }
    return;
  }

  if (DEBUG_FORCES) {
    console.log(`[${performance.now().toFixed(2)}] Resetting all force highlights`);
  }

  // Clear hover state
  isHoveringCharge = false;
  currentHoveredChargeId = null;

  // Set all partial force vectors to default alpha of 0.5
  const partialForceVectors = app.stage.children.filter(
    child => child.name?.startsWith('electricForceVector-from-')
  );

  // Apply uniform alpha to all partial forces
  partialForceVectors.forEach(vector => {
    if (vector instanceof PIXI.Graphics) {
      vector.alpha = 0.5;

      // Also update associated labels
      const labelName = `label-for-${vector.name}`;
      const label = app.stage.children.find(child => child.name === labelName);
      if (label) {
        label.alpha = 0.5;
      }
    }
  });
}

const updateChargesOnCanvas = (charges: Charge[]) => {
  if (!app) return;

  // Set batching flag to prevent updates during charge modifications
  isBatchingUpdates = true;

  try {
    const scaleFactor = window.innerWidth < 600 ? 0.6 : 1.0;

    // Remove graphics for charges that no longer exist
    for (const [id, graphic] of chargesGraphics) {
      if (!charges.find((charge) => charge.id === id)) {
        app.stage.removeChild(graphic);
        chargesGraphics.delete(id);
      }
    }

    // Add or update graphics for current charges
    charges.forEach((charge) => {
      let graphic = chargesGraphics.get(charge.id);
      if (!graphic) {
        graphic = new PIXI.Graphics();
        // Set a high zIndex so that charges render on top of arrows
        graphic.zIndex = 10;
        chargesGraphics.set(charge.id, graphic);
        app?.stage.addChild(graphic);

        // Configure interactivity for both PIXI v6 and v7 compatibility
        graphic.eventMode = 'static'; // PIXI v7 property
        graphic.cursor = 'pointer';    // PIXI v7 property
        // For backwards compatibility with PIXI v6
        graphic.interactive = true;    // PIXI v6 property
        graphic.buttonMode = true;     // PIXI v6 property

        // Event handlers for selection - separate from drag handling
        graphic.on('pointerdown', (event) => {
          // Skip if we're in batch update mode
          if (isBatchingUpdates) return;

          // Stop propagation to prevent stage from deselecting
          event.stopPropagation();
          chargesStore.setSelectedCharge(charge.id);

          // Also store data for drag handling
          graphic!.data = event.data;
          graphic!.dragging = true;
        });

        // Drag handling events
        graphic
          .on('pointerup', () => {
            graphic!.dragging = false;
            graphic!.data = null;
          })
          .on('pointerupoutside', () => {
            graphic!.dragging = false;
            graphic!.data = null;
          });

        // Add hover handlers for force highlighting
        graphic
          .on('pointerover', () => {
            if (chargesStore.mode === 'electric' && chargesStore.showForces) {
              if (DEBUG_FORCES) {
                console.log(`[${performance.now().toFixed(2)}] Hover started on charge ${charge.id}`);
              }

              // Set hovering flag first to prevent other operations from interfering
              isHoveringCharge = true;
              currentHoveredChargeId = charge.id;

              // Use the debounced version to avoid flickering
              debouncedHighlight(app!, charge.id, true);
            }
          })
          .on('pointerout', () => {
            if (chargesStore.mode === 'electric' && chargesStore.showForces) {
              if (DEBUG_FORCES) {
                console.log(`[${performance.now().toFixed(2)}] Hover ended on charge ${charge.id}`);
              }

              // Reset hover state
              isHoveringCharge = false;
              currentHoveredChargeId = null;

              // Use the debounced version to avoid flickering
              debouncedHighlight(app!, charge.id, false);
            }
          });

        // Throttle field and force updates during dragging for performance
        const now = performance.now();
        const timeSinceLastUpdate = now - lastForceUpdateTime;

        // Skip redrawing field/forces on every move - only do it periodically
        if (timeSinceLastUpdate > FORCE_UPDATE_THROTTLE) {
          lastForceUpdateTime = now;
          isDragging = true;

          if (chargesStore.mode === 'electric') {
            // Update force calculations if forces are shown
            if (chargesStore.showForces) {
              updateElectricForces();
            }

            // Use a more efficient field redraw during drag
            removeFields(app!);
            drawElectricFieldDuringDrag(app!, chargesStore.charges);
          } else if (chargesStore.mode === 'magnetic') {
            // Clear existing forces
            app!.stage.children
              .filter(child => child.name?.startsWith('magneticForceVector-'))
              .forEach(child => app!.stage.removeChild(child));

            if (chargesStore.showForces) {
              drawMagneticForcesOnAllCharges(app!, chargesStore, palette.value);
              drawVelocityOnAllCharges(app!, chargesStore, palette.value);
            }
          }
        } else {
          // Mark that we need an update when dragging stops
          needsForceUpdate = true;
        }
      } else {
        graphic.clear();
      }

      const color = charge.polarity === 'positive' ? palette.value.chargePositive : palette.value.chargeNegative;
      const polarity = charge.polarity === 'positive' ? "+" : "-";

      // Draw the charge circle
      const radius = 24 * scaleFactor;
      graphic.beginFill(color);
      // graphic.lineStyle(0);
      graphic.drawCircle(0, 0, radius);
      graphic.endFill();

      // Set position
      graphic.position.set(charge.position.x, charge.position.y);

      // Create or update the text label for the charge magnitude
      let text = graphic.getChildByName('chargeLabel') as PIXI.Text;
      if (!text) {
        const labelText = `${polarity}${charge.magnitude}C`;
        text = new PIXI.Text(labelText, {
          fontFamily: settingsStore.dyslexiaMode ? 'OpenDyslexic' : 'Poppins',
          fontSize: 16 * scaleFactor,
          fill: palette.value.chargeText,
          align: 'center',
        });
        text.name = 'chargeLabel';
        text.anchor.set(0.5);
        text.position.set(0, 0);
        text.name = 'chargeLabel';
        graphic.addChild(text);
      } else {
        text.text = polarity + charge.magnitude.toString() + 'C';
        text.style.fontFamily = settingsStore.dyslexiaMode ? 'OpenDyslexic' : 'Poppins';
        text.style.fontSize = 16 * scaleFactor;
      }

      text.anchor.set(0.5);
      text.position.set(0, 0);
    });
  } finally {
    // Always reset the batch flag
    isBatchingUpdates = false;
  }
};

// Add a watch for showForces changes
watch(
  () => chargesStore.showForces,
  (showForces) => {
    if (!app || isUpdatingForces) return;

    if (DEBUG_FORCES) {
      console.log(`[${performance.now().toFixed(2)}] showForces changed to ${showForces}`);
    }

    // Set the flag to prevent simultaneous updates
    isUpdatingForces = true;

    try {
      // Clean up all force vectors and reset state
      clearForceOperationLogs();
      // Reset charge label mapping when forces are toggled
      resetChargeLabelMapping();

      // Always reset force state when toggling
      lastForceRenderState = {
        charges: [],
        timestamp: 0
      };

      if (DEBUG_FORCES) {
        console.log(`[${performance.now().toFixed(2)}] Removing all force elements due to toggle`);
      }
      removeAllForceElements(app);

      // Also ensure all highlights are reset
      resetAllPartialForceHighlights(app);

      // Only redraw if in electric mode and showForces is true
      if (chargesStore.mode === 'electric' && showForces) {
        // console.log("Showing electric forces, charge count:", chargesStore.charges.length);

        if (chargesStore.charges.length > 1) {
          // Use our new grid-based approach to draw all forces at once
          if (DEBUG_FORCES) {
            console.log(`[${performance.now().toFixed(2)}] Drawing forces using grid-based approach after toggle`);
          }

          // Force immediate update with the most recent charges
          drawElectricForcesGrid(app!, chargesStore.charges);

          // Store the current state to prevent unnecessary updates
          lastForceRenderState = {
            charges: JSON.parse(JSON.stringify(chargesStore.charges)),
            timestamp: performance.now()
          };
        } else {
          if (DEBUG_FORCES) {
            console.log(`[${performance.now().toFixed(2)}] No forces to draw after toggle (less than 2 charges)`);
          }
        }
      } else if (chargesStore.mode === 'magnetic' && showForces) {
        // console.log("Showing magnetic forces, charge count:", chargesStore.charges.length);
        // Re-draw magnetic forces
        drawMagneticForcesOnAllCharges(app!, chargesStore, palette.value);
      }
    } finally {
      // Always clear the flag when done
      isUpdatingForces = false;
    }
  }
);

// Add an optimized electric field drawing function during drag
function drawElectricFieldDuringDrag(app: PIXI.Application, charges: Charge[]) {
  if (!app) return;

  // Use a larger spacing during drag to improve performance
  const LARGER_SPACING = FIELD_SPACING * 2;

  // Clear existing field vectors
  app.stage.children
    .filter(child => child.name === 'fieldVector')
    .forEach(child => app.stage.removeChild(child));

  // Draw electric field with a larger spacing
  if (charges.length === 0) return;

  let maxFieldMagnitude = 0;
  let minFieldMagnitude = Infinity;

  // First pass to find min/max magnitudes for proper scaling
  for (let x = 0; x < app.screen.width; x += LARGER_SPACING) {
    for (let y = 0; y < app.screen.height; y += LARGER_SPACING) {
      const fieldVector = { x: 0, y: 0 };
      charges.forEach(charge => {
        const chargeField = calculateElectricField(
          charge.position,
          charge.magnitude,
          { x, y },
          charge.polarity === 'positive',
        );
        fieldVector.x += chargeField.x;
        fieldVector.y += chargeField.y;
      });

      const magnitude = Math.sqrt(fieldVector.x ** 2 + fieldVector.y ** 2);
      maxFieldMagnitude = Math.max(maxFieldMagnitude, magnitude);
      if (magnitude > 0) {
        minFieldMagnitude = Math.min(minFieldMagnitude, magnitude);
      }
    }
  }

  // Draw the vectors with optimized settings
  for (let x = 0; x < app.screen.width; x += LARGER_SPACING) {
    for (let y = 0; y < app.screen.height; y += LARGER_SPACING) {
      const fieldVector = { x: 0, y: 0 };
      charges.forEach(charge => {
        const chargeField = calculateElectricField(
          charge.position,
          charge.magnitude,
          { x, y },
          charge.polarity === 'positive',
        );
        fieldVector.x += chargeField.x;
        fieldVector.y += chargeField.y;
      });

      const magnitude = Math.sqrt(fieldVector.x ** 2 + fieldVector.y ** 2);
      // Skip vectors with very small magnitudes during drag
      if (magnitude < minFieldMagnitude * 5) continue;

      const logMin = Math.log(minFieldMagnitude || 1e-10);
      const logMax = Math.log(maxFieldMagnitude);
      const logCurrent = Math.log(magnitude || 1e-10);
      const normalizedMagnitude = (logCurrent - logMin) / (logMax - logMin);
      const alpha = MIN_ALPHA + (MAX_ALPHA - MIN_ALPHA) * Math.pow(normalizedMagnitude, 1 / LOG_SCALE_FACTOR);
      const length = Math.min(magnitude * VECTOR_LENGTH_SCALE, MAX_VECTOR_LENGTH);

      // Draw field vector with simple style
      const arrow = new PIXI.Graphics();
      arrow.name = 'fieldVector';
      arrow.zIndex = 0;
      arrow.lineStyle(2, 0xffffff, alpha);
      arrow.moveTo(x, y);
      const endX = x + (fieldVector.x / magnitude) * length;
      const endY = y + (fieldVector.y / magnitude) * length;
      arrow.lineTo(endX, endY);
      app.stage.addChild(arrow);
    }
  }
}
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  flex-grow: 1;
  overflow: hidden;
}

.field-readout {
  position: absolute;
  bottom: 12px;
  right: 12px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 14px;
  font-family: monospace;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
}
</style>
