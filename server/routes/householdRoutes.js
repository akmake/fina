import { Router } from 'express';
import { resolveHousehold } from '../middlewares/familyScope.js';
import { requireHouseholdRole } from '../middlewares/requireHouseholdRole.js';
import {
  getHousehold,
  renameHousehold,
  inviteMember,
  acceptInvite,
  joinByCode,
  changeMemberRole,
  removeMember,
  leaveHousehold,
  switchHousehold,
  listMyHouseholds,
} from '../controllers/householdController.js';

const router = Router();

// All household routes resolve the caller's household context first (no
// viewer-write-block here — accepting/joining/leaving are legitimate for any role).
router.use(resolveHousehold);

router.get('/', getHousehold);
router.get('/mine', listMyHouseholds);

router.put('/name', requireHouseholdRole('owner', 'partner'), renameHousehold);

router.post('/invite', requireHouseholdRole('owner'), inviteMember);
router.post('/accept', acceptInvite);
router.post('/join-code', joinByCode);
router.post('/switch', switchHousehold);
router.post('/leave', leaveHousehold);

router.put('/members/:memberId/role', requireHouseholdRole('owner'), changeMemberRole);
router.delete('/members/:memberId', requireHouseholdRole('owner'), removeMember);

export default router;
