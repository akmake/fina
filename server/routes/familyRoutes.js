import express from 'express';
import { getFamily, createFamily, joinFamily, leaveFamily, updateFamilyName } from '../controllers/familyController.js';

const router = express.Router();

router.get   ('/',       getFamily);
router.post  ('/create', createFamily);
router.post  ('/join',   joinFamily);
router.post  ('/leave',  leaveFamily);
router.put   ('/name',   updateFamilyName);

export default router;
