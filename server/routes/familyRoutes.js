import express from 'express';
import { resolveHousehold } from '../middlewares/familyScope.js';
import { getFamily, createFamily, joinFamily, leaveFamily, updateFamilyName } from '../controllers/familyController.js';

const router = express.Router();

// Legacy shim over Households — resolve context first (no viewer-write block:
// join/leave are legitimate for any role).
router.use(resolveHousehold);

router.get   ('/',       getFamily);
router.post  ('/create', createFamily);
router.post  ('/join',   joinFamily);
router.post  ('/leave',  leaveFamily);
router.put   ('/name',   updateFamilyName);

export default router;
