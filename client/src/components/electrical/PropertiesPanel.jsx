/**
 * PropertiesPanel - פאנל מאפייני אלמנט נבחר
 * Properties panel for selected electrical elements
 */
import { useMemo } from 'react';
import { Settings, Zap, Cable, RotateCw, Palette, Trash2, Copy, Lock, Unlock } from 'lucide-react';
import useElectricalStore from '../../stores/electricalStore';
import { getSymbolById, CABLE_TYPES } from './symbols/electricalSymbols';

export default function PropertiesPanel() {
  const store = useElectricalStore();
  
  if (!store.showPropertiesPanel) return null;

  const selectedElements = useMemo(() => {
    return store.selectedElementIds
      .map(id => store.elements.find(el => el.id === id))
      .filter(Boolean);
  }, [store.selectedElementIds, store.elements]);

  // Nothing selected
  if (selectedElements.length === 0) {
    return (
      <div className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 overflow-y-auto" dir="rtl">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          <Settings size={16} />
          מאפיינים
        </h3>
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">
          <p>בחר אלמנט לצפייה במאפיינים</p>
          <p className="mt-1">או לחיצה כפולה לעריכה</p>
        </div>
        
        {/* Project Properties */}
        <ProjectProperties />
      </div>
    );
  }

  // Multiple selection
  if (selectedElements.length > 1) {
    return (
      <div className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 overflow-y-auto" dir="rtl">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">
          {selectedElements.length} אלמנטים נבחרו
        </h3>
        <MultiSelectionActions elements={selectedElements} />
      </div>
    );
  }

  // Single selection
  const element = selectedElements[0];
  const symbolDef = getSymbolById(element.symbolId);

  return (
    <div className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2">
          {symbolDef && (
            <div
              className="w-8 h-8 flex-shrink-0"
              style={{ color: store.circuits.find(c => c.id === element.circuit)?.color || '#3B82F6' }}
              dangerouslySetInnerHTML={{ __html: symbolDef.svg }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">
              {symbolDef?.name || element.symbolId}
            </p>
            <p className="text-[10px] text-gray-400">{symbolDef?.nameEn}</p>
          </div>
        </div>
        
        {/* Quick actions */}
        <div className="flex items-center gap-1 mt-2">
          <button 
            onClick={() => store.duplicateElements([element.id])}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
            title="שכפל"
          >
            <Copy size={14} />
          </button>
          <button 
            onClick={() => store.updateElement(element.id, { rotation: ((element.rotation || 0) + 90) % 360 })}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
            title="סובב"
          >
            <RotateCw size={14} />
          </button>
          <button 
            onClick={() => store.updateElement(element.id, { locked: !element.locked })}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
            title={element.locked ? 'שחרר נעילה' : 'נעל'}
          >
            {element.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <div className="flex-1" />
          <button 
            onClick={() => store.removeElements([element.id])}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            title="מחק"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Properties Form */}
      <div className="p-3 space-y-3">
        {/* Position */}
        <PropertySection title="מיקום" icon="📍">
          <div className="grid grid-cols-2 gap-2">
            <PropertyInput
              label="X"
              value={Math.round(element.x)}
              onChange={(v) => store.updateElement(element.id, { x: Number(v) })}
              type="number"
            />
            <PropertyInput
              label="Y"
              value={Math.round(element.y)}
              onChange={(v) => store.updateElement(element.id, { y: Number(v) })}
              type="number"
            />
          </div>
          <PropertyInput
            label="סיבוב"
            value={element.rotation || 0}
            onChange={(v) => store.updateElement(element.id, { rotation: Number(v) })}
            type="number"
            suffix="°"
          />
        </PropertySection>

        {/* Electrical Properties */}
        <PropertySection title="מאפייני חשמל" icon="⚡">
          <PropertyInput
            label="הספק (W)"
            value={element.wattage || symbolDef?.defaultWattage || 0}
            onChange={(v) => store.updateElement(element.id, { wattage: Number(v) })}
            type="number"
          />
          <PropertyInput
            label="מתח (V)"
            value={element.voltage || symbolDef?.defaultVoltage || 230}
            onChange={(v) => store.updateElement(element.id, { voltage: Number(v) })}
            type="number"
          />
          {element.wattage > 0 && element.voltage > 0 && (
            <div className="text-[10px] bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 text-blue-700 dark:text-blue-300">
              זרם: {(element.wattage / element.voltage).toFixed(2)}A
            </div>
          )}
          <div className="mt-1">
            <label className="text-[10px] text-gray-500 dark:text-gray-400">כבל:</label>
            <select
              value={element.cable || symbolDef?.cable || '2.5'}
              onChange={(e) => store.updateElement(element.id, { cable: e.target.value })}
              className="w-full text-xs p-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white mt-0.5"
            >
              {Object.entries(CABLE_TYPES).map(([key, val]) => (
                <option key={key} value={key}>
                  {key}mm² - {val.usage} (עד {val.maxCurrent}A)
                </option>
              ))}
            </select>
          </div>
        </PropertySection>

        {/* Circuit Assignment */}
        <PropertySection title="שיוך למעגל" icon="🔄">
          <select
            value={element.circuit || ''}
            onChange={(e) => store.updateElement(element.id, { circuit: e.target.value })}
            className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="">ללא מעגל</option>
            {store.circuits.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.breaker}A / {c.cable}mm²)
              </option>
            ))}
          </select>
          {element.circuit && (
            <div className="flex items-center gap-1 mt-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: store.circuits.find(c => c.id === element.circuit)?.color }} 
              />
              <span className="text-[10px] text-gray-500">
                {store.circuits.find(c => c.id === element.circuit)?.name}
              </span>
            </div>
          )}
        </PropertySection>

        {/* Label */}
        <PropertySection title="תגית" icon="🏷️">
          <PropertyInput
            label="שם"
            value={element.label || ''}
            onChange={(v) => store.updateElement(element.id, { label: v })}
            type="text"
            placeholder={symbolDef?.name || 'ללא שם'}
          />
          <PropertyInput
            label="הערה"
            value={element.note || ''}
            onChange={(v) => store.updateElement(element.id, { note: v })}
            type="text"
            placeholder="הערה..."
          />
        </PropertySection>

        {/* Layer */}
        <PropertySection title="שכבה" icon="📋">
          <select
            value={element.layer || 'electrical'}
            onChange={(e) => store.updateElement(element.id, { layer: e.target.value })}
            className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
          >
            {store.layers.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </PropertySection>
      </div>
    </div>
  );
}

// ──────────────────────────
// Sub-components
// ──────────────────────────

function PropertySection({ title, icon, children }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1">
        <span>{icon}</span>
        {title}
      </h4>
      <div className="space-y-1.5 pr-1">
        {children}
      </div>
    </div>
  );
}

function PropertyInput({ label, value, onChange, type = 'text', suffix, placeholder }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[10px] text-gray-500 dark:text-gray-400 w-14 flex-shrink-0">{label}:</label>
      <div className="flex-1 relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-xs p-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
        />
        {suffix && (
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function MultiSelectionActions({ elements }) {
  const store = useElectricalStore();
  const ids = elements.map(e => e.id);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        פעולות על {elements.length} אלמנטים:
      </p>
      
      <div className="space-y-1.5">
        <select
          onChange={(e) => {
            if (e.target.value) store.assignToCircuit(ids, e.target.value);
          }}
          className="w-full text-xs p-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
          defaultValue=""
        >
          <option value="" disabled>שייך למעגל...</option>
          {store.circuits.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex gap-1">
          <button
            onClick={() => store.duplicateElements(ids)}
            className="flex-1 text-xs px-2 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-100"
          >
            שכפל
          </button>
          <button
            onClick={() => store.removeElements(ids)}
            className="flex-1 text-xs px-2 py-1.5 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-100"
          >
            מחק
          </button>
        </div>
      </div>
      
      {/* Summary */}
      <div className="text-[10px] text-gray-400 space-y-0.5 border-t border-gray-100 dark:border-gray-700 pt-2">
        <p>סה"כ הספק: {elements.reduce((s, e) => s + (e.wattage || 0), 0)}W</p>
        <p>זרם כולל: {(elements.reduce((s, e) => s + (e.wattage || 0), 0) / 230).toFixed(2)}A</p>
      </div>
    </div>
  );
}

function ProjectProperties() {
  const store = useElectricalStore();
  
  return (
    <div className="mt-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">הגדרות פרויקט</h4>
      
      <PropertyInput
        label="קנה מידה"
        value={store.projectScale}
        onChange={(v) => store.setProjectScale(Number(v))}
        type="number"
        suffix="1:"
      />
      
      <PropertyInput
        label="רשת"
        value={store.gridSize}
        onChange={(v) => store.setGridSize(Number(v))}
        type="number"
        suffix="px"
      />

      <div className="text-[10px] text-gray-400 space-y-0.5">
        <p>סה"כ אלמנטים: {store.elements.length}</p>
        <p>סה"כ חיווטים: {store.wires.length}</p>
        <p>סה"כ קירות: {store.walls.length}</p>
        <p>מעגלים: {store.circuits.length}</p>
        {store.lastSaved && (
          <p>שמירה אחרונה: {new Date(store.lastSaved).toLocaleString('he-IL')}</p>
        )}
      </div>
    </div>
  );
}
