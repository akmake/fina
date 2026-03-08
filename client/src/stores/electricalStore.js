/**
 * Electrical CAD Store - Zustand
 * ניהול מצב מלא של עורך שרטוט החשמל
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const initialState = {
  // Project
  projectId: null,
  projectName: 'פרויקט חדש',
  projectScale: 50, // 1:50
  lastSaved: null,
  isDirty: false,

  // Canvas state
  zoom: 1,
  panX: 0,
  panY: 0,
  gridSize: 20,
  gridVisible: true,
  snapToGrid: true,
  snapToSymbol: true,
  snapThreshold: 10,
  showMeasurements: true,
  showLabels: true,

  // Active tool
  activeTool: 'select', // select, symbol, wire, wall, measure, text, eraser, pan
  activeSymbolType: null,
  wireRoutingMode: 'L', // L, L_reverse, U, Z, direct

  // Layers
  layers: [
    { id: 'floorplan', name: 'תכנית קומה', visible: true, locked: false, opacity: 0.4, color: '#9CA3AF' },
    { id: 'walls', name: 'קירות', visible: true, locked: false, opacity: 1, color: '#1F2937' },
    { id: 'electrical', name: 'סמלי חשמל', visible: true, locked: false, opacity: 1, color: '#3B82F6' },
    { id: 'wiring', name: 'חיווט', visible: true, locked: false, opacity: 1, color: '#10B981' },
    { id: 'annotations', name: 'הערות', visible: true, locked: false, opacity: 1, color: '#F59E0B' },
  ],
  activeLayer: 'electrical',

  // Elements on canvas
  elements: [], // All placed objects
  wires: [], // Wire connections
  walls: [], // Wall segments

  // Circuits
  circuits: [
    { id: 'circuit_1', name: 'תאורה כללית', type: 'lighting', breaker: 10, cable: 1.5, color: '#FBBF24', elements: [] },
    { id: 'circuit_2', name: 'שקעים כללי', type: 'outlets', breaker: 16, cable: 2.5, color: '#34D399', elements: [] },
    { id: 'circuit_3', name: 'מזגנים', type: 'ac', breaker: 20, cable: 4, color: '#38BDF8', elements: [] },
  ],
  activeCircuit: 'circuit_1',

  // Selection
  selectedElementIds: [],
  selectionBox: null,

  // Drawing state (for wire/wall drawing)
  drawingPoints: [],
  isDrawing: false,

  // History (undo/redo)
  history: [],
  historyIndex: -1,
  maxHistory: 50,

  // Floor plan image
  floorPlanImage: null,
  floorPlanOpacity: 0.4,
  floorPlanScale: 1,
  floorPlanX: 0,
  floorPlanY: 0,

  // UI state
  showSymbolPalette: true,
  showPropertiesPanel: true,
  showLayerPanel: true,
  showCircuitPanel: false,
  showCalculator: false,
  showAIPanel: false,
};

const useElectricalStore = create(
  devtools(
    (set, get) => ({
      ...initialState,

      // ─────────────────────────────────
      // PROJECT ACTIONS
      // ─────────────────────────────────
      setProjectName: (name) => set({ projectName: name, isDirty: true }),
      setProjectScale: (scale) => set({ projectScale: scale, isDirty: true }),
      
      loadProject: (data) => set({
        ...data,
        isDirty: false,
        history: [],
        historyIndex: -1,
      }),

      resetProject: () => set({ ...initialState }),

      markSaved: () => set({ lastSaved: new Date().toISOString(), isDirty: false }),

      // ─────────────────────────────────
      // CANVAS ACTIONS
      // ─────────────────────────────────
      setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
      setPan: (x, y) => set({ panX: x, panY: y }),
      setGridSize: (size) => set({ gridSize: size }),
      toggleGrid: () => set(s => ({ gridVisible: !s.gridVisible })),
      toggleSnap: () => set(s => ({ snapToGrid: !s.snapToGrid })),
      toggleMeasurements: () => set(s => ({ showMeasurements: !s.showMeasurements })),
      toggleLabels: () => set(s => ({ showLabels: !s.showLabels })),

      // ─────────────────────────────────
      // TOOL ACTIONS
      // ─────────────────────────────────
      setActiveTool: (tool) => set({
        activeTool: tool,
        isDrawing: false,
        drawingPoints: [],
        activeSymbolType: tool === 'symbol' ? get().activeSymbolType : null,
      }),

      setActiveSymbolType: (type) => set({
        activeSymbolType: type,
        activeTool: 'symbol',
      }),

      setWireRoutingMode: (mode) => set({ wireRoutingMode: mode }),

      // ─────────────────────────────────
      // ELEMENT ACTIONS (with undo support)
      // ─────────────────────────────────
      _pushHistory: () => {
        const state = get();
        const snapshot = {
          elements: JSON.parse(JSON.stringify(state.elements)),
          wires: JSON.parse(JSON.stringify(state.wires)),
          walls: JSON.parse(JSON.stringify(state.walls)),
        };
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(snapshot);
        if (newHistory.length > state.maxHistory) newHistory.shift();
        set({ history: newHistory, historyIndex: newHistory.length - 1 });
      },

      addElement: (element) => {
        get()._pushHistory();
        const id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newElement = {
          ...element,
          id,
          layer: get().activeLayer,
          circuit: get().activeCircuit,
          rotation: element.rotation || 0,
          label: element.label || '',
          locked: false,
        };
        set(s => ({
          elements: [...s.elements, newElement],
          isDirty: true,
        }));
        return id;
      },

      updateElement: (id, updates) => {
        get()._pushHistory();
        set(s => ({
          elements: s.elements.map(el => el.id === id ? { ...el, ...updates } : el),
          isDirty: true,
        }));
      },

      removeElements: (ids) => {
        get()._pushHistory();
        const idSet = new Set(ids);
        set(s => ({
          elements: s.elements.filter(el => !idSet.has(el.id)),
          wires: s.wires.filter(w => !idSet.has(w.startElementId) && !idSet.has(w.endElementId)),
          selectedElementIds: [],
          isDirty: true,
        }));
      },

      duplicateElements: (ids) => {
        const state = get();
        const newElements = [];
        ids.forEach(id => {
          const original = state.elements.find(el => el.id === id);
          if (original) {
            const newId = `el_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            newElements.push({
              ...original,
              id: newId,
              x: original.x + 30,
              y: original.y + 30,
            });
          }
        });
        if (newElements.length > 0) {
          get()._pushHistory();
          set(s => ({
            elements: [...s.elements, ...newElements],
            selectedElementIds: newElements.map(e => e.id),
            isDirty: true,
          }));
        }
      },

      // ─────────────────────────────────
      // WIRE ACTIONS
      // ─────────────────────────────────
      addWire: (wire) => {
        get()._pushHistory();
        const id = `wire_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        set(s => ({
          wires: [...s.wires, { ...wire, id, layer: 'wiring', circuit: s.activeCircuit }],
          isDirty: true,
        }));
        return id;
      },

      updateWire: (id, updates) => {
        set(s => ({
          wires: s.wires.map(w => w.id === id ? { ...w, ...updates } : w),
          isDirty: true,
        }));
      },

      removeWire: (id) => {
        get()._pushHistory();
        set(s => ({
          wires: s.wires.filter(w => w.id !== id),
          isDirty: true,
        }));
      },

      // ─────────────────────────────────
      // WALL ACTIONS
      // ─────────────────────────────────
      addWall: (wall) => {
        get()._pushHistory();
        const id = `wall_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        set(s => ({
          walls: [...s.walls, { ...wall, id, layer: 'walls', thickness: wall.thickness || 15 }],
          isDirty: true,
        }));
        return id;
      },

      removeWall: (id) => {
        get()._pushHistory();
        set(s => ({
          walls: s.walls.filter(w => w.id !== id),
          isDirty: true,
        }));
      },

      // ─────────────────────────────────
      // DRAWING STATE
      // ─────────────────────────────────
      startDrawing: (point) => set({ isDrawing: true, drawingPoints: [point] }),
      addDrawingPoint: (point) => set(s => ({ drawingPoints: [...s.drawingPoints, point] })),
      finishDrawing: () => set({ isDrawing: false, drawingPoints: [] }),
      cancelDrawing: () => set({ isDrawing: false, drawingPoints: [] }),

      // ─────────────────────────────────
      // SELECTION
      // ─────────────────────────────────
      selectElement: (id) => set({ selectedElementIds: [id] }),
      selectElements: (ids) => set({ selectedElementIds: ids }),
      addToSelection: (id) => set(s => ({
        selectedElementIds: s.selectedElementIds.includes(id) ? s.selectedElementIds : [...s.selectedElementIds, id],
      })),
      clearSelection: () => set({ selectedElementIds: [] }),
      selectAll: () => set(s => ({
        selectedElementIds: s.elements.filter(el => !el.locked).map(el => el.id),
      })),

      // ─────────────────────────────────
      // LAYERS
      // ─────────────────────────────────
      setActiveLayer: (layerId) => set({ activeLayer: layerId }),
      
      toggleLayerVisibility: (layerId) => set(s => ({
        layers: s.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l),
      })),

      toggleLayerLock: (layerId) => set(s => ({
        layers: s.layers.map(l => l.id === layerId ? { ...l, locked: !l.locked } : l),
      })),

      setLayerOpacity: (layerId, opacity) => set(s => ({
        layers: s.layers.map(l => l.id === layerId ? { ...l, opacity } : l),
      })),

      addLayer: (layer) => set(s => ({
        layers: [...s.layers, { ...layer, id: `layer_${Date.now()}` }],
      })),

      removeLayer: (layerId) => set(s => ({
        layers: s.layers.filter(l => l.id !== layerId),
        elements: s.elements.filter(el => el.layer !== layerId),
      })),

      // ─────────────────────────────────
      // CIRCUITS
      // ─────────────────────────────────
      setActiveCircuit: (id) => set({ activeCircuit: id }),

      addCircuit: (circuit) => {
        const id = `circuit_${Date.now()}`;
        set(s => ({
          circuits: [...s.circuits, { ...circuit, id, elements: [] }],
          isDirty: true,
        }));
        return id;
      },

      updateCircuit: (id, updates) => set(s => ({
        circuits: s.circuits.map(c => c.id === id ? { ...c, ...updates } : c),
        isDirty: true,
      })),

      removeCircuit: (id) => set(s => ({
        circuits: s.circuits.filter(c => c.id !== id),
        elements: s.elements.map(el => el.circuit === id ? { ...el, circuit: null } : el),
        isDirty: true,
      })),

      assignToCircuit: (elementIds, circuitId) => set(s => ({
        elements: s.elements.map(el =>
          elementIds.includes(el.id) ? { ...el, circuit: circuitId } : el
        ),
        isDirty: true,
      })),

      // ─────────────────────────────────
      // FLOOR PLAN
      // ─────────────────────────────────
      setFloorPlan: (imageData) => set({
        floorPlanImage: imageData,
        isDirty: true,
      }),

      setFloorPlanTransform: (transform) => set(s => ({
        floorPlanOpacity: transform.opacity ?? s.floorPlanOpacity,
        floorPlanScale: transform.scale ?? s.floorPlanScale,
        floorPlanX: transform.x ?? s.floorPlanX,
        floorPlanY: transform.y ?? s.floorPlanY,
      })),

      removeFloorPlan: () => set({
        floorPlanImage: null,
        isDirty: true,
      }),

      // ─────────────────────────────────
      // UNDO / REDO
      // ─────────────────────────────────
      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < 0) return;
        
        if (historyIndex === history.length - 1) {
          // Save current state before undoing
          const currentSnapshot = {
            elements: JSON.parse(JSON.stringify(get().elements)),
            wires: JSON.parse(JSON.stringify(get().wires)),
            walls: JSON.parse(JSON.stringify(get().walls)),
          };
          const newHistory = [...history, currentSnapshot];
          const snapshot = history[historyIndex];
          set({
            elements: snapshot.elements,
            wires: snapshot.wires,
            walls: snapshot.walls,
            history: newHistory,
            historyIndex: historyIndex - 1,
          });
        } else {
          const snapshot = history[historyIndex];
          set({
            elements: snapshot.elements,
            wires: snapshot.wires,
            walls: snapshot.walls,
            historyIndex: historyIndex - 1,
          });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const snapshot = history[historyIndex + 1];
        set({
          elements: snapshot.elements,
          wires: snapshot.wires,
          walls: snapshot.walls,
          historyIndex: historyIndex + 1,
        });
      },

      // ─────────────────────────────────
      // UI PANELS
      // ─────────────────────────────────
      toggleSymbolPalette: () => set(s => ({ showSymbolPalette: !s.showSymbolPalette })),
      togglePropertiesPanel: () => set(s => ({ showPropertiesPanel: !s.showPropertiesPanel })),
      toggleLayerPanel: () => set(s => ({ showLayerPanel: !s.showLayerPanel })),
      toggleCircuitPanel: () => set(s => ({ showCircuitPanel: !s.showCircuitPanel })),
      toggleCalculator: () => set(s => ({ showCalculator: !s.showCalculator })),
      toggleAIPanel: () => set(s => ({ showAIPanel: !s.showAIPanel })),

      // ─────────────────────────────────
      // SERIALIZATION
      // ─────────────────────────────────
      getProjectData: () => {
        const s = get();
        return {
          projectName: s.projectName,
          projectScale: s.projectScale,
          elements: s.elements,
          wires: s.wires,
          walls: s.walls,
          circuits: s.circuits,
          layers: s.layers,
          floorPlanImage: s.floorPlanImage,
          floorPlanOpacity: s.floorPlanOpacity,
          floorPlanScale: s.floorPlanScale,
          floorPlanX: s.floorPlanX,
          floorPlanY: s.floorPlanY,
        };
      },
    }),
    { name: 'electrical-cad' }
  )
);

export default useElectricalStore;
