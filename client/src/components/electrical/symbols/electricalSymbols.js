/**
 * ספריית סמלי חשמל מקצועית - תקן ישראלי ת"י 61
 * Professional Electrical Symbol Library - Israeli Standard SI 61
 * 
 * כל סמל מוגדר כ-SVG path data עם מטא-דאטה מלאה
 * כולל: שם, קטגוריה, חיבורים, עומס חשמלי, וסמל SVG
 */

// ==============================
// SYMBOL CATEGORIES
// ==============================
export const SYMBOL_CATEGORIES = {
  LIGHTING: { id: 'lighting', name: 'תאורה', icon: '💡', color: '#FBBF24' },
  SWITCHES: { id: 'switches', name: 'מפסקים', icon: '🔘', color: '#60A5FA' },
  OUTLETS: { id: 'outlets', name: 'שקעים', icon: '🔌', color: '#34D399' },
  DISTRIBUTION: { id: 'distribution', name: 'לוחות חלוקה', icon: '⚡', color: '#F87171' },
  COMMUNICATION: { id: 'communication', name: 'תקשורת', icon: '📡', color: '#A78BFA' },
  SAFETY: { id: 'safety', name: 'בטיחות', icon: '🛡️', color: '#FB923C' },
  HVAC: { id: 'hvac', name: 'מיזוג', icon: '❄️', color: '#38BDF8' },
  SPECIAL: { id: 'special', name: 'מיוחדים', icon: '⭐', color: '#E879F9' },
};

// ==============================
// CABLE TYPES (Israeli Standard)
// ==============================
export const CABLE_TYPES = {
  '1.5': { section: 1.5, maxCurrent: 16, usage: 'תאורה', color: '#FBBF24' },
  '2.5': { section: 2.5, maxCurrent: 20, usage: 'שקעים רגילים', color: '#34D399' },
  '4': { section: 4, maxCurrent: 27, usage: 'שקעים מוגברים', color: '#60A5FA' },
  '6': { section: 6, maxCurrent: 34, usage: 'מזגנים / דודי שמש', color: '#F87171' },
  '10': { section: 10, maxCurrent: 46, usage: 'תנורים / בויילרים', color: '#A78BFA' },
  '16': { section: 16, maxCurrent: 62, usage: 'מזין ללוח', color: '#FB923C' },
  '25': { section: 25, maxCurrent: 80, usage: 'מזין ראשי', color: '#E879F9' },
};

// ==============================
// BREAKER TYPES
// ==============================
export const BREAKER_TYPES = {
  MCB_6: { rating: 6, type: 'MCB', curve: 'C', usage: 'תאורה קטנה' },
  MCB_10: { rating: 10, type: 'MCB', curve: 'C', usage: 'תאורה' },
  MCB_16: { rating: 16, type: 'MCB', curve: 'C', usage: 'שקעים' },
  MCB_20: { rating: 20, type: 'MCB', curve: 'C', usage: 'שקעים מוגברים' },
  MCB_25: { rating: 25, type: 'MCB', curve: 'C', usage: 'מזגן' },
  MCB_32: { rating: 32, type: 'MCB', curve: 'C', usage: 'תנור' },
  RCCB_40: { rating: 40, type: 'RCCB', sensitivity: 30, usage: 'פחת כללי' },
  RCCB_63: { rating: 63, type: 'RCCB', sensitivity: 30, usage: 'פחת ראשי' },
  RCBO_16: { rating: 16, type: 'RCBO', sensitivity: 30, usage: 'פחת+אוטומט' },
};

// ==============================
// SYMBOL SIZE (base unit for rendering)
// ==============================
const S = 40; // Base symbol size in canvas pixels

// ==============================
// HELPER: Create connection points for a symbol
// ==============================
function createConnections(points) {
  return points.map((p, i) => ({
    id: i,
    x: p.x,
    y: p.y,
    type: p.type || 'any', // 'in', 'out', 'any'
    connected: false,
    wireId: null,
  }));
}

// ==============================
// SYMBOL DEFINITIONS
// ==============================
export const ELECTRICAL_SYMBOLS = {
  // ─────────────────────────────────
  // 💡 LIGHTING - תאורה
  // ─────────────────────────────────
  ceiling_light: {
    id: 'ceiling_light',
    name: 'נורת תקרה',
    nameEn: 'Ceiling Light',
    category: 'lighting',
    defaultWattage: 60,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="8" x2="32" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="8" x2="8" y2="32" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
      { x: 20, y: 40, type: 'out' },
    ]),
  },

  wall_light: {
    id: 'wall_light',
    name: 'מנורת קיר',
    nameEn: 'Wall Light',
    category: 'lighting',
    defaultWattage: 40,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="8" x2="32" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="8" x2="8" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <line x1="4" y1="20" x2="36" y2="20" stroke="currentColor" stroke-width="2.5"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
    ]),
  },

  spotlight: {
    id: 'spotlight',
    name: 'ספוט שקוע',
    nameEn: 'Recessed Spotlight',
    category: 'lighting',
    defaultWattage: 7,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="20" r="4" fill="currentColor"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
    ]),
  },

  fluorescent: {
    id: 'fluorescent',
    name: 'פלורסנט',
    nameEn: 'Fluorescent',
    category: 'lighting',
    defaultWattage: 36,
    defaultVoltage: 230,
    cable: '1.5',
    width: S * 1.5,
    height: S * 0.5,
    svg: `<svg viewBox="0 0 60 20" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="56" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="10" x2="50" y2="10" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 30, y: 0, type: 'in' },
    ]),
  },

  led_panel: {
    id: 'led_panel',
    name: 'פאנל LED',
    nameEn: 'LED Panel',
    category: 'lighting',
    defaultWattage: 40,
    defaultVoltage: 230,
    cable: '1.5',
    width: S * 1.2,
    height: S * 1.2,
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="40" height="40" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="4" x2="44" y2="44" stroke="currentColor" stroke-width="1"/>
      <line x1="44" y1="4" x2="4" y2="44" stroke="currentColor" stroke-width="1"/>
      <circle cx="24" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 24, y: 0, type: 'in' },
    ]),
  },

  emergency_light: {
    id: 'emergency_light',
    name: 'תאורת חירום',
    nameEn: 'Emergency Light',
    category: 'lighting',
    defaultWattage: 8,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="8" x2="32" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="8" x2="8" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <text x="20" y="12" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">E</text>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
    ]),
  },

  outdoor_light: {
    id: 'outdoor_light',
    name: 'תאורת חוץ',
    nameEn: 'Outdoor Light',
    category: 'lighting',
    defaultWattage: 20,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="8" x2="32" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="8" x2="8" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 2"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
    ]),
  },

  chandelier: {
    id: 'chandelier',
    name: 'נברשת',
    nameEn: 'Chandelier',
    category: 'lighting',
    defaultWattage: 200,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="8" x2="32" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="8" x2="8" y2="32" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="20" cy="20" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
    ]),
  },

  // ─────────────────────────────────
  // 🔘 SWITCHES - מפסקים
  // ─────────────────────────────────
  single_switch: {
    id: 'single_switch',
    name: 'מפסק יחיד',
    nameEn: 'Single Switch',
    category: 'switches',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="30" r="4" fill="currentColor"/>
      <line x1="20" y1="26" x2="35" y2="8" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 30, type: 'in' },
      { x: 40, y: 30, type: 'out' },
    ]),
  },

  double_switch: {
    id: 'double_switch',
    name: 'מפסק כפול',
    nameEn: 'Double Switch',
    category: 'switches',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="30" r="4" fill="currentColor"/>
      <line x1="20" y1="26" x2="35" y2="8" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="26" x2="30" y2="5" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 30, type: 'in' },
      { x: 40, y: 30, type: 'out' },
    ]),
  },

  triple_switch: {
    id: 'triple_switch',
    name: 'מפסק שלישיה',
    nameEn: 'Triple Switch',
    category: 'switches',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="30" r="4" fill="currentColor"/>
      <line x1="20" y1="26" x2="35" y2="8" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="26" x2="30" y2="5" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="26" x2="25" y2="3" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 30, type: 'in' },
      { x: 40, y: 30, type: 'out' },
    ]),
  },

  two_way_switch: {
    id: 'two_way_switch',
    name: 'מפסק חליפין',
    nameEn: 'Two-Way Switch',
    category: 'switches',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="30" r="4" fill="currentColor"/>
      <line x1="20" y1="26" x2="35" y2="8" stroke="currentColor" stroke-width="2"/>
      <line x1="35" y1="8" x2="30" y2="8" stroke="currentColor" stroke-width="2"/>
      <line x1="35" y1="8" x2="35" y2="13" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 30, type: 'in' },
      { x: 40, y: 30, type: 'out' },
    ]),
  },

  dimmer_switch: {
    id: 'dimmer_switch',
    name: 'דימר',
    nameEn: 'Dimmer Switch',
    category: 'switches',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="30" r="4" fill="currentColor"/>
      <line x1="20" y1="26" x2="35" y2="8" stroke="currentColor" stroke-width="2"/>
      <text x="34" y="20" font-size="12" font-weight="bold" fill="currentColor">D</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 30, type: 'in' },
      { x: 40, y: 30, type: 'out' },
    ]),
  },

  motion_switch: {
    id: 'motion_switch',
    name: 'חיישן תנועה',
    nameEn: 'Motion Sensor Switch',
    category: 'switches',
    defaultWattage: 1,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="30" r="4" fill="currentColor"/>
      <line x1="20" y1="26" x2="35" y2="8" stroke="currentColor" stroke-width="2"/>
      <path d="M28 15 Q35 10 28 5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M31 17 Q40 10 31 3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 30, type: 'in' },
      { x: 40, y: 30, type: 'out' },
    ]),
  },

  // ─────────────────────────────────
  // 🔌 OUTLETS - שקעים
  // ─────────────────────────────────
  single_outlet: {
    id: 'single_outlet',
    name: 'שקע יחיד',
    nameEn: 'Single Outlet',
    category: 'outlets',
    defaultWattage: 0,
    maxWattage: 3680,
    defaultVoltage: 230,
    cable: '2.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  double_outlet: {
    id: 'double_outlet',
    name: 'שקע כפול',
    nameEn: 'Double Outlet',
    category: 'outlets',
    defaultWattage: 0,
    maxWattage: 3680,
    defaultVoltage: 230,
    cable: '2.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" stroke-width="1.5"/>
      <line x1="12" y1="4" x2="12" y2="36" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  triple_outlet: {
    id: 'triple_outlet',
    name: 'שקע משולש',
    nameEn: 'Triple Outlet',
    category: 'outlets',
    defaultWattage: 0,
    maxWattage: 3680,
    defaultVoltage: 230,
    cable: '2.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" stroke-width="1.5"/>
      <line x1="12" y1="4" x2="12" y2="36" stroke="currentColor" stroke-width="1.5"/>
      <line x1="28" y1="4" x2="28" y2="36" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  waterproof_outlet: {
    id: 'waterproof_outlet',
    name: 'שקע מוגן מים',
    nameEn: 'Waterproof Outlet',
    category: 'outlets',
    defaultWattage: 0,
    maxWattage: 3680,
    defaultVoltage: 230,
    cable: '2.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" stroke-width="1.5"/>
      <text x="20" y="16" text-anchor="middle" font-size="8" fill="currentColor">WP</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  ac_outlet: {
    id: 'ac_outlet',
    name: 'שקע מזגן',
    nameEn: 'AC Outlet',
    category: 'outlets',
    defaultWattage: 2500,
    defaultVoltage: 230,
    cable: '4',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" stroke-width="1.5"/>
      <text x="20" y="25" text-anchor="middle" font-size="9" font-weight="bold" fill="currentColor">AC</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  oven_outlet: {
    id: 'oven_outlet',
    name: 'שקע תנור',
    nameEn: 'Oven Outlet',
    category: 'outlets',
    defaultWattage: 3500,
    defaultVoltage: 230,
    cable: '6',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" stroke-width="1.5"/>
      <text x="20" y="25" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">OVEN</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  dryer_outlet: {
    id: 'dryer_outlet',
    name: 'שקע מייבש',
    nameEn: 'Dryer Outlet',
    category: 'outlets',
    defaultWattage: 2800,
    defaultVoltage: 230,
    cable: '4',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" stroke-width="1.5"/>
      <text x="20" y="25" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">DRY</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  floor_outlet: {
    id: 'floor_outlet',
    name: 'שקע רצפתי',
    nameEn: 'Floor Outlet',
    category: 'outlets',
    defaultWattage: 0,
    maxWattage: 3680,
    defaultVoltage: 230,
    cable: '2.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="20" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="20" y1="10" x2="20" y2="30" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  // ─────────────────────────────────
  // ⚡ DISTRIBUTION - לוחות חלוקה
  // ─────────────────────────────────
  electrical_panel: {
    id: 'electrical_panel',
    name: 'לוח חשמל',
    nameEn: 'Electrical Panel',
    category: 'distribution',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '16',
    width: S * 2,
    height: S * 1.5,
    svg: `<svg viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="76" height="56" rx="3" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <line x1="2" y1="15" x2="78" y2="15" stroke="currentColor" stroke-width="1.5"/>
      <text x="40" y="12" text-anchor="middle" font-size="8" font-weight="bold" fill="currentColor">לוח חשמל</text>
      <line x1="20" y1="25" x2="20" y2="50" stroke="currentColor" stroke-width="2"/>
      <line x1="40" y1="25" x2="40" y2="50" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="25" x2="60" y2="50" stroke="currentColor" stroke-width="2"/>
      <rect x="15" y="25" width="10" height="6" fill="currentColor" rx="1"/>
      <rect x="35" y="25" width="10" height="6" fill="currentColor" rx="1"/>
      <rect x="55" y="25" width="10" height="6" fill="currentColor" rx="1"/>
    </svg>`,
    connections: createConnections([
      { x: 40, y: 0, type: 'in' },
      { x: 10, y: 60, type: 'out' },
      { x: 30, y: 60, type: 'out' },
      { x: 50, y: 60, type: 'out' },
      { x: 70, y: 60, type: 'out' },
    ]),
  },

  sub_panel: {
    id: 'sub_panel',
    name: 'לוח משני',
    nameEn: 'Sub Panel',
    category: 'distribution',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '10',
    width: S * 1.5,
    height: S,
    svg: `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="56" height="36" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="30" y="24" text-anchor="middle" font-size="8" font-weight="bold" fill="currentColor">SUB</text>
    </svg>`,
    connections: createConnections([
      { x: 30, y: 0, type: 'in' },
      { x: 10, y: 40, type: 'out' },
      { x: 30, y: 40, type: 'out' },
      { x: 50, y: 40, type: 'out' },
    ]),
  },

  main_breaker: {
    id: 'main_breaker',
    name: 'מפסק ראשי',
    nameEn: 'Main Breaker',
    category: 'distribution',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '25',
    width: S,
    height: S * 1.2,
    svg: `<svg viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="32" height="40" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="4" x2="20" y2="18" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="22" r="3" fill="currentColor"/>
      <line x1="20" y1="25" x2="30" y2="35" stroke="currentColor" stroke-width="2.5"/>
      <line x1="20" y1="38" x2="20" y2="44" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
      { x: 20, y: 48, type: 'out' },
    ]),
  },

  rcd: {
    id: 'rcd',
    name: 'ממסר פחת',
    nameEn: 'RCD / RCCB',
    category: 'distribution',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '6',
    width: S,
    height: S * 1.2,
    svg: `<svg viewBox="0 0 40 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="32" height="40" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="4" x2="20" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="20" r="3" fill="currentColor"/>
      <line x1="20" y1="23" x2="30" y2="33" stroke="currentColor" stroke-width="2.5"/>
      <line x1="20" y1="36" x2="20" y2="44" stroke="currentColor" stroke-width="2"/>
      <text x="36" y="28" font-size="6" fill="currentColor">30mA</text>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
      { x: 20, y: 48, type: 'out' },
    ]),
  },

  // ─────────────────────────────────
  // 📡 COMMUNICATION - תקשורת
  // ─────────────────────────────────
  phone_outlet: {
    id: 'phone_outlet',
    name: 'שקע טלפון',
    nameEn: 'Phone Outlet',
    category: 'communication',
    defaultWattage: 0,
    defaultVoltage: 0,
    cable: 'CAT3',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="32" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="20" y="25" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor">T</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  network_outlet: {
    id: 'network_outlet',
    name: 'שקע רשת',
    nameEn: 'Network Outlet',
    category: 'communication',
    defaultWattage: 0,
    defaultVoltage: 0,
    cable: 'CAT6',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="32" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="20" y="25" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">RJ</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  tv_outlet: {
    id: 'tv_outlet',
    name: 'שקע טלוויזיה',
    nameEn: 'TV Outlet',
    category: 'communication',
    defaultWattage: 0,
    defaultVoltage: 0,
    cable: 'COAX',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="32" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="20" y="25" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">TV</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  intercom: {
    id: 'intercom',
    name: 'אינטרקום',
    nameEn: 'Intercom',
    category: 'communication',
    defaultWattage: 5,
    defaultVoltage: 12,
    cable: '0.75',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="28" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="16" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <rect x="12" y="26" width="16" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
    ]),
  },

  wifi_ap: {
    id: 'wifi_ap',
    name: 'נקודת WiFi',
    nameEn: 'WiFi Access Point',
    category: 'communication',
    defaultWattage: 15,
    defaultVoltage: 48,
    cable: 'CAT6',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="28" r="3" fill="currentColor"/>
      <path d="M12 22 Q20 14 28 22" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M8 18 Q20 6 32 18" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M4 14 Q20 -2 36 14" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 40, type: 'in' },
    ]),
  },

  // ─────────────────────────────────
  // 🛡️ SAFETY - בטיחות
  // ─────────────────────────────────
  smoke_detector: {
    id: 'smoke_detector',
    name: 'גלאי עשן',
    nameEn: 'Smoke Detector',
    category: 'safety',
    defaultWattage: 1,
    defaultVoltage: 9,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="20" y="18" text-anchor="middle" font-size="8" font-weight="bold" fill="currentColor">SD</text>
      <path d="M14 24 Q17 20 20 24 Q23 28 26 24" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 40, type: 'in' },
    ]),
  },

  fire_alarm: {
    id: 'fire_alarm',
    name: 'לחצן אש',
    nameEn: 'Fire Alarm Button',
    category: 'safety',
    defaultWattage: 1,
    defaultVoltage: 24,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="32" height="32" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <text x="20" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="currentColor">🔥</text>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 40, type: 'in' },
    ]),
  },

  emergency_button: {
    id: 'emergency_button',
    name: 'לחצן מצוקה',
    nameEn: 'Emergency Button',
    category: 'safety',
    defaultWattage: 0,
    defaultVoltage: 24,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <text x="20" y="26" text-anchor="middle" font-size="16" font-weight="bold" fill="currentColor">!</text>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 40, type: 'in' },
    ]),
  },

  ground_point: {
    id: 'ground_point',
    name: 'נקודת הארקה',
    nameEn: 'Ground Point',
    category: 'safety',
    defaultWattage: 0,
    defaultVoltage: 0,
    cable: '6',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="4" x2="20" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="18" x2="32" y2="18" stroke="currentColor" stroke-width="2.5"/>
      <line x1="12" y1="24" x2="28" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="30" x2="24" y2="30" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
    ]),
  },

  // ─────────────────────────────────
  // ❄️ HVAC - מיזוג
  // ─────────────────────────────────
  ac_indoor: {
    id: 'ac_indoor',
    name: 'מזגן פנימי',
    nameEn: 'AC Indoor Unit',
    category: 'hvac',
    defaultWattage: 1200,
    defaultVoltage: 230,
    cable: '4',
    width: S * 1.5,
    height: S * 0.6,
    svg: `<svg viewBox="0 0 60 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="56" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="18" x2="50" y2="18" stroke="currentColor" stroke-width="1"/>
      <line x1="10" y1="15" x2="50" y2="15" stroke="currentColor" stroke-width="1"/>
      <text x="30" y="12" text-anchor="middle" font-size="7" fill="currentColor">AC</text>
    </svg>`,
    connections: createConnections([
      { x: 30, y: 24, type: 'in' },
    ]),
  },

  ac_outdoor: {
    id: 'ac_outdoor',
    name: 'מזגן חיצוני',
    nameEn: 'AC Outdoor Unit',
    category: 'hvac',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '4',
    width: S * 1.2,
    height: S,
    svg: `<svg viewBox="0 0 48 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="44" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="8" x2="24" y2="32" stroke="currentColor" stroke-width="1"/>
      <line x1="12" y1="20" x2="36" y2="20" stroke="currentColor" stroke-width="1"/>
    </svg>`,
    connections: createConnections([
      { x: 24, y: 0, type: 'in' },
    ]),
  },

  boiler: {
    id: 'boiler',
    name: 'בויילר',
    nameEn: 'Electric Boiler',
    category: 'hvac',
    defaultWattage: 3000,
    defaultVoltage: 230,
    cable: '4',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M16 14 Q18 10 20 14 Q22 18 24 14 Q26 10 28 14" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="20" y="30" text-anchor="middle" font-size="8" font-weight="bold" fill="currentColor">BLR</text>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 40, type: 'in' },
    ]),
  },

  solar_heater: {
    id: 'solar_heater',
    name: 'דוד שמש',
    nameEn: 'Solar Water Heater',
    category: 'hvac',
    defaultWattage: 2000,
    defaultVoltage: 230,
    cable: '2.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="20" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="20" y1="4" x2="20" y2="8" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="32" x2="20" y2="36" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="20" x2="8" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="20" x2="36" y2="20" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 40, type: 'in' },
    ]),
  },

  fan: {
    id: 'fan',
    name: 'מאוורר תקרה',
    nameEn: 'Ceiling Fan',
    category: 'hvac',
    defaultWattage: 75,
    defaultVoltage: 230,
    cable: '1.5',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="20" r="4" fill="currentColor"/>
      <line x1="20" y1="4" x2="20" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="24" x2="20" y2="36" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="20" x2="16" y2="20" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="20" x2="36" y2="20" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 0, type: 'in' },
    ]),
  },

  // ─────────────────────────────────
  // ⭐ SPECIAL - מיוחדים
  // ─────────────────────────────────
  electric_meter: {
    id: 'electric_meter',
    name: 'מונה חשמל',
    nameEn: 'Electric Meter',
    category: 'special',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '25',
    width: S * 1.2,
    height: S * 1.5,
    svg: `<svg viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="40" height="52" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="10" y="10" width="28" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="24" y="22" text-anchor="middle" font-size="8" fill="currentColor">kWh</text>
      <circle cx="24" cy="42" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    connections: createConnections([
      { x: 24, y: 0, type: 'in' },
      { x: 24, y: 60, type: 'out' },
    ]),
  },

  doorbell: {
    id: 'doorbell',
    name: 'פעמון דלת',
    nameEn: 'Doorbell',
    category: 'special',
    defaultWattage: 5,
    defaultVoltage: 12,
    cable: '0.75',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M14 24 Q20 8 26 24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="24" x2="20" y2="30" stroke="currentColor" stroke-width="2"/>
      <circle cx="20" cy="32" r="2" fill="currentColor"/>
    </svg>`,
    connections: createConnections([
      { x: 20, y: 40, type: 'in' },
    ]),
  },

  ev_charger: {
    id: 'ev_charger',
    name: 'עמדת טעינה חשמלית',
    nameEn: 'EV Charger',
    category: 'special',
    defaultWattage: 7400,
    defaultVoltage: 230,
    cable: '10',
    width: S * 1.2,
    height: S * 1.5,
    svg: `<svg viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="40" height="52" rx="4" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <path d="M28 16 L20 32 L28 32 L20 48" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <text x="24" y="12" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor">EV</text>
    </svg>`,
    connections: createConnections([
      { x: 24, y: 0, type: 'in' },
    ]),
  },

  generator: {
    id: 'generator',
    name: 'גנרטור',
    nameEn: 'Generator',
    category: 'special',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '16',
    width: S * 1.5,
    height: S,
    svg: `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="30" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="currentColor">G</text>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'out' },
      { x: 60, y: 20, type: 'out' },
    ]),
  },

  ups: {
    id: 'ups',
    name: 'אל-פסק',
    nameEn: 'UPS',
    category: 'special',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '4',
    width: S * 1.2,
    height: S,
    svg: `<svg viewBox="0 0 48 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="40" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="24" y="18" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">UPS</text>
      <rect x="14" y="22" width="20" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <rect x="16" y="24" width="6" height="4" fill="currentColor"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
      { x: 48, y: 20, type: 'out' },
    ]),
  },

  solar_panel: {
    id: 'solar_panel',
    name: 'פאנל סולארי',
    nameEn: 'Solar Panel',
    category: 'special',
    defaultWattage: 400,
    defaultVoltage: 48,
    cable: '6',
    width: S * 1.5,
    height: S,
    svg: `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="56" height="36" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="20" y1="2" x2="20" y2="38" stroke="currentColor" stroke-width="1"/>
      <line x1="40" y1="2" x2="40" y2="38" stroke="currentColor" stroke-width="1"/>
      <line x1="2" y1="14" x2="58" y2="14" stroke="currentColor" stroke-width="1"/>
      <line x1="2" y1="26" x2="58" y2="26" stroke="currentColor" stroke-width="1"/>
      <text x="30" y="22" text-anchor="middle" font-size="6" fill="currentColor">PV</text>
    </svg>`,
    connections: createConnections([
      { x: 30, y: 40, type: 'out' },
    ]),
  },

  transformer: {
    id: 'transformer',
    name: 'שנאי',
    nameEn: 'Transformer',
    category: 'special',
    defaultWattage: 0,
    defaultVoltage: 230,
    cable: '10',
    width: S,
    height: S,
    svg: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="20" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="26" cy="20" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    connections: createConnections([
      { x: 0, y: 20, type: 'in' },
      { x: 40, y: 20, type: 'out' },
    ]),
  },
};

// ==============================
// UTILITY FUNCTIONS
// ==============================

/**
 * Get all symbols for a specific category
 */
export function getSymbolsByCategory(categoryId) {
  return Object.values(ELECTRICAL_SYMBOLS).filter(s => s.category === categoryId);
}

/**
 * Get a symbol by its ID
 */
export function getSymbolById(symbolId) {
  return ELECTRICAL_SYMBOLS[symbolId] || null;
}

/**
 * Get all categories with their symbols
 */
export function getCategoriesWithSymbols() {
  return Object.values(SYMBOL_CATEGORIES).map(cat => ({
    ...cat,
    symbols: getSymbolsByCategory(cat.id),
  }));
}

/**
 * Calculate symbol load in Amps
 */
export function getSymbolLoadAmps(symbol) {
  if (!symbol.defaultWattage || !symbol.defaultVoltage) return 0;
  return symbol.defaultWattage / symbol.defaultVoltage;
}

/**
 * Get recommended breaker for a symbol
 */
export function getRecommendedBreaker(totalWattage, voltage = 230) {
  const current = totalWattage / voltage;
  const ratings = [6, 10, 16, 20, 25, 32, 40, 50, 63];
  return ratings.find(r => r >= current * 1.25) || 63; // 1.25 safety factor
}

/**
 * Get recommended cable for current
 */
export function getRecommendedCable(current) {
  const sections = [
    { section: 1.5, maxCurrent: 16 },
    { section: 2.5, maxCurrent: 20 },
    { section: 4, maxCurrent: 27 },
    { section: 6, maxCurrent: 34 },
    { section: 10, maxCurrent: 46 },
    { section: 16, maxCurrent: 62 },
    { section: 25, maxCurrent: 80 },
  ];
  return sections.find(s => s.maxCurrent >= current) || sections[sections.length - 1];
}

/**
 * Generate Bill of Materials from placed symbols
 */
export function generateBOM(placedSymbols) {
  const bom = {};
  placedSymbols.forEach(placed => {
    const sym = ELECTRICAL_SYMBOLS[placed.symbolId];
    if (!sym) return;
    if (!bom[sym.id]) {
      bom[sym.id] = {
        symbol: sym,
        count: 0,
        totalWattage: 0,
      };
    }
    bom[sym.id].count++;
    bom[sym.id].totalWattage += (placed.wattage || sym.defaultWattage);
  });
  return Object.values(bom);
}

export default ELECTRICAL_SYMBOLS;
