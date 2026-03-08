/**
 * LayerPanel - פאנל שכבות + מעגלים
 * Layer management and circuit management panel
 */
import { useState } from 'react';
import {
  Eye, EyeOff, Lock, Unlock, Trash2, Plus, ChevronDown, ChevronLeft,
  Layers, Zap, AlertTriangle, CheckCircle,
} from 'lucide-react';
import useElectricalStore from '../../stores/electricalStore';
import { analyzeCircuit } from '../../utils/electricalEngine';

export default function LayerPanel() {
  const store = useElectricalStore();
  const [activeTab, setActiveTab] = useState('layers'); // layers, circuits
  const [newCircuitName, setNewCircuitName] = useState('');

  if (!store.showLayerPanel) return null;

  return (
    <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden" dir="rtl">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 text-xs py-2 px-3 font-medium transition-colors flex items-center justify-center gap-1
            ${activeTab === 'layers' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
        >
          <Layers size={14} />
          שכבות
        </button>
        <button
          onClick={() => setActiveTab('circuits')}
          className={`flex-1 text-xs py-2 px-3 font-medium transition-colors flex items-center justify-center gap-1
            ${activeTab === 'circuits' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
        >
          <Zap size={14} />
          מעגלים
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'layers' ? (
          <LayersTab />
        ) : (
          <CircuitsTab 
            newCircuitName={newCircuitName}
            setNewCircuitName={setNewCircuitName}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────
// Layers Tab
// ──────────────────────────
function LayersTab() {
  const store = useElectricalStore();

  return (
    <div className="p-2 space-y-1">
      {store.layers.map(layer => {
        const elementCount = store.elements.filter(el => el.layer === layer.id).length;
        const isActive = store.activeLayer === layer.id;

        return (
          <div
            key={layer.id}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all cursor-pointer
              ${isActive 
                ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
              }`}
            onClick={() => store.setActiveLayer(layer.id)}
          >
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 border border-white dark:border-gray-700 shadow-sm"
              style={{ backgroundColor: layer.color, opacity: layer.opacity }}
            />

            {/* Layer name */}
            <span className={`flex-1 text-xs truncate ${isActive ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
              {layer.name}
            </span>

            {/* Element count */}
            <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded">
              {elementCount}
            </span>

            {/* Visibility toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                store.toggleLayerVisibility(layer.id);
              }}
              className={`p-0.5 rounded ${layer.visible ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300'}`}
              title={layer.visible ? 'הסתר' : 'הצג'}
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>

            {/* Lock toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                store.toggleLayerLock(layer.id);
              }}
              className={`p-0.5 rounded ${layer.locked ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'}`}
              title={layer.locked ? 'שחרר' : 'נעל'}
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        );
      })}

      {/* Opacity slider for active layer */}
      <div className="mt-3 px-2">
        <label className="text-[10px] text-gray-500 dark:text-gray-400">
          שקיפות שכבה: {Math.round((store.layers.find(l => l.id === store.activeLayer)?.opacity || 1) * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={(store.layers.find(l => l.id === store.activeLayer)?.opacity || 1) * 100}
          onChange={(e) => store.setLayerOpacity(store.activeLayer, Number(e.target.value) / 100)}
          className="w-full h-1.5 accent-blue-600"
        />
      </div>

      {/* Floor plan opacity */}
      {store.floorPlanImage && (
        <div className="mt-2 px-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <label className="text-[10px] text-gray-500 dark:text-gray-400">
            שקיפות תכנית: {Math.round(store.floorPlanOpacity * 100)}%
          </label>
          <input
            type="range"
            min="5"
            max="100"
            value={store.floorPlanOpacity * 100}
            onChange={(e) => store.setFloorPlanTransform({ opacity: Number(e.target.value) / 100 })}
            className="w-full h-1.5 accent-green-600"
          />
          <button
            onClick={() => store.removeFloorPlan()}
            className="text-[10px] text-red-500 hover:text-red-700 mt-1"
          >
            הסר תכנית קומה
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────
// Circuits Tab
// ──────────────────────────
function CircuitsTab({ newCircuitName, setNewCircuitName }) {
  const store = useElectricalStore();
  const [expandedCircuit, setExpandedCircuit] = useState(null);

  const handleAddCircuit = () => {
    if (!newCircuitName.trim()) return;
    const colors = ['#FBBF24', '#34D399', '#38BDF8', '#F87171', '#A78BFA', '#FB923C', '#E879F9', '#6EE7B7'];
    const color = colors[store.circuits.length % colors.length];
    store.addCircuit({
      name: newCircuitName.trim(),
      type: 'general',
      breaker: 16,
      cable: 2.5,
      color,
    });
    setNewCircuitName('');
  };

  return (
    <div className="p-2 space-y-1.5">
      {store.circuits.map(circuit => {
        const circuitElements = store.elements.filter(el => el.circuit === circuit.id);
        const totalWatts = circuitElements.reduce((s, el) => s + (el.wattage || 0), 0);
        const currentA = totalWatts / 230;
        const isOverloaded = currentA > circuit.breaker;
        const isActive = store.activeCircuit === circuit.id;
        const isExpanded = expandedCircuit === circuit.id;

        return (
          <div key={circuit.id} className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Circuit header */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-all
                ${isActive ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
              onClick={() => store.setActiveCircuit(circuit.id)}
            >
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: circuit.color }}
              />
              <span className={`flex-1 text-xs truncate ${isActive ? 'font-semibold' : ''} dark:text-gray-200`}>
                {circuit.name}
              </span>
              
              {/* Status indicator */}
              {isOverloaded ? (
                <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
              ) : circuitElements.length > 0 ? (
                <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
              ) : null}

              <span className="text-[9px] text-gray-400">{circuitElements.length}</span>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCircuit(isExpanded ? null : circuit.id);
                }}
                className="p-0.5 text-gray-400"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
              </button>
            </div>

            {/* Expanded circuit details */}
            {isExpanded && (
              <div className="px-2 pb-2 space-y-1.5 bg-gray-50/50 dark:bg-gray-900/30">
                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="bg-white dark:bg-gray-800 rounded px-1.5 py-1">
                    <span className="text-gray-400">הספק: </span>
                    <span className={`font-mono ${isOverloaded ? 'text-red-500' : 'dark:text-white'}`}>
                      {totalWatts}W
                    </span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded px-1.5 py-1">
                    <span className="text-gray-400">זרם: </span>
                    <span className={`font-mono ${isOverloaded ? 'text-red-500' : 'dark:text-white'}`}>
                      {currentA.toFixed(1)}A
                    </span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded px-1.5 py-1">
                    <span className="text-gray-400">מפסק: </span>
                    <span className="font-mono dark:text-white">{circuit.breaker}A</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded px-1.5 py-1">
                    <span className="text-gray-400">כבל: </span>
                    <span className="font-mono dark:text-white">{circuit.cable}mm²</span>
                  </div>
                </div>

                {/* Load bar */}
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOverloaded ? 'bg-red-500' : currentA / circuit.breaker > 0.8 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, (currentA / circuit.breaker) * 100)}%` }}
                  />
                </div>

                {/* Edit controls */}
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="text-[9px] text-gray-400">מפסק (A):</label>
                    <select
                      value={circuit.breaker}
                      onChange={(e) => store.updateCircuit(circuit.id, { breaker: Number(e.target.value) })}
                      className="w-full text-[10px] p-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
                    >
                      {[6, 10, 16, 20, 25, 32, 40, 50, 63].map(r => (
                        <option key={r} value={r}>{r}A</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-400">כבל (mm²):</label>
                    <select
                      value={circuit.cable}
                      onChange={(e) => store.updateCircuit(circuit.id, { cable: Number(e.target.value) })}
                      className="w-full text-[10px] p-0.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
                    >
                      {[1.5, 2.5, 4, 6, 10, 16, 25].map(s => (
                        <option key={s} value={s}>{s}mm²</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Circuit name edit */}
                <input
                  type="text"
                  value={circuit.name}
                  onChange={(e) => store.updateCircuit(circuit.id, { name: e.target.value })}
                  className="w-full text-[10px] p-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-right"
                />

                {/* Delete circuit */}
                <button
                  onClick={() => {
                    if (confirm(`למחוק את המעגל "${circuit.name}"?`)) {
                      store.removeCircuit(circuit.id);
                    }
                  }}
                  className="w-full text-[10px] px-2 py-1 text-red-500 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100"
                >
                  מחק מעגל
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add circuit */}
      <div className="flex gap-1 mt-2">
        <input
          type="text"
          value={newCircuitName}
          onChange={(e) => setNewCircuitName(e.target.value)}
          placeholder="שם מעגל חדש..."
          className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleAddCircuit()}
        />
        <button
          onClick={handleAddCircuit}
          disabled={!newCircuitName.trim()}
          className="px-2 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Panel summary */}
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">סיכום לוח:</h4>
        <div className="text-[10px] text-gray-400 space-y-0.5">
          <p>סה"כ מעגלים: {store.circuits.length}</p>
          <p>סה"כ הספק: {store.elements.reduce((s, e) => s + (e.wattage || 0), 0)}W</p>
          <p>זרם כולל: {(store.elements.reduce((s, e) => s + (e.wattage || 0), 0) / 230).toFixed(1)}A</p>
        </div>
      </div>
    </div>
  );
}
