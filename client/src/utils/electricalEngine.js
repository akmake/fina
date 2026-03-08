/**
 * מנוע חישובי חשמל מקצועי
 * Professional Electrical Calculation Engine
 * 
 * כולל: חישובי עומסים, מפלי מתח, חתכי כבלים, מעגלים
 * תקן: ת"י 61, IEC 60364
 */

// ==============================
// CONSTANTS
// ==============================
const VOLTAGE_SINGLE_PHASE = 230;
const VOLTAGE_THREE_PHASE = 400;
const COPPER_RESISTIVITY = 0.0175; // Ω·mm²/m at 20°C
const MAX_VOLTAGE_DROP_PERCENT = 4; // Maximum allowed voltage drop (Israeli standard)
const POWER_FACTOR_DEFAULT = 0.85;
const DEMAND_FACTOR_RESIDENTIAL = 0.6; // Residential demand factor
const SAFETY_FACTOR = 1.25;

// ==============================
// CABLE DATABASE (Israeli Standard)
// ==============================
const CABLE_DATA = [
  { section: 1.5, resistance: 12.1, reactance: 0.115, maxCurrent_A: 15, maxCurrent_B: 17.5, maxCurrent_C: 19.5, usage: 'תאורה' },
  { section: 2.5, resistance: 7.41, reactance: 0.110, maxCurrent_A: 21, maxCurrent_B: 24, maxCurrent_C: 27, usage: 'שקעים' },
  { section: 4, resistance: 4.61, reactance: 0.107, maxCurrent_A: 28, maxCurrent_B: 32, maxCurrent_C: 36, usage: 'שקע מוגבר' },
  { section: 6, resistance: 3.08, reactance: 0.100, maxCurrent_A: 36, maxCurrent_B: 41, maxCurrent_C: 46, usage: 'מזגן/דוד' },
  { section: 10, resistance: 1.83, reactance: 0.094, maxCurrent_A: 50, maxCurrent_B: 57, maxCurrent_C: 63, usage: 'תנור/בויילר' },
  { section: 16, resistance: 1.15, reactance: 0.088, maxCurrent_A: 68, maxCurrent_B: 76, maxCurrent_C: 85, usage: 'מזין ללוח' },
  { section: 25, resistance: 0.727, reactance: 0.086, maxCurrent_A: 89, maxCurrent_B: 96, maxCurrent_C: 112, usage: 'מזין ראשי' },
  { section: 35, resistance: 0.524, reactance: 0.084, maxCurrent_A: 110, maxCurrent_B: 119, maxCurrent_C: 138, usage: 'מזין כבד' },
  { section: 50, resistance: 0.387, reactance: 0.082, maxCurrent_A: 133, maxCurrent_B: 144, maxCurrent_C: 168, usage: 'מזין ראשי כבד' },
  { section: 70, resistance: 0.268, reactance: 0.082, maxCurrent_A: 171, maxCurrent_B: 184, maxCurrent_C: 213, usage: 'מזין ראשי' },
  { section: 95, resistance: 0.193, reactance: 0.080, maxCurrent_A: 207, maxCurrent_B: 223, maxCurrent_C: 258, usage: 'מזין ראשי כבד' },
  { section: 120, resistance: 0.153, reactance: 0.080, maxCurrent_A: 240, maxCurrent_B: 259, maxCurrent_C: 299, usage: 'ציוד כבד' },
];

// Installation methods for correction factors
const INSTALLATION_METHODS = {
  A: { name: 'צנרת בקיר מבודד', factor: 1.0, description: 'כבל בתוך צינור בקיר מבודד' },
  B: { name: 'צנרת על קיר', factor: 1.0, description: 'כבל בתוך צינור על פני הקיר' },
  C: { name: 'כבל על קיר', factor: 1.0, description: 'כבל ישירות על פני הקיר' },
  E: { name: 'סולם כבלים', factor: 1.0, description: 'כבל על סולם כבלים באוויר' },
};

// Temperature correction factors
const TEMP_CORRECTION = {
  25: 1.06, 30: 1.0, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.50,
};

// Grouping correction factors (number of circuits in same conduit)
const GROUPING_CORRECTION = {
  1: 1.0, 2: 0.80, 3: 0.70, 4: 0.65, 5: 0.60, 6: 0.57,
  7: 0.54, 8: 0.52, 9: 0.50, 10: 0.48, 12: 0.45, 16: 0.41, 20: 0.38,
};

// ==============================
// GRID & SNAP ENGINE
// ==============================

/**
 * Snap a value to the nearest grid point
 */
export function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a point (x,y) to grid
 */
export function snapPointToGrid(x, y, gridSize) {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

/**
 * Check if two points are within snap distance
 */
export function isWithinSnapDistance(x1, y1, x2, y2, threshold) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

/**
 * Find nearest connection point from all placed symbols
 */
export function findNearestConnection(x, y, placedSymbols, threshold = 15) {
  let nearest = null;
  let minDist = threshold;

  for (const placed of placedSymbols) {
    if (!placed.connections) continue;
    for (const conn of placed.connections) {
      const cx = placed.x + conn.x;
      const cy = placed.y + conn.y;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearest = { symbolId: placed.id, connectionId: conn.id, x: cx, y: cy, dist };
      }
    }
  }
  return nearest;
}

// ==============================
// MEASUREMENT & SCALE
// ==============================

/**
 * Convert canvas pixels to real-world millimeters based on scale
 */
export function pixelsToMM(pixels, scale) {
  // If scale is 1:50, then 1mm on paper = 50mm in reality
  // At 96 DPI, 1 pixel ≈ 0.264mm on paper
  // But we define our own scale: 1 grid unit = scaleRatio mm
  return pixels * scale;
}

/**
 * Convert real-world millimeters to canvas pixels
 */
export function mmToPixels(mm, scale) {
  return mm / scale;
}

/**
 * Calculate distance between two points in canvas coordinates
 */
export function canvasDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Calculate real-world distance
 */
export function realDistance(x1, y1, x2, y2, scale) {
  const cd = canvasDistance(x1, y1, x2, y2);
  return pixelsToMM(cd, scale);
}

// ==============================
// ELECTRICAL CALCULATIONS
// ==============================

/**
 * Calculate current from power (single phase)
 */
export function calculateCurrent(watts, voltage = VOLTAGE_SINGLE_PHASE, powerFactor = POWER_FACTOR_DEFAULT) {
  return watts / (voltage * powerFactor);
}

/**
 * Calculate current from power (three phase)
 */
export function calculateCurrentThreePhase(watts, voltage = VOLTAGE_THREE_PHASE, powerFactor = POWER_FACTOR_DEFAULT) {
  return watts / (Math.sqrt(3) * voltage * powerFactor);
}

/**
 * Calculate voltage drop (single phase)
 * @param {number} current - Current in Amps
 * @param {number} length - Cable length in meters
 * @param {number} section - Cable cross-section in mm²
 * @returns {object} Voltage drop details
 */
export function calculateVoltageDrop(current, length, section, voltage = VOLTAGE_SINGLE_PHASE) {
  const cable = CABLE_DATA.find(c => c.section === section);
  if (!cable) return null;

  const resistance = cable.resistance * length / 1000; // Convert from Ω/km to Ω
  const reactance = cable.reactance * length / 1000;
  
  // ΔV = 2 × I × (R×cosφ + X×sinφ) × L for single phase
  const cosφ = POWER_FACTOR_DEFAULT;
  const sinφ = Math.sqrt(1 - cosφ * cosφ);
  
  const voltageDrop = 2 * current * (resistance * cosφ + reactance * sinφ);
  const voltageDropPercent = (voltageDrop / voltage) * 100;

  return {
    voltageDrop: Math.round(voltageDrop * 100) / 100,
    voltageDropPercent: Math.round(voltageDropPercent * 100) / 100,
    isAcceptable: voltageDropPercent <= MAX_VOLTAGE_DROP_PERCENT,
    maxAllowed: MAX_VOLTAGE_DROP_PERCENT,
  };
}

/**
 * Select minimum cable size for given current
 * @param {number} current - Design current in Amps
 * @param {string} method - Installation method (A, B, C, E)
 * @param {number} ambientTemp - Ambient temperature
 * @param {number} groupedCircuits - Number of grouped circuits
 * @returns {object} Selected cable data
 */
export function selectCableSize(current, method = 'B', ambientTemp = 30, groupedCircuits = 1) {
  const tempFactor = TEMP_CORRECTION[ambientTemp] || 1.0;
  const groupFactor = GROUPING_CORRECTION[groupedCircuits] || 1.0;
  
  // Required current carrying capacity
  const requiredCapacity = current * SAFETY_FACTOR / (tempFactor * groupFactor);
  
  const methodKey = `maxCurrent_${method}`;
  
  for (const cable of CABLE_DATA) {
    const capacity = cable[methodKey] || cable.maxCurrent_B;
    if (capacity >= requiredCapacity) {
      return {
        ...cable,
        designCurrent: Math.round(current * 100) / 100,
        correctedCurrent: Math.round(requiredCapacity * 100) / 100,
        safetyMargin: Math.round((capacity / requiredCapacity - 1) * 100),
        tempFactor,
        groupFactor,
      };
    }
  }
  
  // If no cable found, return the largest
  const largest = CABLE_DATA[CABLE_DATA.length - 1];
  return {
    ...largest,
    designCurrent: Math.round(current * 100) / 100,
    correctedCurrent: Math.round(requiredCapacity * 100) / 100,
    safetyMargin: -1,
    warning: 'נדרש כבל גדול יותר או חלוקה למעגלים נוספים',
    tempFactor,
    groupFactor,
  };
}

/**
 * Select breaker rating
 */
export function selectBreaker(designCurrent, cableCapacity) {
  const breakerRatings = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160];
  
  // Breaker must be: designCurrent ≤ breakerRating ≤ cableCapacity
  for (const rating of breakerRatings) {
    if (rating >= designCurrent && rating <= cableCapacity) {
      return {
        rating,
        type: 'MCB',
        curve: rating <= 32 ? 'C' : 'D',
        isValid: true,
      };
    }
  }
  
  // Fallback: find nearest above design current
  const rating = breakerRatings.find(r => r >= designCurrent) || breakerRatings[breakerRatings.length - 1];
  return {
    rating,
    type: 'MCB',
    curve: rating <= 32 ? 'C' : 'D',
    isValid: rating <= cableCapacity,
    warning: rating > cableCapacity ? 'דירוג מפסק חורג מיכולת הכבל' : undefined,
  };
}

// ==============================
// CIRCUIT ANALYSIS
// ==============================

/**
 * Analyze a complete circuit
 */
export function analyzeCircuit(circuit) {
  const { elements, cableLength, cableSection, breakerRating, installMethod, ambientTemp, groupedCircuits } = circuit;
  
  // Calculate total load
  const totalWattage = elements.reduce((sum, el) => sum + (el.wattage || 0), 0);
  const demandWattage = totalWattage * DEMAND_FACTOR_RESIDENTIAL;
  const designCurrent = calculateCurrent(demandWattage);
  
  // Cable selection
  const cableSelection = selectCableSize(designCurrent, installMethod, ambientTemp, groupedCircuits);
  
  // Voltage drop
  const voltageDrop = cableLength && cableSection
    ? calculateVoltageDrop(designCurrent, cableLength, cableSection)
    : null;
  
  // Breaker selection
  const breaker = selectBreaker(designCurrent, cableSelection[`maxCurrent_${installMethod || 'B'}`] || cableSelection.maxCurrent_B);
  
  // Warnings
  const warnings = [];
  if (voltageDrop && !voltageDrop.isAcceptable) {
    warnings.push(`מפל מתח ${voltageDrop.voltageDropPercent}% חורג מהמותר (${MAX_VOLTAGE_DROP_PERCENT}%)`);
  }
  if (cableSelection.safetyMargin < 0) {
    warnings.push(cableSelection.warning);
  }
  if (!breaker.isValid) {
    warnings.push(breaker.warning);
  }
  if (designCurrent > (breakerRating || 16)) {
    warnings.push(`זרם תכנוני ${designCurrent.toFixed(1)}A חורג מדירוג המפסק ${breakerRating}A`);
  }
  
  return {
    totalWattage,
    demandWattage: Math.round(demandWattage),
    designCurrent: Math.round(designCurrent * 100) / 100,
    recommendedCable: cableSelection,
    voltageDrop,
    recommendedBreaker: breaker,
    elementCount: elements.length,
    warnings,
    isValid: warnings.length === 0,
  };
}

/**
 * Analyze entire electrical panel
 */
export function analyzePanel(circuits) {
  const analyses = circuits.map(c => ({
    circuit: c,
    analysis: analyzeCircuit(c),
  }));
  
  const totalWattage = analyses.reduce((sum, a) => sum + a.analysis.totalWattage, 0);
  const totalDemandWattage = analyses.reduce((sum, a) => sum + a.analysis.demandWattage, 0);
  const totalCurrent = calculateCurrent(totalDemandWattage);
  
  // Main breaker selection
  const mainBreaker = selectBreaker(totalCurrent, 100);
  const mainCable = selectCableSize(totalCurrent, 'B', 30, 1);
  
  const allWarnings = analyses.flatMap(a => a.analysis.warnings.map(w => `[${a.circuit.name}]: ${w}`));
  
  return {
    circuits: analyses,
    totalWattage,
    totalDemandWattage,
    totalCurrent: Math.round(totalCurrent * 100) / 100,
    mainBreaker,
    mainCable,
    warnings: allWarnings,
    circuitCount: circuits.length,
    isValid: allWarnings.length === 0,
  };
}

// ==============================
// WIRE ROUTING
// ==============================

/**
 * Generate orthogonal wire path between two points
 * Uses L-shaped routing (horizontal first, then vertical)
 */
export function generateWirePath(x1, y1, x2, y2, routingMode = 'L') {
  const points = [];
  points.push({ x: x1, y: y1 });
  
  if (routingMode === 'L') {
    // L-shape: horizontal then vertical
    points.push({ x: x2, y: y1 });
    points.push({ x: x2, y: y2 });
  } else if (routingMode === 'L_reverse') {
    // Reverse L: vertical then horizontal
    points.push({ x: x1, y: y2 });
    points.push({ x: x2, y: y2 });
  } else if (routingMode === 'U') {
    // U-shape: with offset
    const midY = (y1 + y2) / 2;
    points.push({ x: x1, y: midY });
    points.push({ x: x2, y: midY });
    points.push({ x: x2, y: y2 });
  } else if (routingMode === 'Z') {
    // Z-shape: horizontal, diagonal, horizontal
    const midX = (x1 + x2) / 2;
    points.push({ x: midX, y: y1 });
    points.push({ x: midX, y: y2 });
    points.push({ x: x2, y: y2 });
  } else {
    // Direct line
    points.push({ x: x2, y: y2 });
  }
  
  return points;
}

/**
 * Calculate total wire length from path points
 */
export function calculateWireLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += canvasDistance(points[i-1].x, points[i-1].y, points[i].x, points[i].y);
  }
  return length;
}

// ==============================
// ROOM ANALYSIS (for AI integration)
// ==============================

/**
 * Suggest electrical layout for a room based on type and dimensions
 */
export function suggestRoomElectrical(roomType, widthM, heightM) {
  const suggestions = {
    bedroom: {
      name: 'חדר שינה',
      outlets: [
        { type: 'double_outlet', count: 3, placement: 'ליד מיטה (2) + שידה (1)' },
        { type: 'tv_outlet', count: 1, placement: 'מול המיטה' },
        { type: 'network_outlet', count: 1, placement: 'ליד השולחן' },
        { type: 'ac_outlet', count: 1, placement: 'גובה 2.2 מטר' },
      ],
      lighting: [
        { type: 'ceiling_light', count: 1, placement: 'מרכז התקרה' },
        { type: 'spotlight', count: Math.max(2, Math.ceil(widthM * heightM / 3)), placement: 'פיזור שווה' },
      ],
      switches: [
        { type: 'single_switch', count: 1, placement: 'ליד הדלת' },
        { type: 'two_way_switch', count: 1, placement: 'ליד המיטה' },
      ],
      circuits: [
        { name: 'תאורה', breaker: 10, cable: 1.5 },
        { name: 'שקעים', breaker: 16, cable: 2.5 },
        { name: 'מזגן', breaker: 20, cable: 4 },
      ],
    },
    living_room: {
      name: 'סלון',
      outlets: [
        { type: 'double_outlet', count: Math.max(4, Math.ceil(widthM * heightM / 5)), placement: 'פיזור היקפי' },
        { type: 'tv_outlet', count: 1, placement: 'קיר טלוויזיה' },
        { type: 'network_outlet', count: 2, placement: 'קיר טלוויזיה + פינת עבודה' },
        { type: 'phone_outlet', count: 1, placement: 'ליד הספה' },
        { type: 'ac_outlet', count: Math.ceil(widthM * heightM / 20), placement: 'גובה 2.2 מטר' },
      ],
      lighting: [
        { type: 'ceiling_light', count: 1, placement: 'מרכזי' },
        { type: 'spotlight', count: Math.max(4, Math.ceil(widthM * heightM / 2)), placement: 'פיזור שווה' },
        { type: 'wall_light', count: 2, placement: 'קירות צדדיים' },
      ],
      switches: [
        { type: 'double_switch', count: 1, placement: 'כניסה' },
        { type: 'dimmer_switch', count: 1, placement: 'ליד מערכת ישיבה' },
      ],
      circuits: [
        { name: 'תאורה', breaker: 10, cable: 1.5 },
        { name: 'שקעים 1', breaker: 16, cable: 2.5 },
        { name: 'שקעים 2', breaker: 16, cable: 2.5 },
        { name: 'מזגן', breaker: 25, cable: 4 },
      ],
    },
    kitchen: {
      name: 'מטבח',
      outlets: [
        { type: 'double_outlet', count: 4, placement: 'מעל משטח עבודה (גובה 1.1 מ\')' },
        { type: 'single_outlet', count: 2, placement: 'מתחת למשטח (מדיח + מכונת כביסה)' },
        { type: 'oven_outlet', count: 1, placement: 'מאחורי התנור' },
        { type: 'ac_outlet', count: 1, placement: 'גובה 2.2 מטר' },
      ],
      lighting: [
        { type: 'led_panel', count: Math.max(2, Math.ceil(widthM * heightM / 4)), placement: 'תקרה - פיזור שווה' },
        { type: 'fluorescent', count: 1, placement: 'מעל משטח עבודה' },
      ],
      switches: [
        { type: 'double_switch', count: 1, placement: 'כניסה למטבח' },
      ],
      circuits: [
        { name: 'תאורה', breaker: 10, cable: 1.5 },
        { name: 'שקעים משטח', breaker: 16, cable: 2.5 },
        { name: 'תנור', breaker: 32, cable: 6 },
        { name: 'מדיחת כלים', breaker: 16, cable: 2.5 },
        { name: 'מזגן', breaker: 20, cable: 4 },
      ],
    },
    bathroom: {
      name: 'חדר אמבטיה',
      outlets: [
        { type: 'waterproof_outlet', count: 1, placement: 'ליד כיור (מוגן מים IP44)' },
        { type: 'single_outlet', count: 1, placement: 'מכונת כביסה' },
      ],
      lighting: [
        { type: 'spotlight', count: Math.max(2, Math.ceil(widthM * heightM / 2)), placement: 'IP44 מוגן מים' },
        { type: 'wall_light', count: 1, placement: 'מעל מראה' },
      ],
      switches: [
        { type: 'single_switch', count: 1, placement: 'מחוץ לחדר האמבטיה' },
      ],
      circuits: [
        { name: 'תאורה', breaker: 10, cable: 1.5 },
        { name: 'שקעים + מכ"כ', breaker: 16, cable: 2.5 },
      ],
      notes: ['כל מעגל חייב ממסר פחת 30mA', 'אזורי IP לפי תקן'],
    },
    entrance: {
      name: 'כניסה/מבואה',
      outlets: [
        { type: 'single_outlet', count: 1, placement: 'ליד הדלת' },
      ],
      lighting: [
        { type: 'spotlight', count: 2, placement: 'פיזור' },
      ],
      switches: [
        { type: 'single_switch', count: 1, placement: 'ליד דלת כניסה' },
        { type: 'motion_switch', count: 1, placement: 'חיישן תנועה' },
      ],
      circuits: [
        { name: 'תאורה כניסה', breaker: 10, cable: 1.5 },
      ],
    },
    office: {
      name: 'חדר עבודה',
      outlets: [
        { type: 'triple_outlet', count: 2, placement: 'מאחורי שולחן עבודה' },
        { type: 'double_outlet', count: 2, placement: 'קירות נוספים' },
        { type: 'network_outlet', count: 2, placement: 'שולחן עבודה' },
        { type: 'ac_outlet', count: 1, placement: 'גובה 2.2 מטר' },
      ],
      lighting: [
        { type: 'led_panel', count: Math.max(2, Math.ceil(widthM * heightM / 3)), placement: 'פיזור שווה' },
      ],
      switches: [
        { type: 'single_switch', count: 1, placement: 'כניסה' },
        { type: 'dimmer_switch', count: 1, placement: 'וידאו' },
      ],
      circuits: [
        { name: 'תאורה', breaker: 10, cable: 1.5 },
        { name: 'שקעים', breaker: 16, cable: 2.5 },
        { name: 'מחשבים (UPS)', breaker: 16, cable: 2.5 },
        { name: 'מזגן', breaker: 20, cable: 4 },
      ],
    },
    balcony: {
      name: 'מרפסת',
      outlets: [
        { type: 'waterproof_outlet', count: 1, placement: 'מוגן גשם' },
      ],
      lighting: [
        { type: 'outdoor_light', count: Math.max(1, Math.ceil(widthM / 3)), placement: 'תקרה/קיר - IP44' },
      ],
      switches: [
        { type: 'single_switch', count: 1, placement: 'מהסלון' },
      ],
      circuits: [
        { name: 'תאורה חוץ', breaker: 10, cable: 1.5 },
      ],
      notes: ['כל האביזרים IP44 לפחות'],
    },
  };
  
  return suggestions[roomType] || suggestions.bedroom;
}

/**
 * Calculate total panel requirements for an apartment
 */
export function calculateApartmentPanel(rooms) {
  const allCircuits = rooms.flatMap(r => {
    const suggestion = suggestRoomElectrical(r.type, r.width, r.height);
    return suggestion.circuits.map(c => ({
      ...c,
      room: suggestion.name,
    }));
  });
  
  // Add common circuits
  allCircuits.push(
    { name: 'בויילר', breaker: 20, cable: 4, room: 'כללי' },
    { name: 'דוד שמש', breaker: 16, cable: 2.5, room: 'כללי' },
  );
  
  // Calculate total
  const totalBreakers = allCircuits.length;
  const rcdCount = Math.ceil(totalBreakers / 6); // One RCD per 6 circuits max
  const panelSize = Math.ceil((totalBreakers + rcdCount + 2) / 12) * 12; // Round up to nearest 12-module panel
  
  return {
    circuits: allCircuits,
    totalBreakers,
    rcdCount,
    panelSize,
    mainBreaker: totalBreakers <= 12 ? 40 : totalBreakers <= 24 ? 63 : 80,
    mainCable: totalBreakers <= 12 ? 16 : totalBreakers <= 24 ? 25 : 35,
  };
}

// ==============================
// DXF EXPORT HELPER
// ==============================

/**
 * Generate basic DXF content from canvas objects
 */
export function generateDXF(objects, scale = 50) {
  let dxf = '0\nSECTION\n2\nHEADER\n0\nENDSEC\n';
  dxf += '0\nSECTION\n2\nENTITIES\n';
  
  for (const obj of objects) {
    if (obj.type === 'wire') {
      // Draw as polyline
      const points = obj.points || [];
      for (let i = 0; i < points.length - 1; i++) {
        dxf += `0\nLINE\n8\n${obj.layer || 'ELECTRICAL'}\n`;
        dxf += `10\n${points[i].x / scale}\n20\n${points[i].y / scale}\n30\n0\n`;
        dxf += `11\n${points[i+1].x / scale}\n21\n${points[i+1].y / scale}\n31\n0\n`;
      }
    } else if (obj.type === 'symbol') {
      // Draw as insert (block reference) + circle marker
      dxf += `0\nCIRCLE\n8\n${obj.layer || 'ELECTRICAL'}\n`;
      dxf += `10\n${obj.x / scale}\n20\n${obj.y / scale}\n30\n0\n`;
      dxf += `40\n${0.3}\n`; // Radius in meters
      
      // Add text label
      dxf += `0\nTEXT\n8\n${obj.layer || 'ELECTRICAL'}\n`;
      dxf += `10\n${(obj.x + 20) / scale}\n20\n${(obj.y - 10) / scale}\n30\n0\n`;
      dxf += `40\n0.15\n`; // Text height
      dxf += `1\n${obj.label || obj.symbolId}\n`;
    } else if (obj.type === 'wall') {
      dxf += `0\nLINE\n8\nWALLS\n`;
      dxf += `10\n${obj.x1 / scale}\n20\n${obj.y1 / scale}\n30\n0\n`;
      dxf += `11\n${obj.x2 / scale}\n21\n${obj.y2 / scale}\n31\n0\n`;
    }
  }
  
  dxf += '0\nENDSEC\n0\nEOF\n';
  return dxf;
}

export default {
  snapToGrid,
  snapPointToGrid,
  isWithinSnapDistance,
  findNearestConnection,
  pixelsToMM,
  mmToPixels,
  canvasDistance,
  realDistance,
  calculateCurrent,
  calculateCurrentThreePhase,
  calculateVoltageDrop,
  selectCableSize,
  selectBreaker,
  analyzeCircuit,
  analyzePanel,
  generateWirePath,
  calculateWireLength,
  suggestRoomElectrical,
  calculateApartmentPanel,
  generateDXF,
  CABLE_DATA,
  INSTALLATION_METHODS,
  TEMP_CORRECTION,
  GROUPING_CORRECTION,
};
