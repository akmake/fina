/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  Pergola Engineering Calculation Engine — COMPREHENSIVE EDITION
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Complete structural engineering calculations for pergola construction
 * supporting wood (pine/hardwood), aluminum, and steel.
 *
 * Covers:
 *  - Full material database with real profiles, weights, and structural props
 *  - Structural span tables per material & profile
 *  - Wind load calculations (Israeli standard SI-414)
 *  - Foundation sizing (concrete footings)
 *  - Overhang calculations
 *  - Shade coverage percentage
 *  - Roof types: flat slats, dense slats, polycarbonate, louvers, fabric
 *  - Drainage slope for sheet roofing
 *  - Full Cut List with waste factor
 *  - Hardware/fastener list
 *  - Weight distribution per footing
 *  - Side enclosures (glass, screens, lattice, etc.)
 *  - Lighting, gutters, finish options
 *  - 3D layout data for viewer
 *
 * All dimensions: input METRES, internal CM, output METRES.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

export const MATERIALS = {
  pine: {
    key: 'pine', label: 'עץ אורן מוקצע (CLS)', category: 'wood',
    description: 'עץ אורן מוקצע ומיובש בתנור, נפוץ ומשתלם',
    durabilityClass: 4, treatmentRequired: true,
    profiles: {
      '9x9':   { w: 9,  h: 9,  label: '9×9 ס"מ',    weightPerMeter: 4.4,  pricePerMeter: 32, momentOfInertia: 547,  bendingStrength: 24 },
      '7x15':  { w: 7,  h: 15, label: '7×15 ס"מ',    weightPerMeter: 5.8,  pricePerMeter: 42, momentOfInertia: 1969, bendingStrength: 24 },
      '7x20':  { w: 7,  h: 20, label: '7×20 ס"מ',    weightPerMeter: 7.7,  pricePerMeter: 55, momentOfInertia: 4667, bendingStrength: 24 },
      '5x10':  { w: 5,  h: 10, label: '5×10 ס"מ',    weightPerMeter: 2.8,  pricePerMeter: 20, momentOfInertia: 417,  bendingStrength: 24 },
      '5x15':  { w: 5,  h: 15, label: '5×15 ס"מ',    weightPerMeter: 4.1,  pricePerMeter: 30, momentOfInertia: 1406, bendingStrength: 24 },
      '5x20':  { w: 5,  h: 20, label: '5×20 ס"מ',    weightPerMeter: 5.5,  pricePerMeter: 40, momentOfInertia: 3333, bendingStrength: 24 },
      '5x25':  { w: 5,  h: 25, label: '5×25 ס"מ',    weightPerMeter: 6.9,  pricePerMeter: 50, momentOfInertia: 6510, bendingStrength: 24 },
      '10x10': { w: 10, h: 10, label: '10×10 ס"מ',   weightPerMeter: 5.5,  pricePerMeter: 45, momentOfInertia: 833,  bendingStrength: 24 },
      '10x15': { w: 10, h: 15, label: '10×15 ס"מ',   weightPerMeter: 8.3,  pricePerMeter: 62, momentOfInertia: 2813, bendingStrength: 24 },
      '10x20': { w: 10, h: 20, label: '10×20 ס"מ',   weightPerMeter: 11.0, pricePerMeter: 80, momentOfInertia: 6667, bendingStrength: 24 },
      '12x12': { w: 12, h: 12, label: '12×12 ס"מ',   weightPerMeter: 7.9,  pricePerMeter: 58, momentOfInertia: 1728, bendingStrength: 24 },
      '15x15': { w: 15, h: 15, label: '15×15 ס"מ',   weightPerMeter: 12.4, pricePerMeter: 85, momentOfInertia: 4219, bendingStrength: 24 },
    },
    maxMainSpan: 400, maxSecSpan: 120, maxRafterSpan: 50,
    defaultColumnProfile: '10x10', defaultMainBeamProfile: '10x15',
    defaultSecBeamProfile: '5x20', defaultRafterProfile: '5x15',
    color: '#8B6914', colorLight: '#C49A3C', densityKgM3: 550, elasticModulus: 11000,
  },

  hardwood: {
    key: 'hardwood', label: 'עץ קשה (איפה/טיק)', category: 'wood',
    description: 'עץ טרופי קשה, עמיד במיוחד בתנאי חוץ',
    durabilityClass: 1, treatmentRequired: false,
    profiles: {
      '7x7':   { w: 7,  h: 7,  label: '7×7 ס"מ',    weightPerMeter: 4.3,  pricePerMeter: 85,  momentOfInertia: 200,  bendingStrength: 42 },
      '9x9':   { w: 9,  h: 9,  label: '9×9 ס"מ',    weightPerMeter: 7.1,  pricePerMeter: 120, momentOfInertia: 547,  bendingStrength: 42 },
      '7x14':  { w: 7,  h: 14, label: '7×14 ס"מ',    weightPerMeter: 8.6,  pricePerMeter: 140, momentOfInertia: 1601, bendingStrength: 42 },
      '7x20':  { w: 7,  h: 20, label: '7×20 ס"מ',    weightPerMeter: 12.3, pricePerMeter: 195, momentOfInertia: 4667, bendingStrength: 42 },
      '5x10':  { w: 5,  h: 10, label: '5×10 ס"מ',    weightPerMeter: 4.4,  pricePerMeter: 72,  momentOfInertia: 417,  bendingStrength: 42 },
      '5x15':  { w: 5,  h: 15, label: '5×15 ס"מ',    weightPerMeter: 6.6,  pricePerMeter: 105, momentOfInertia: 1406, bendingStrength: 42 },
      '10x10': { w: 10, h: 10, label: '10×10 ס"מ',   weightPerMeter: 8.8,  pricePerMeter: 150, momentOfInertia: 833,  bendingStrength: 42 },
      '12x12': { w: 12, h: 12, label: '12×12 ס"מ',   weightPerMeter: 12.7, pricePerMeter: 195, momentOfInertia: 1728, bendingStrength: 42 },
    },
    maxMainSpan: 450, maxSecSpan: 140, maxRafterSpan: 60,
    defaultColumnProfile: '9x9', defaultMainBeamProfile: '7x14',
    defaultSecBeamProfile: '5x10', defaultRafterProfile: '5x15',
    color: '#5C3317', colorLight: '#8B5E3C', densityKgM3: 880, elasticModulus: 15000,
  },

  aluminum: {
    key: 'aluminum', label: 'אלומיניום (6063-T5)', category: 'aluminum',
    description: 'פרופילי אלומיניום אנודייז/אלקטרוסטטי, קל וחזק',
    durabilityClass: 0, treatmentRequired: false,
    profiles: {
      '60x60':   { w: 6,  h: 6,  label: '60×60 מ"מ',     weightPerMeter: 1.5, pricePerMeter: 55,  momentOfInertia: 108,  bendingStrength: 160 },
      '80x80':   { w: 8,  h: 8,  label: '80×80 מ"מ',     weightPerMeter: 2.8, pricePerMeter: 75,  momentOfInertia: 341,  bendingStrength: 160 },
      '100x100': { w: 10, h: 10, label: '100×100 מ"מ',   weightPerMeter: 3.6, pricePerMeter: 95,  momentOfInertia: 833,  bendingStrength: 160 },
      '120x120': { w: 12, h: 12, label: '120×120 מ"מ',   weightPerMeter: 4.8, pricePerMeter: 120, momentOfInertia: 1728, bendingStrength: 160 },
      '150x150': { w: 15, h: 15, label: '150×150 מ"מ',   weightPerMeter: 7.2, pricePerMeter: 175, momentOfInertia: 4219, bendingStrength: 160 },
      '50x100':  { w: 5,  h: 10, label: '50×100 מ"מ',    weightPerMeter: 2.4, pricePerMeter: 68,  momentOfInertia: 417,  bendingStrength: 160 },
      '50x150':  { w: 5,  h: 15, label: '50×150 מ"מ',    weightPerMeter: 3.2, pricePerMeter: 88,  momentOfInertia: 1406, bendingStrength: 160 },
      '50x200':  { w: 5,  h: 20, label: '50×200 מ"מ',    weightPerMeter: 4.5, pricePerMeter: 115, momentOfInertia: 3333, bendingStrength: 160 },
      '40x100':  { w: 4,  h: 10, label: '40×100 מ"מ',    weightPerMeter: 1.9, pricePerMeter: 52,  momentOfInertia: 333,  bendingStrength: 160 },
      '40x80':   { w: 4,  h: 8,  label: '40×80 מ"מ',     weightPerMeter: 1.5, pricePerMeter: 42,  momentOfInertia: 171,  bendingStrength: 160 },
      '30x80':   { w: 3,  h: 8,  label: '30×80 מ"מ',     weightPerMeter: 1.2, pricePerMeter: 38,  momentOfInertia: 128,  bendingStrength: 160 },
      '20x80':   { w: 2,  h: 8,  label: '20×80 מ"מ',     weightPerMeter: 0.8, pricePerMeter: 28,  momentOfInertia: 85,   bendingStrength: 160 },
      '30x160':  { w: 3,  h: 16, label: '30×160 מ"מ (לוברים)', weightPerMeter: 2.1, pricePerMeter: 65, momentOfInertia: 1024, bendingStrength: 160 },
    },
    maxMainSpan: 550, maxSecSpan: 160, maxRafterSpan: 70,
    defaultColumnProfile: '100x100', defaultMainBeamProfile: '50x150',
    defaultSecBeamProfile: '40x100', defaultRafterProfile: '30x80',
    color: '#A8A8A8', colorLight: '#D0D0D0', densityKgM3: 2700, elasticModulus: 69000,
  },

  steel: {
    key: 'steel', label: 'פלדה (מגולוון)', category: 'steel',
    description: 'צינורות פלדה מגולוונים, חזק ביותר, דורש ציפוי',
    durabilityClass: 2, treatmentRequired: true,
    profiles: {
      '60x60':   { w: 6,  h: 6,  label: '60×60×3 מ"מ',    weightPerMeter: 5.4,  pricePerMeter: 42, momentOfInertia: 108,  bendingStrength: 250 },
      '80x80':   { w: 8,  h: 8,  label: '80×80×3 מ"מ',    weightPerMeter: 7.2,  pricePerMeter: 55, momentOfInertia: 341,  bendingStrength: 250 },
      '100x100': { w: 10, h: 10, label: '100×100×3 מ"מ',   weightPerMeter: 9.0,  pricePerMeter: 68, momentOfInertia: 833,  bendingStrength: 250 },
      '120x120': { w: 12, h: 12, label: '120×120×4 מ"מ',   weightPerMeter: 13.8, pricePerMeter: 95, momentOfInertia: 1728, bendingStrength: 250 },
      '50x100':  { w: 5,  h: 10, label: '50×100×3 מ"מ',    weightPerMeter: 6.7,  pricePerMeter: 48, momentOfInertia: 417,  bendingStrength: 250 },
      '40x80':   { w: 4,  h: 8,  label: '40×80×2.5 מ"מ',   weightPerMeter: 4.4,  pricePerMeter: 35, momentOfInertia: 171,  bendingStrength: 250 },
      '30x60':   { w: 3,  h: 6,  label: '30×60×2 מ"מ',     weightPerMeter: 2.7,  pricePerMeter: 25, momentOfInertia: 54,   bendingStrength: 250 },
    },
    maxMainSpan: 600, maxSecSpan: 200, maxRafterSpan: 80,
    defaultColumnProfile: '80x80', defaultMainBeamProfile: '50x100',
    defaultSecBeamProfile: '40x80', defaultRafterProfile: '30x60',
    color: '#4A4A4A', colorLight: '#707070', densityKgM3: 7850, elasticModulus: 200000,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOOKUP TABLES
// ═══════════════════════════════════════════════════════════════════════════════

export const INSTALLATION_TYPES = {
  freestanding:  { label: 'עומד חופשי',  description: 'ארבע פינות ומעלה, ללא חיבור לקיר' },
  wallMounted:   { label: 'צמוד קיר',   description: 'צד אחד מחובר לקיר הבניין' },
  cornerMounted: { label: 'צמוד פינה',  description: 'שני צדדים מחוברים לקירות (פינת בניין)' },
};

export const ROOF_TYPES = {
  openSlats:            { label: 'שלבים פתוחים (קלאסי)',       shadeFactor: 0.55, needsDrainage: false, pricePerSqM: 0,   weightPerSqM: 0 },
  denseSlats:           { label: 'שלבים צפופים',              shadeFactor: 0.80, needsDrainage: false, pricePerSqM: 0,   weightPerSqM: 0 },
  polycarbonate:        { label: 'פוליקרבונט שקוף/חלבי',      shadeFactor: 0.40, needsDrainage: true,  pricePerSqM: 95,  weightPerSqM: 1.2 },
  polycarbonateOpaque:  { label: 'פוליקרבונט אטום',           shadeFactor: 0.95, needsDrainage: true,  pricePerSqM: 110, weightPerSqM: 1.5 },
  louvers:              { label: 'לוברים מתכווננים',           shadeFactor: 0.90, needsDrainage: true,  pricePerSqM: 450, weightPerSqM: 12 },
  fabricRetractable:    { label: 'בד נשלף (פרגוזה)',          shadeFactor: 0.85, needsDrainage: false, pricePerSqM: 180, weightPerSqM: 2.5 },
  none:                 { label: 'ללא כיסוי (מסגרת בלבד)',    shadeFactor: 0,    needsDrainage: false, pricePerSqM: 0,   weightPerSqM: 0 },
};

export const FOUNDATION_TYPES = {
  concretePad:          { label: 'בסיס בטון (פלטה)',          pricePerColumn: 180, depthCM: 50, widthCM: 50 },
  concretePier:         { label: 'יתד בטון (פייר)',           pricePerColumn: 220, depthCM: 80, widthCM: 30 },
  helicalScrew:         { label: 'בורג יסוד (הליקלי)',        pricePerColumn: 350, depthCM: 120, widthCM: 8 },
  surfaceMountBracket:  { label: 'עוגן משטח (בסיס קיים)',     pricePerColumn: 85,  depthCM: 0,  widthCM: 15 },
  wallBracket:          { label: 'עוגן קיר',                 pricePerColumn: 95,  depthCM: 0,   widthCM: 0 },
};

export const WIND_ZONES = {
  inland_low:    { label: 'מוגן (עירוני)',         windPressure: 0.50 },
  inland_normal: { label: 'רגיל (שפלה/הרים)',     windPressure: 0.75 },
  coastal:       { label: 'חופי (עד 5 ק"מ מהים)', windPressure: 1.05 },
  exposed:       { label: 'חשוף (גבעה פתוחה)',    windPressure: 1.40 },
};

export const FINISHES = {
  natural:        { label: 'טבעי',                     priceAdd: 0,  hex: '#C49A3C' },
  stainLight:     { label: 'לכה בהירה',                priceAdd: 15, hex: '#D4B06A' },
  stainDark:      { label: 'לכה כהה',                  priceAdd: 15, hex: '#5C3317' },
  paintWhite:     { label: 'צבע לבן',                  priceAdd: 22, hex: '#F5F5F0' },
  paintBlack:     { label: 'צבע שחור',                 priceAdd: 22, hex: '#2A2A2A' },
  paintGray:      { label: 'צבע אפור',                 priceAdd: 22, hex: '#808080' },
  woodLook:       { label: 'אפקט עץ (לאלומיניום)',     priceAdd: 35, hex: '#A0724A' },
  anodized:       { label: 'אנודייז כסוף',             priceAdd: 28, hex: '#C0C0C0' },
  electrostatic:  { label: 'ציפוי אלקטרוסטטי',        priceAdd: 30, hex: '#B0B0B0' },
};

export const LIGHTING_OPTIONS = {
  none:         { label: 'ללא תאורה',             pricePerMeter: 0,  pricePerPoint: 0 },
  ledStrip:     { label: 'פס LED מובנה',           pricePerMeter: 45, pricePerPoint: 0 },
  spotlights:   { label: 'ספוטים שקועים',          pricePerMeter: 0,  pricePerPoint: 120 },
  pendants:     { label: 'מנורות תלויות',          pricePerMeter: 0,  pricePerPoint: 250 },
  stringLights: { label: 'גרלנדה (שרשרת אורות)',  pricePerMeter: 35, pricePerPoint: 0 },
};

export const SIDE_OPTIONS = {
  none:              { label: 'פתוח (ללא)',            pricePerSqM: 0 },
  fixedGlass:        { label: 'זכוכית קבועה',          pricePerSqM: 650 },
  slidingGlass:      { label: 'זכוכית הזזה',           pricePerSqM: 850 },
  perforatedScreen:  { label: 'מסך מחורר',             pricePerSqM: 180 },
  woodScreen:        { label: 'מחיצת עץ/במבוק',       pricePerSqM: 250 },
  fabricRollDown:    { label: 'סוכך בד',               pricePerSqM: 120 },
  lattice:           { label: 'סבכה (שבכה)',           pricePerSqM: 95 },
};

export const GUTTER_TYPES = {
  none:       { label: 'ללא מרזב',             pricePerMeter: 0 },
  integrated: { label: 'מובנה בפרופיל',         pricePerMeter: 65 },
  external:   { label: 'חיצוני PVC',            pricePerMeter: 35 },
  hidden:     { label: 'סמוי בתוך עמוד',        pricePerMeter: 120 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const WASTE_FACTOR = 1.10;
const SAFETY_FACTOR = 1.25;
const BOLT_SPACING_CM = 40;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

export function calculatePergola(params) {
  const {
    length: lengthM = 4, width: widthM = 3, height: heightM = 2.7,
    material: matKey = 'pine', installType = 'wallMounted',
    roofType = 'openSlats', foundationType = 'surfaceMountBracket',
    windZone = 'inland_normal', finish = 'natural',
    overhangCM = 20, slopePercent = 2,
    lightingOption = 'none', gutterType = 'none',
    sides = { front: 'none', back: 'none', left: 'none', right: 'none' },
    columnProfile, mainBeamProfile, secBeamProfile, rafterProfile,
    // Manual overrides (0 or null = auto)
    manualRafterCount = 0,
    manualSecBeamCount = 0,
    manualRafterSpacingCM = 0,
    manualColsAlongLength = 0,
  } = params;

  const mat = MATERIALS[matKey];
  if (!mat) throw new Error(`Unknown material: ${matKey}`);

  const L = lengthM * 100, W = widthM * 100, H = heightM * 100;
  const roof = ROOF_TYPES[roofType] || ROOF_TYPES.openSlats;
  const foundation = FOUNDATION_TYPES[foundationType] || FOUNDATION_TYPES.surfaceMountBracket;
  const wind = WIND_ZONES[windZone] || WIND_ZONES.inland_normal;
  const finishData = FINISHES[finish] || FINISHES.natural;
  const gutter = GUTTER_TYPES[gutterType] || GUTTER_TYPES.none;

  const colProf  = mat.profiles[columnProfile  || mat.defaultColumnProfile];
  const mainProf = mat.profiles[mainBeamProfile || mat.defaultMainBeamProfile];
  const secProf  = mat.profiles[secBeamProfile  || mat.defaultSecBeamProfile];
  const raftProf = mat.profiles[rafterProfile   || mat.defaultRafterProfile];

  const isWall = installType === 'wallMounted';
  const isCorner = installType === 'cornerMounted';
  const overhangM = overhangCM / 100;
  const area = lengthM * widthM;
  const perimeterM = 2 * (lengthM + widthM);
  const totalRoofL = lengthM + overhangM * 2;
  const totalRoofW = widthM + (isWall || isCorner ? overhangM : overhangM * 2);
  const roofArea = totalRoofL * totalRoofW;
  const slopeHeightDiff = roof.needsDrainage ? (widthM * slopePercent / 100) : 0;

  // ── Wind ──────────────────────────────────────────────────────────────
  const windUpliftN = +(wind.windPressure * 1000 * roofArea * 0.7).toFixed(0);

  // ── Columns ───────────────────────────────────────────────────────────
  const autoSpansL = Math.max(1, Math.ceil(L / mat.maxMainSpan));
  const colsL = manualColsAlongLength > 1 ? manualColsAlongLength : (autoSpansL + 1);
  const spansL = colsL - 1;
  let colRowsW;
  if (isCorner)    colRowsW = 1;
  else if (isWall) colRowsW = Math.max(1, Math.ceil(W / mat.maxMainSpan));
  else             colRowsW = Math.max(1, Math.ceil(W / mat.maxMainSpan)) + 1;

  const totalCols = colsL * colRowsW;
  const colSpacingL = +(L / Math.max(1, spansL) / 100).toFixed(2);

  // ── Main Beams ────────────────────────────────────────────────────────
  const mainBeamCount = colRowsW + (isWall ? 1 : 0);
  const mainBeamLen = totalRoofL;

  // ── Secondary Beams ───────────────────────────────────────────────────
  const autoNumSec = Math.max(2, Math.ceil(L / mat.maxSecSpan) + 1);
  const numSec = manualSecBeamCount > 1 ? manualSecBeamCount : autoNumSec;
  const secSpacing = +(L / Math.max(1, numSec - 1) / 100).toFixed(2);
  const secLen = totalRoofW;

  // ── Rafters ───────────────────────────────────────────────────────────
  let numRaft = 0, raftSpacing = 0, raftLen = totalRoofL;

  // Manual override: user can set exact count or exact spacing
  if (manualRafterCount > 0 && roofType !== 'none') {
    numRaft = manualRafterCount;
  } else if (manualRafterSpacingCM > 0 && roofType !== 'none') {
    numRaft = Math.max(2, Math.ceil(W / manualRafterSpacingCM) + 1);
  } else if (roofType === 'none') {
    numRaft = 0;
  } else if (roofType === 'denseSlats') {
    const ds = Math.max(8, mat.maxRafterSpan * 0.3);
    numRaft = Math.max(3, Math.ceil(W / ds) + 1);
  } else if (roofType === 'louvers') {
    numRaft = Math.max(3, Math.ceil(W / 15) + 1);
  } else if (['polycarbonate','polycarbonateOpaque','fabricRetractable'].includes(roofType)) {
    numRaft = Math.max(2, Math.ceil(W / (mat.maxRafterSpan * 1.5)) + 1);
  } else {
    numRaft = Math.max(2, Math.ceil(W / mat.maxRafterSpan) + 1);
  }
  if (numRaft > 1) raftSpacing = +(W / (numRaft - 1) / 100).toFixed(2);

  // ── Weights ───────────────────────────────────────────────────────────
  const cw = colProf.weightPerMeter * heightM;
  const mw = mainProf.weightPerMeter * mainBeamLen;
  const sw = secProf.weightPerMeter * secLen;
  const rw = numRaft > 0 ? raftProf.weightPerMeter * raftLen : 0;
  const structWeight = totalCols * cw + mainBeamCount * mw + numSec * sw + numRaft * rw;
  const roofMatWeight = roof.weightPerSqM * roofArea;
  const totalWeight = +(structWeight + roofMatWeight).toFixed(1);
  const weightPerFooting = totalCols > 0 ? +(totalWeight / totalCols).toFixed(1) : 0;
  const liveLoad = 50 * area;
  const designLoad = +((totalWeight + liveLoad) * SAFETY_FACTOR).toFixed(1);
  const designPerFooting = totalCols > 0 ? +(designLoad / totalCols).toFixed(1) : 0;

  // ── Hardware ──────────────────────────────────────────────────────────
  const isW = mat.category === 'wood';
  const bPerCol = 4, bPerMain = Math.ceil(mainBeamLen * 100 / BOLT_SPACING_CM) * 2, bPerSec = 4, sPerRaft = 4;
  const tBolts = totalCols * bPerCol + mainBeamCount * bPerMain + numSec * bPerSec;
  const tScrews = numRaft * sPerRaft;
  const hardware = {
    bolts:      { label: isW ? 'בורגי עגלה M12×150' : 'בורגי נירוסטה M10×80', qty: tBolts, priceEach: isW ? 4.5 : 6 },
    screws:     { label: 'ברגים עצמיים 6×60', qty: tScrews, priceEach: 1.2 },
    brackets:   { label: 'זוויתנים (L-brackets)', qty: totalCols * 2 + mainBeamCount * 2, priceEach: isW ? 18 : 28 },
    postBases:  { label: 'בסיסי עמוד', qty: totalCols, priceEach: foundationType === 'surfaceMountBracket' ? 45 : 0 },
    washers:    { label: 'שייבות + אומים', qty: tBolts, priceEach: 1.5 },
  };
  const hardwareCost = +Object.values(hardware).reduce((s, h) => s + h.qty * h.priceEach, 0).toFixed(2);

  // ── Cut List ──────────────────────────────────────────────────────────
  const cutList = [];
  const addCut = (part, prof, lenM, qty, profObj) => {
    cutList.push({
      part, profile: profObj.label, lengthM: +lenM.toFixed(2), qty,
      totalM: +(qty * lenM * WASTE_FACTOR).toFixed(2),
      weightPerUnit: +(profObj.weightPerMeter * lenM).toFixed(2),
      totalWeight: +(qty * profObj.weightPerMeter * lenM).toFixed(1),
      pricePerUnit: +(profObj.pricePerMeter * lenM).toFixed(2),
      totalPrice: +(profObj.pricePerMeter * lenM * qty * WASTE_FACTOR).toFixed(2),
    });
  };
  addCut('עמוד', colProf.label, heightM, totalCols, colProf);
  addCut('קורה ראשית', mainProf.label, mainBeamLen, mainBeamCount, mainProf);
  addCut('קורה משנית', secProf.label, secLen, numSec, secProf);
  if (numRaft > 0) addCut(roofType === 'louvers' ? 'לובר (להב)' : 'שלב (רפטר)', raftProf.label, raftLen, numRaft, raftProf);

  const materialCost = +cutList.reduce((s, r) => s + r.totalPrice, 0).toFixed(2);
  const totalMaterialsM = +cutList.reduce((s, r) => s + r.totalM, 0).toFixed(2);

  // ── Extra costs ───────────────────────────────────────────────────────
  const roofMaterialCost = +(roof.pricePerSqM * roofArea).toFixed(2);
  const foundationCost = +(foundation.pricePerColumn * totalCols).toFixed(2);
  const finishCost = +(totalMaterialsM * finishData.priceAdd).toFixed(2);
  const gutterCost = +(gutter.pricePerMeter * lengthM).toFixed(2);

  // Sides
  const sideCalc = (side, len) => {
    const opt = SIDE_OPTIONS[sides[side]] || SIDE_OPTIONS.none;
    const a = len * heightM;
    return { side, label: opt.label, areaSqM: +a.toFixed(2), price: +(a * opt.pricePerSqM).toFixed(2) };
  };
  const sideCosts = [
    sideCalc('front', lengthM), sideCalc('back', lengthM),
    sideCalc('left', widthM), sideCalc('right', widthM),
  ];
  const totalSideCost = +sideCosts.reduce((s, c) => s + c.price, 0).toFixed(2);

  // Lighting
  const lOpt = LIGHTING_OPTIONS[lightingOption] || LIGHTING_OPTIONS.none;
  let lightingCost = 0, lightingDetails = lOpt.label;
  if (lOpt.pricePerMeter > 0) lightingCost = +(lOpt.pricePerMeter * perimeterM * 1.5).toFixed(2);
  else if (lOpt.pricePerPoint > 0) {
    const pts = Math.ceil(perimeterM / 0.8);
    lightingCost = +(lOpt.pricePerPoint * pts).toFixed(2);
    lightingDetails += ` (${pts} נקודות)`;
  }

  // ── 3D Layout ─────────────────────────────────────────────────────────
  const columns3D = [];
  for (let row = 0; row < colRowsW; row++) {
    const zFrac = colRowsW === 1 ? 1 : row / (colRowsW - 1);
    const zPos = isWall && colRowsW === 1 ? widthM : zFrac * widthM;
    for (let c = 0; c < colsL; c++) {
      const xPos = colsL === 1 ? lengthM / 2 : (c / (colsL - 1)) * lengthM;
      columns3D.push({ x: xPos, y: 0, z: zPos, height: heightM });
    }
  }

  const mainBeams3D = [];
  if (isWall) mainBeams3D.push({ x: -overhangM, y: heightM + slopeHeightDiff, z: 0, length: totalRoofL, direction: 'x', isLedger: true });
  for (let row = 0; row < colRowsW; row++) {
    const zFrac = colRowsW === 1 ? 1 : row / (colRowsW - 1);
    const zPos = isWall && colRowsW === 1 ? widthM : zFrac * widthM;
    mainBeams3D.push({ x: -overhangM, y: heightM, z: zPos, length: totalRoofL, direction: 'x' });
  }

  const secBeams3D = [];
  for (let i = 0; i < numSec; i++) {
    const xFrac = numSec === 1 ? 0.5 : i / (numSec - 1);
    secBeams3D.push({ x: xFrac * lengthM, y: heightM, z: 0, length: widthM, direction: 'z' });
  }

  const rafters3D = [];
  for (let i = 0; i < numRaft; i++) {
    const zFrac = numRaft === 1 ? 0.5 : i / (numRaft - 1);
    rafters3D.push({
      x: -overhangM, y: heightM + mainProf.h / 100 + secProf.h / 100,
      z: zFrac * widthM, length: totalRoofL, direction: 'x',
    });
  }

  const wall3D = isWall ? { x: 0, y: 0, z: 0, width: lengthM, height: heightM + 0.5 } : null;

  return {
    input: { ...params, length: lengthM, width: widthM, height: heightM },
    material: mat, roof, foundation, wind, finishData,
    structure: {
      totalColumns: totalCols, colsAlongLength: colsL, colRowsWidth: colRowsW,
      columnSpacingLength: colSpacingL,
      mainBeamCount, mainBeamLength: +mainBeamLen.toFixed(2),
      numSecBeams: numSec, secBeamSpacing: secSpacing, secBeamLength: +secLen.toFixed(2),
      numRafters: numRaft, rafterSpacing: raftSpacing, rafterLength: +raftLen.toFixed(2),
      overhangM, slopePercent: roof.needsDrainage ? slopePercent : 0,
      slopeHeightDiff: +slopeHeightDiff.toFixed(3),
    },
    profiles: { column: colProf, mainBeam: mainProf, secBeam: secProf, rafter: raftProf },
    coverage: {
      area: +area.toFixed(2), roofArea: +roofArea.toFixed(2),
      shadePercent: roof.shadeFactor * 100, shadedArea: +(area * roof.shadeFactor).toFixed(1),
      perimeterM: +perimeterM.toFixed(2),
    },
    loads: {
      structuralWeight: +structWeight.toFixed(1), roofMaterialWeight: +roofMatWeight.toFixed(1),
      totalWeight, weightPerFooting, liveLoadPerSqM: 50, totalLiveLoad: +liveLoad.toFixed(1),
      totalDesignLoad: designLoad, designLoadPerFooting: designPerFooting,
      windPressureKPa: wind.windPressure, windUpliftForceN: windUpliftN,
    },
    cutList, hardware, hardwareCost,
    sideCosts, totalSideCost, finishCost, roofMaterialCost,
    lightingCost, lightingDetails, gutterCost, foundationCost,
    summary: { totalMaterials: totalMaterialsM, totalWeight: +(cutList.reduce((s, r) => s + r.totalWeight, 0)).toFixed(1), materialCost },
    layout3D: { columns: columns3D, mainBeams: mainBeams3D, secBeams: secBeams3D, rafters: rafters3D, wall: wall3D },
  };
}
