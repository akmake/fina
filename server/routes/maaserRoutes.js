import express from 'express';
import {
  getSettings,
  updateSettings,
  getSummary,
  getDonations,
  addDonation,
  deleteDonation,
  getIncomeCategories,
} from '../controllers/maaserController.js';

const router = express.Router();

router.get   ('/settings',          getSettings);
router.get   ('/income-categories', getIncomeCategories);
router.put   ('/settings',      updateSettings);
router.get   ('/summary',       getSummary);
router.get   ('/donations',     getDonations);
router.post  ('/donations',     addDonation);
router.delete('/donations/:id', deleteDonation);

export default router;
