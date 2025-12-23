import express from 'express';
import { 
    getProjects, getProject, createProject, updateProject, deleteProject, 
    addFund, addTask, toggleTask, deleteTask 
} from '../controllers/projectController.js';

const router = express.Router();

// Note: The `requireAuth` middleware is applied in `app.js` before this router is used.

// --- Base Project Routes ---
router.route('/')
  .get(getProjects)
  .post(createProject);

router.route('/:id')
  .get(getProject)
  .patch(updateProject)
  .delete(deleteProject);

// --- Routes for Goal-type Projects ---
router.post('/:id/funds', addFund);

// --- Routes for Task-type Projects ---
router.post('/:id/tasks', addTask);
router.patch('/:id/tasks/:taskId/toggle', toggleTask);
router.delete('/:id/tasks/:taskId', deleteTask);

export default router;
