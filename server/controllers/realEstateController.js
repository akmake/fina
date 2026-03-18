// server/controllers/realEstateController.js
import RealEstate from '../models/RealEstate.js';
import Mortgage from '../models/Mortgage.js';
import { scopeFilter } from '../utils/scopeFilter.js';

const TYPE_LABELS = {
  apartment: 'דירה',
  house: 'בית פרטי',
  penthouse: 'פנטהאוז',
  land: 'מגרש',
  commercial: 'מסחרי',
  parking: 'חניה',
  storage: 'מחסן',
  other: 'אחר',
};

// GET /api/real-estate
export const getProperties = async (req, res) => {
  try {
    const properties = await RealEstate.find(scopeFilter(req)).sort({ createdAt: -1 });

    // חיבור משכנתאות
    const mortgages = await Mortgage.find({ ...scopeFilter(req), status: 'active' });
    const propertiesWithMortgage = properties.map(p => {
      const obj = p.toObject();
      if (p.linkedMortgageId) {
        obj.mortgage = mortgages.find(m => m._id.toString() === p.linkedMortgageId.toString());
      }
      return obj;
    });

    const owned = properties.filter(p => p.status === 'owned');
    const summary = {
      totalValue: owned.reduce((s, p) => s + (p.currentEstimatedValue || 0), 0),
      totalRentIncome: owned.reduce((s, p) => s + (p.monthlyRent || 0), 0),
      totalExpenses: owned.reduce((s, p) => s + (p.totalMonthlyExpenses || 0), 0),
      totalNetIncome: owned.reduce((s, p) => s + (p.monthlyNetIncome || 0), 0),
      propertiesCount: owned.length,
      totalAppreciation: owned.reduce((s, p) => s + (p.appreciation || 0), 0),
    };

    res.json({ properties: propertiesWithMortgage, summary, typeLabels: TYPE_LABELS });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ message: 'שגיאה בטעינת נכסים' });
  }
};

// POST /api/real-estate
export const addProperty = async (req, res) => {
  try {
    const property = await RealEstate.create({ ...req.body, user: req.user._id });
    res.status(201).json(property);
  } catch (error) {
    console.error('Error adding property:', error);
    res.status(500).json({ message: 'שגיאה בהוספת נכס' });
  }
};

// PUT /api/real-estate/:id
export const updateProperty = async (req, res) => {
  try {
    const property = await RealEstate.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!property) return res.status(404).json({ message: 'נכס לא נמצא' });
    res.json(property);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ message: 'שגיאה בעדכון נכס' });
  }
};

// DELETE /api/real-estate/:id
export const deleteProperty = async (req, res) => {
  try {
    const property = await RealEstate.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!property) return res.status(404).json({ message: 'נכס לא נמצא' });
    res.json({ message: 'נכס נמחק' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ message: 'שגיאה במחיקת נכס' });
  }
};
