import ElectricalProject from '../models/ElectricalProject.js';

// ────────────────────────────
// GET ALL PROJECTS (list)
// ────────────────────────────
export const listProjects = async (req, res) => {
  try {
    const projects = await ElectricalProject.find({ user: req.user._id })
      .select('projectName projectScale elements circuits thumbnail updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .lean();

    // Add computed fields
    const result = projects.map(p => ({
      ...p,
      elementCount: p.elements?.length || 0,
      circuitCount: p.circuits?.length || 0,
      totalLoad: (p.elements || []).reduce((s, e) => s + (e.wattage || 0), 0),
      elements: undefined, // Don't send full elements array in list
    }));

    res.json({ projects: result });
  } catch (err) {
    console.error('listProjects error:', err);
    res.status(500).json({ message: 'שגיאה בטעינת רשימת פרויקטים' });
  }
};

// ────────────────────────────
// GET SINGLE PROJECT
// ────────────────────────────
export const getProject = async (req, res) => {
  try {
    const project = await ElectricalProject.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).lean();

    if (!project) {
      return res.status(404).json({ message: 'פרויקט לא נמצא' });
    }

    res.json({ project });
  } catch (err) {
    console.error('getProject error:', err);
    res.status(500).json({ message: 'שגיאה בטעינת הפרויקט' });
  }
};

// ────────────────────────────
// CREATE PROJECT
// ────────────────────────────
export const createProject = async (req, res) => {
  try {
    const {
      projectName, projectScale, projectAddress, projectClient,
      projectEngineer, projectNotes, elements, wires, walls,
      layers, circuits, floorPlanImage, floorPlanOpacity,
      floorPlanScale, floorPlanX, floorPlanY,
      canvasZoom, canvasPanX, canvasPanY, gridSize,
    } = req.body;

    const project = await ElectricalProject.create({
      user: req.user._id,
      projectName: projectName || 'פרויקט חדש',
      projectScale: projectScale || 50,
      projectAddress,
      projectClient,
      projectEngineer,
      projectNotes,
      elements: elements || [],
      wires: wires || [],
      walls: walls || [],
      layers: layers || [],
      circuits: circuits || [],
      floorPlanImage,
      floorPlanOpacity,
      floorPlanScale,
      floorPlanX,
      floorPlanY,
      canvasZoom,
      canvasPanX,
      canvasPanY,
      gridSize,
    });

    res.status(201).json({
      message: 'פרויקט נוצר בהצלחה',
      projectId: project._id,
    });
  } catch (err) {
    console.error('createProject error:', err);
    res.status(500).json({ message: 'שגיאה ביצירת הפרויקט' });
  }
};

// ────────────────────────────
// UPDATE PROJECT
// ────────────────────────────
export const updateProject = async (req, res) => {
  try {
    const {
      projectName, projectScale, projectAddress, projectClient,
      projectEngineer, projectNotes, elements, wires, walls,
      layers, circuits, floorPlanImage, floorPlanOpacity,
      floorPlanScale, floorPlanX, floorPlanY, thumbnail,
      canvasZoom, canvasPanX, canvasPanY, gridSize,
    } = req.body;

    const update = {};
    if (projectName !== undefined) update.projectName = projectName;
    if (projectScale !== undefined) update.projectScale = projectScale;
    if (projectAddress !== undefined) update.projectAddress = projectAddress;
    if (projectClient !== undefined) update.projectClient = projectClient;
    if (projectEngineer !== undefined) update.projectEngineer = projectEngineer;
    if (projectNotes !== undefined) update.projectNotes = projectNotes;
    if (elements !== undefined) update.elements = elements;
    if (wires !== undefined) update.wires = wires;
    if (walls !== undefined) update.walls = walls;
    if (layers !== undefined) update.layers = layers;
    if (circuits !== undefined) update.circuits = circuits;
    if (floorPlanImage !== undefined) update.floorPlanImage = floorPlanImage;
    if (floorPlanOpacity !== undefined) update.floorPlanOpacity = floorPlanOpacity;
    if (floorPlanScale !== undefined) update.floorPlanScale = floorPlanScale;
    if (floorPlanX !== undefined) update.floorPlanX = floorPlanX;
    if (floorPlanY !== undefined) update.floorPlanY = floorPlanY;
    if (thumbnail !== undefined) update.thumbnail = thumbnail;
    if (canvasZoom !== undefined) update.canvasZoom = canvasZoom;
    if (canvasPanX !== undefined) update.canvasPanX = canvasPanX;
    if (canvasPanY !== undefined) update.canvasPanY = canvasPanY;
    if (gridSize !== undefined) update.gridSize = gridSize;

    const project = await ElectricalProject.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: update },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: 'פרויקט לא נמצא' });
    }

    res.json({ message: 'הפרויקט עודכן בהצלחה', projectId: project._id });
  } catch (err) {
    console.error('updateProject error:', err);
    res.status(500).json({ message: 'שגיאה בעדכון הפרויקט' });
  }
};

// ────────────────────────────
// DELETE PROJECT
// ────────────────────────────
export const deleteProject = async (req, res) => {
  try {
    const result = await ElectricalProject.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!result) {
      return res.status(404).json({ message: 'פרויקט לא נמצא' });
    }

    res.json({ message: 'הפרויקט נמחק בהצלחה' });
  } catch (err) {
    console.error('deleteProject error:', err);
    res.status(500).json({ message: 'שגיאה במחיקת הפרויקט' });
  }
};

// ────────────────────────────
// DUPLICATE PROJECT
// ────────────────────────────
export const duplicateProject = async (req, res) => {
  try {
    const original = await ElectricalProject.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).lean();

    if (!original) {
      return res.status(404).json({ message: 'פרויקט מקור לא נמצא' });
    }

    delete original._id;
    delete original.__v;
    delete original.createdAt;
    delete original.updatedAt;
    original.projectName = `${original.projectName} (עותק)`;

    const project = await ElectricalProject.create({
      ...original,
      user: req.user._id,
    });

    res.status(201).json({
      message: 'פרויקט שוכפל בהצלחה',
      projectId: project._id,
    });
  } catch (err) {
    console.error('duplicateProject error:', err);
    res.status(500).json({ message: 'שגיאה בשכפול הפרויקט' });
  }
};
