import express from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  duplicateProject,
} from '../controllers/electricalController.js';

const router = express.Router();

// כל הנתיבים כאן תחת /api/electrical ודורשים אימות
router.get('/projects',       listProjects);
router.get('/projects/:id',   getProject);
router.post('/projects',      createProject);
router.put('/projects/:id',   updateProject);
router.delete('/projects/:id', deleteProject);
router.post('/projects/:id/duplicate', duplicateProject);

export default router;
