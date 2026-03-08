import mongoose from 'mongoose';

const electricalProjectSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  projectName: {
    type: String,
    default: 'פרויקט חדש',
    trim: true,
  },
  projectScale: {
    type: Number,
    default: 50,
  },
  projectAddress: String,
  projectClient: String,
  projectEngineer: String,
  projectNotes: String,

  // Canvas state
  canvasZoom: { type: Number, default: 1 },
  canvasPanX: { type: Number, default: 0 },
  canvasPanY: { type: Number, default: 0 },
  gridSize: { type: Number, default: 20 },

  // Electrical elements placed on canvas
  elements: [{
    _id: false,
    id: String,
    symbolId: String,
    x: Number,
    y: Number,
    rotation: Number,
    scaleX: { type: Number, default: 1 },
    scaleY: { type: Number, default: 1 },
    layer: String,
    circuit: Number,
    label: String,
    note: String,
    wattage: Number,
    voltage: Number,
    cable: Number,
    locked: Boolean,
    customProps: mongoose.Schema.Types.Mixed,
  }],

  // Wires connecting elements
  wires: [{
    _id: false,
    id: String,
    points: [[Number]],
    layer: String,
    circuit: Number,
    wireType: String,
    color: String,
    strokeWidth: Number,
  }],

  // Walls / building structure
  walls: [{
    _id: false,
    id: String,
    x1: Number, y1: Number,
    x2: Number, y2: Number,
    thickness: { type: Number, default: 8 },
    layer: String,
  }],

  // Layers configuration
  layers: [{
    _id: false,
    id: String,
    name: String,
    visible: Boolean,
    locked: Boolean,
    opacity: Number,
    color: String,
  }],

  // Circuits configuration
  circuits: [{
    _id: false,
    id: Number,
    name: String,
    type: String,
    breaker: Number,
    cable: Number,
    phase: String,
    color: String,
    description: String,
  }],

  // Floor plan image (base64 or URL)
  floorPlanImage: String,
  floorPlanOpacity: { type: Number, default: 0.3 },
  floorPlanScale: { type: Number, default: 1 },
  floorPlanX: { type: Number, default: 0 },
  floorPlanY: { type: Number, default: 0 },

  // Thumbnail for project list
  thumbnail: String,

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
electricalProjectSchema.index({ user: 1, updatedAt: -1 });

// Virtual: total load
electricalProjectSchema.virtual('totalLoad').get(function () {
  return (this.elements || []).reduce((sum, el) => sum + (el.wattage || 0), 0);
});

// Virtual: element count
electricalProjectSchema.virtual('elementCount').get(function () {
  return (this.elements || []).length;
});

export default mongoose.model('ElectricalProject', electricalProjectSchema);
