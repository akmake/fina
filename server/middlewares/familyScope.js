import mongoose from 'mongoose';
import User from '../models/User.js';
import FamilyGroup from '../models/FamilyGroup.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

/**
 * Attaches req.scopeUsers = [ObjectId, ...] (all family members)
 * Must run AFTER requireAuth.
 */
export const familyScope = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('familyGroup').lean();
    if (user?.familyGroup) {
      const group = await FamilyGroup.findById(user.familyGroup).select('members').lean();
      req.scopeUsers = group?.members ?? [toObjectId(req.user._id)];
    } else {
      req.scopeUsers = [toObjectId(req.user._id)];
    }
  } catch {
    req.scopeUsers = [toObjectId(req.user._id)];
  }
  next();
};
