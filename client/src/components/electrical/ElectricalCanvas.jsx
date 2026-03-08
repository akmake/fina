/**
 * ElectricalCanvas — מנוע Canvas מרכזי לשרטוט חשמל
 * Fabric.js v7 compatible
 *
 * תומך ב: גרירה, זום, סנאפ, שכבות, סמלים, חיווט, קירות, מדידה
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import useElectricalStore from '../../stores/electricalStore';
import { getSymbolById } from './symbols/electricalSymbols';
import { snapPointToGrid } from '../../utils/electricalEngine';

/* ═══════════════════════════════════════════
   Fabric helpers — symbols, wires, walls
   ═══════════════════════════════════════════ */

async function createFabricSymbol(symbolDef, x, y, elementId, opts = {}) {
  const color = opts.color || '#3B82F6';
  const svgStr = symbolDef.svg.replace(/currentColor/g, color);

  try {
    const { objects, options } = await fabric.loadSVGFromString(svgStr);
    const inner = fabric.util.groupSVGElements(objects, options);

    inner.set({
      originX: 'center',
      originY: 'center',
      scaleX: (symbolDef.width || 32) / (inner.width || 32),
      scaleY: (symbolDef.height || 32) / (inner.height || 32),
    });

    const children = [inner];

    // Optional label below symbol
    const labelText = opts.label || symbolDef.name;
    if (labelText) {
      children.push(
        new fabric.FabricText(labelText, {
          fontSize: 10,
          fontFamily: 'Arial, sans-serif',
          fill: color,
          textAlign: 'center',
          originX: 'center',
          originY: 'top',
          top: (symbolDef.height || 32) / 2 + 6,
          left: 0,
          selectable: false,
          evented: false,
        }),
      );
    }

    return new fabric.Group(children, {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      angle: opts.rotation || 0,
      selectable: !opts.locked,
      hasControls: true,
      lockScalingX: true,
      lockScalingY: true,
      subTargetCheck: false,
      // custom metadata
      elementId,
      symbolType: symbolDef.id,
      isElectricalSymbol: true,
    });
  } catch {
    // fallback rectangle
    const rect = new fabric.Rect({
      width: symbolDef.width || 32,
      height: symbolDef.height || 32,
      fill: 'transparent',
      stroke: color,
      strokeWidth: 2,
      rx: 4,
      ry: 4,
      originX: 'center',
      originY: 'center',
    });
    const txt = new fabric.FabricText((symbolDef.name || '?').substring(0, 3), {
      fontSize: 12,
      fill: color,
      fontFamily: 'Arial',
      originX: 'center',
      originY: 'center',
    });
    return new fabric.Group([rect, txt], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      elementId,
      symbolType: symbolDef.id,
      isElectricalSymbol: true,
      selectable: !opts.locked,
    });
  }
}

function createFabricWire(points, wireId, opts = {}) {
  return new fabric.Polyline(
    points.map((p) => ({ x: p.x, y: p.y })),
    {
      fill: 'transparent',
      stroke: opts.color || '#10B981',
      strokeWidth: opts.thickness || 2.5,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: true,
      hasControls: false,
      perPixelTargetFind: true,
      wireId,
      isWire: true,
    },
  );
}

function createFabricWall(x1, y1, x2, y2, wallId, thickness = 15) {
  return new fabric.Line([x1, y1, x2, y2], {
    stroke: '#374151',
    strokeWidth: thickness,
    strokeLineCap: 'round',
    selectable: true,
    hasControls: false,
    wallId,
    isWall: true,
  });
}

function buildMeasurement(x1, y1, x2, y2, mm) {
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: '#EF4444',
    strokeWidth: 1.5,
    strokeDashArray: [6, 3],
    selectable: false,
    evented: false,
  });
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const label =
    mm >= 1000 ? `${(mm / 1000).toFixed(2)} מ'` : `${Math.round(mm)} מ"מ`;
  const txt = new fabric.FabricText(label, {
    left: mx,
    top: my - 14,
    fontSize: 12,
    fontFamily: 'Arial',
    fill: '#EF4444',
    backgroundColor: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    originX: 'center',
    selectable: false,
    evented: false,
  });
  const sz = 5;
  const e1 = new fabric.Line([x1 - sz, y1 - sz, x1 + sz, y1 + sz], {
    stroke: '#EF4444',
    strokeWidth: 1.5,
    selectable: false,
    evented: false,
  });
  const e2 = new fabric.Line([x2 - sz, y2 - sz, x2 + sz, y2 + sz], {
    stroke: '#EF4444',
    strokeWidth: 1.5,
    selectable: false,
    evented: false,
  });
  return new fabric.Group([line, txt, e1, e2], {
    selectable: false,
    evented: false,
    isMeasurement: true,
  });
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function ElectricalCanvas() {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const wirePreviewRef = useRef(null); // live preview line while drawing
  const [canvasReady, setCanvasReady] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const store = useElectricalStore();

  /* ──────────────────────────────
     INIT
     ────────────────────────────── */
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const container = containerRef.current;
    const w = container?.clientWidth || 1200;
    const h = container?.clientHeight || 800;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: w,
      height: h,
      backgroundColor: '#FAFAFA',
      selection: true,
      selectionColor: 'rgba(59,130,246,0.08)',
      selectionBorderColor: '#3B82F6',
      selectionLineWidth: 1,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      stopContextMenu: true,
      fireRightClick: true,
    });

    fabricRef.current = canvas;
    setCanvasReady(true);
    drawGrid(canvas, w, h, useElectricalStore.getState().gridSize);

    // Responsive resize
    const ro = new ResizeObserver(() => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      canvas.setDimensions({ width: nw, height: nh });
      drawGrid(canvas, nw, nh, useElectricalStore.getState().gridSize);
      canvas.requestRenderAll();
    });
    if (container) ro.observe(container);

    return () => {
      ro.disconnect();
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ──────────────────────────────
     GRID
     ────────────────────────────── */
  const drawGrid = useCallback((canvas, width, height, gridSize) => {
    if (!canvas) return;
    // remove old grid lines
    canvas
      .getObjects()
      .filter((o) => o.isGrid)
      .forEach((o) => canvas.remove(o));
    if (!useElectricalStore.getState().gridVisible) return;

    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const startX = -vpt[4] / zoom;
    const startY = -vpt[5] / zoom;
    const endX = startX + width / zoom;
    const endY = startY + height / zoom;

    const gx = Math.floor(startX / gridSize) * gridSize;
    const gy = Math.floor(startY / gridSize) * gridSize;

    const lines = [];
    for (let x = gx; x <= endX; x += gridSize) {
      const major = x % (gridSize * 5) === 0;
      lines.push(
        new fabric.Line([x, startY, x, endY], {
          stroke: major ? '#D1D5DB' : '#E5E7EB',
          strokeWidth: major ? 0.8 : 0.3,
          selectable: false,
          evented: false,
          isGrid: true,
        }),
      );
    }
    for (let y = gy; y <= endY; y += gridSize) {
      const major = y % (gridSize * 5) === 0;
      lines.push(
        new fabric.Line([startX, y, endX, y], {
          stroke: major ? '#D1D5DB' : '#E5E7EB',
          strokeWidth: major ? 0.8 : 0.3,
          selectable: false,
          evented: false,
          isGrid: true,
        }),
      );
    }
    lines.forEach((l) => {
      canvas.add(l);
      canvas.sendObjectToBack(l);
    });
  }, []);

  /* ──────────────────────────────
     Helper: scene point from native event
     (Fabric v7: getScenePoint returns canvas-space coords)
     ────────────────────────────── */
  const getSceneXY = useCallback((canvas, e) => {
    const sp = canvas.getScenePoint(e);
    let x = sp.x;
    let y = sp.y;
    if (useElectricalStore.getState().snapToGrid) {
      const s = snapPointToGrid(x, y, useElectricalStore.getState().gridSize);
      x = s.x;
      y = s.y;
    }
    return { x, y };
  }, []);

  /* ──────────────────────────────
     Clear drawing preview
     ────────────────────────────── */
  const clearPreview = useCallback((canvas) => {
    if (wirePreviewRef.current) {
      canvas.remove(wirePreviewRef.current);
      wirePreviewRef.current = null;
      canvas.requestRenderAll();
    }
  }, []);

  /* ──────────────────────────────
     Place a symbol on canvas
     ────────────────────────────── */
  const placeSymbol = useCallback(async (def, x, y, elId) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const st = useElectricalStore.getState();
    const circuit = st.circuits.find((c) => c.id === st.activeCircuit);
    const color = circuit?.color || '#3B82F6';
    const obj = await createFabricSymbol(def, x, y, elId, {
      color,
      label: st.showLabels !== false ? def.name : '',
    });
    canvas.add(obj);
    canvas.requestRenderAll();
  }, []);

  /* ──────────────────────────────
     Rebuild canvas from store state (used after undo/redo/load)
     ────────────────────────────── */
  const rebuildCanvas = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // remove everything except grid
    canvas
      .getObjects()
      .filter((o) => !o.isGrid)
      .forEach((o) => canvas.remove(o));

    const st = useElectricalStore.getState();

    // Floor plan image
    if (st.floorPlanImage) {
      try {
        const img = await fabric.FabricImage.fromURL(st.floorPlanImage);
        img.set({
          left: st.floorPlanX || 0,
          top: st.floorPlanY || 0,
          scaleX: st.floorPlanScale || 1,
          scaleY: st.floorPlanScale || 1,
          opacity: st.floorPlanOpacity || 0.3,
          selectable: false,
          evented: false,
          isFloorPlan: true,
        });
        canvas.add(img);
        canvas.sendObjectToBack(img);
      } catch (err) {
        console.error('Floor plan load failed:', err);
      }
    }

    // Walls
    st.walls.forEach((w) =>
      canvas.add(createFabricWall(w.x1, w.y1, w.x2, w.y2, w.id, w.thickness)),
    );

    // Wires
    st.wires.forEach((w) => canvas.add(createFabricWire(w.points, w.id)));

    // Symbols
    for (const el of st.elements) {
      const def = getSymbolById(el.symbolId);
      if (!def) continue;
      const circuit = st.circuits.find((c) => c.id === el.circuit);
      const obj = await createFabricSymbol(def, el.x, el.y, el.id, {
        color: circuit?.color || '#3B82F6',
        rotation: el.rotation,
        label: el.label || def.name,
        locked: el.locked,
      });
      canvas.add(obj);
    }

    // Ensure grid stays behind everything
    canvas
      .getObjects()
      .filter((o) => o.isGrid)
      .forEach((o) => canvas.sendObjectToBack(o));
    canvas.requestRenderAll();
  }, []);

  /* ──────────────────────────────
     MOUSE + WHEEL  EVENTS
     ────────────────────────────── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const storeRef = useElectricalStore;

    /* ─── MOUSE MOVE ─── */
    const onMouseMove = (opt) => {
      const { x, y } = getSceneXY(canvas, opt.e);
      setCursorPos({ x: Math.round(x), y: Math.round(y) });

      // Live preview while drawing wire/wall
      const st = storeRef.getState();
      if (
        st.isDrawing &&
        (st.activeTool === 'wire' || st.activeTool === 'wall')
      ) {
        const pts = st.drawingPoints;
        if (pts.length > 0) {
          const last = pts[pts.length - 1];
          if (wirePreviewRef.current) canvas.remove(wirePreviewRef.current);
          const preview = new fabric.Line([last.x, last.y, x, y], {
            stroke: st.activeTool === 'wire' ? '#10B981' : '#374151',
            strokeWidth: st.activeTool === 'wire' ? 2.5 : 15,
            strokeDashArray: [6, 4],
            selectable: false,
            evented: false,
            opacity: 0.6,
          });
          wirePreviewRef.current = preview;
          canvas.add(preview);
          canvas.requestRenderAll();
        }
      }

      // Panning
      if (canvas._isDragging) {
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += opt.e.clientX - canvas._lastPosX;
          vpt[5] += opt.e.clientY - canvas._lastPosY;
          canvas._lastPosX = opt.e.clientX;
          canvas._lastPosY = opt.e.clientY;
          canvas.requestRenderAll();
        }
      }
    };

    /* ─── MOUSE DOWN ─── */
    const onMouseDown = (opt) => {
      const st = storeRef.getState();
      const { x, y } = getSceneXY(canvas, opt.e);

      // Right-click → cancel drawing
      if (opt.e.button === 2) {
        if (st.isDrawing) st.cancelDrawing();
        clearPreview(canvas);
        return;
      }

      // Pan (tool or middle button)
      if (st.activeTool === 'pan' || opt.e.button === 1) {
        canvas._isDragging = true;
        canvas._lastPosX = opt.e.clientX;
        canvas._lastPosY = opt.e.clientY;
        canvas.selection = false;
        return;
      }

      // Symbol placement
      if (st.activeTool === 'symbol' && st.activeSymbolType) {
        const def = getSymbolById(st.activeSymbolType);
        if (!def) return;
        const id = st.addElement({
          symbolId: st.activeSymbolType,
          x,
          y,
          wattage: def.defaultWattage,
          voltage: def.defaultVoltage,
          cable: def.cable,
        });
        placeSymbol(def, x, y, id);
        return;
      }

      // Wire drawing
      if (st.activeTool === 'wire') {
        if (!st.isDrawing) {
          st.startDrawing({ x, y });
        } else {
          st.addDrawingPoint({ x, y });
        }
        return;
      }

      // Wall drawing
      if (st.activeTool === 'wall') {
        if (!st.isDrawing) {
          st.startDrawing({ x, y });
        } else {
          const pts = st.drawingPoints;
          const last = pts[pts.length - 1];
          const wallId = st.addWall({
            x1: last.x,
            y1: last.y,
            x2: x,
            y2: y,
          });
          canvas.add(createFabricWall(last.x, last.y, x, y, wallId));
          st.addDrawingPoint({ x, y });
        }
        return;
      }

      // Measure
      if (st.activeTool === 'measure') {
        if (!st.isDrawing) {
          st.startDrawing({ x, y });
        } else {
          const start = st.drawingPoints[0];
          const dx = x - start.x;
          const dy = y - start.y;
          const px = Math.sqrt(dx * dx + dy * dy);
          const mm = px * st.projectScale;
          canvas.add(buildMeasurement(start.x, start.y, x, y, mm));
          canvas.requestRenderAll();
          st.finishDrawing();
          clearPreview(canvas);
        }
        return;
      }

      // Eraser
      if (st.activeTool === 'eraser' && opt.target) {
        const t = opt.target;
        if (t.elementId) {
          st.removeElements([t.elementId]);
          canvas.remove(t);
        } else if (t.wireId) {
          st.removeWire(t.wireId);
          canvas.remove(t);
        } else if (t.wallId) {
          st.removeWall(t.wallId);
          canvas.remove(t);
        }
        canvas.requestRenderAll();
      }
    };

    /* ─── MOUSE UP ─── */
    const onMouseUp = () => {
      canvas._isDragging = false;
      canvas.selection = storeRef.getState().activeTool === 'select';
    };

    /* ─── DOUBLE-CLICK → finish polyline drawing ─── */
    const onDblClick = () => {
      const st = storeRef.getState();
      if (!st.isDrawing) return;
      if (st.activeTool === 'wire') {
        const pts = st.drawingPoints;
        if (pts.length >= 2) {
          const wid = st.addWire({ points: [...pts] });
          canvas.add(createFabricWire(pts, wid));
        }
        st.finishDrawing();
        clearPreview(canvas);
      } else if (st.activeTool === 'wall') {
        st.finishDrawing();
        clearPreview(canvas);
      }
    };

    /* ─── SELECTION ─── */
    const onSelected = (opt) => {
      const ids = (opt.selected || [])
        .map((o) => o.elementId)
        .filter(Boolean);
      if (ids.length) storeRef.getState().selectElements(ids);
    };
    const onCleared = () => storeRef.getState().clearSelection();

    /* ─── OBJECT MOVING (snap) ─── */
    const onMoving = (opt) => {
      if (!storeRef.getState().snapToGrid || !opt.target) return;
      const o = opt.target;
      const s = snapPointToGrid(
        o.left,
        o.top,
        storeRef.getState().gridSize,
      );
      o.set({ left: s.x, top: s.y });
      if (o.elementId)
        storeRef.getState().updateElement(o.elementId, { x: s.x, y: s.y });
    };

    /* ─── OBJECT ROTATING (15° snap) ─── */
    const onRotating = (opt) => {
      if (!opt.target) return;
      const a = Math.round(opt.target.angle / 15) * 15;
      opt.target.set({ angle: a });
      if (opt.target.elementId)
        storeRef.getState().updateElement(opt.target.elementId, { rotation: a });
    };

    /* ─── WHEEL ZOOM ─── */
    const onWheel = (opt) => {
      let zoom = canvas.getZoom() * 0.999 ** opt.e.deltaY;
      zoom = Math.max(0.1, Math.min(5, zoom));
      const pt = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
      canvas.zoomToPoint(pt, zoom);
      storeRef.getState().setZoom(zoom);
      drawGrid(
        canvas,
        canvas.width,
        canvas.height,
        storeRef.getState().gridSize,
      );
      opt.e.preventDefault();
      opt.e.stopPropagation();
    };

    // Register all listeners
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('mouse:dblclick', onDblClick);
    canvas.on('mouse:wheel', onWheel);
    canvas.on('selection:created', onSelected);
    canvas.on('selection:updated', onSelected);
    canvas.on('selection:cleared', onCleared);
    canvas.on('object:moving', onMoving);
    canvas.on('object:rotating', onRotating);

    return () => {
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('mouse:dblclick', onDblClick);
      canvas.off('mouse:wheel', onWheel);
      canvas.off('selection:created', onSelected);
      canvas.off('selection:updated', onSelected);
      canvas.off('selection:cleared', onCleared);
      canvas.off('object:moving', onMoving);
      canvas.off('object:rotating', onRotating);
    };
  }, [canvasReady, getSceneXY, drawGrid, clearPreview, placeSymbol]);

  /* ──────────────────────────────
     KEYBOARD SHORTCUTS
     ────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
        return;

      const st = useElectricalStore.getState();

      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = canvas.getActiveObjects();
        const ids = sel.map((o) => o.elementId).filter(Boolean);
        const wireIds = sel.map((o) => o.wireId).filter(Boolean);
        const wallIds = sel.map((o) => o.wallId).filter(Boolean);
        if (ids.length) st.removeElements(ids);
        wireIds.forEach((id) => st.removeWire(id));
        wallIds.forEach((id) => st.removeWall(id));
        sel.forEach((o) => canvas.remove(o));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }

      // Undo (Ctrl+Z)
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        st.undo();
        rebuildCanvas();
      }
      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if (
        (e.ctrlKey && e.key === 'y') ||
        (e.ctrlKey && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        st.redo();
        rebuildCanvas();
      }

      // Select all (Ctrl+A)
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        const objs = canvas
          .getObjects()
          .filter((o) => o.isElectricalSymbol);
        if (objs.length) {
          canvas.setActiveObject(
            new fabric.ActiveSelection(objs, { canvas }),
          );
          canvas.requestRenderAll();
          st.selectAll();
        }
      }

      // Rotate 90° (R)
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey) {
        const a = canvas.getActiveObject();
        if (a?.elementId) {
          const na = (a.angle + 90) % 360;
          a.set({ angle: na });
          st.updateElement(a.elementId, { rotation: na });
          canvas.requestRenderAll();
        }
      }

      // Escape
      if (e.key === 'Escape') {
        st.setActiveTool('select');
        st.cancelDrawing();
        clearPreview(canvas);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }

      // Quick-tool shortcuts (no modifier)
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const map = {
          v: 'select',
          V: 'select',
          w: 'wire',
          W: 'wire',
          l: 'wall',
          L: 'wall',
          m: 'measure',
          M: 'measure',
          e: 'eraser',
          E: 'eraser',
        };
        if (map[e.key]) st.setActiveTool(map[e.key]);
        if (e.key === 'g' || e.key === 'G') st.toggleGrid?.();
        if (e.key === ' ') {
          e.preventDefault();
          st.setActiveTool('pan');
        }
      }
    };

    const onKeyUp = (e) => {
      if (
        e.key === ' ' &&
        useElectricalStore.getState().activeTool === 'pan'
      ) {
        useElectricalStore.getState().setActiveTool('select');
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [rebuildCanvas, clearPreview]);

  /* ──────────────────────────────
     Floor plan upload handler
     ────────────────────────────── */
  const handleFloorPlanUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target.result;
      const st = useElectricalStore.getState();
      st.setFloorPlan(url);
      const canvas = fabricRef.current;
      if (!canvas) return;
      try {
        const img = await fabric.FabricImage.fromURL(url);
        const maxW = canvas.width * 0.8;
        const maxH = canvas.height * 0.8;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        img.set({
          left: canvas.width / 2,
          top: canvas.height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          opacity: st.floorPlanOpacity || 0.3,
          selectable: false,
          evented: false,
          isFloorPlan: true,
        });
        canvas.add(img);
        canvas.sendObjectToBack(img);
        canvas
          .getObjects()
          .filter((o) => o.isGrid)
          .forEach((o) => canvas.sendObjectToBack(o));
        canvas.requestRenderAll();
        st.setFloorPlanTransform?.({
          scale,
          x: canvas.width / 2,
          y: canvas.height / 2,
        });
      } catch (err) {
        console.error('Floor plan load error:', err);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  /* ──────────────────────────────
     Derived UI state
     ────────────────────────────── */
  const cursorClass =
    {
      select: 'cursor-default',
      pan: 'cursor-grab',
      symbol: 'cursor-copy',
      wire: 'cursor-crosshair',
      wall: 'cursor-crosshair',
      measure: 'cursor-crosshair',
      eraser: 'cursor-not-allowed',
      text: 'cursor-text',
    }[store.activeTool] || 'cursor-default';

  const toolLabel =
    {
      select: 'בחירה',
      pan: 'גרירה',
      symbol: 'סמל',
      wire: 'חיווט',
      wall: 'קיר',
      measure: 'מדידה',
      eraser: 'מחיקה',
      text: 'טקסט',
    }[store.activeTool] || store.activeTool;

  /* ──────────────────────────────
     RENDER
     ────────────────────────────── */
  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-gray-50 dark:bg-gray-900 ${cursorClass}`}
    >
      <canvas ref={canvasRef} />

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 h-7 bg-gray-800/90 text-white text-[11px] flex items-center px-3 gap-3 backdrop-blur-sm z-10 select-none">
        <span className="font-mono">
          X: {cursorPos.x} &nbsp; Y: {cursorPos.y}
        </span>
        <Sep />
        <span>זום: {Math.round(store.zoom * 100)}%</span>
        <Sep />
        <span>קנה מידה: 1:{store.projectScale}</span>
        <Sep />
        <span>רשת: {store.gridSize}px</span>
        <Sep />
        <span>
          שכבה: {store.layers.find((l) => l.id === store.activeLayer)?.name || '-'}
        </span>
        <Sep />
        <span>כלי: {toolLabel}</span>
        {store.isDrawing && (
          <>
            <Sep />
            <span className="text-yellow-400 animate-pulse">
              מצייר... (לחיצה כפולה לסיום, ESC לביטול)
            </span>
          </>
        )}
        <span className="flex-1" />
        <span className="text-gray-400">
          {store.elements.length} סמלים &middot; {store.wires.length} חיווטים
        </span>
      </div>

      {/* Empty-state overlay */}
      {!store.floorPlanImage && store.elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="text-center text-gray-400 dark:text-gray-600 pointer-events-auto">
            <div className="text-6xl mb-4">📐</div>
            <p className="text-lg font-medium">
              העלה תכנית קומה או התחל לשרטט
            </p>
            <p className="text-sm mt-1 mb-4">
              גרור סמלים מהפלטה השמאלית, או העלה קובץ תמונה של תכנית
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              העלה תכנית קומה
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFloorPlanUpload}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function Sep() {
  return <span className="text-gray-500">|</span>;
}
