import Project from '../models/Project.js';
import AppError from '../utils/AppError.js';

/**
 * Helper function to ensure a user owns the project they are trying to access.
 * Throws an error if the project is not found or the user is not the owner.
 * @param {object} project - The Mongoose project document.
 * @param {string} userId - The ID of the user making the request.
 */
const assertProjectOwner = (project, userId) => {
  if (!project) throw new AppError('Project not found', 404);
  if (String(project.owner) !== String(userId)) throw new AppError('Not authorized', 403);
};

// --- Main CRUD Operations ---

export const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) { next(err); }
};

export const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    assertProjectOwner(project, req.user.id);
    res.json(project);
  } catch (err) { next(err); }
};

export const createProject = async (req, res, next) => {
  try {
    const { projectName, description, projectType, targetAmount, dueDate, tasks = [], funds = [] } = req.body;
    if (!['goal', 'task'].includes(projectType)) throw new AppError('Invalid projectType', 400);
    
    const project = new Project({
      owner: req.user.id,
      projectName, description, projectType, targetAmount, dueDate, tasks, funds
    });
    
    await project.save();
    res.status(201).json(project);
  } catch (err) { next(err); }
};

export const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    assertProjectOwner(project, req.user.id);
    const allowed = ['projectName', 'description', 'targetAmount', 'dueDate'];
    allowed.forEach(k => { if (req.body[k] !== undefined) project[k] = req.body[k]; });
    await project.save();
    res.json(project);
  } catch (err) { next(err); }
};

export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    assertProjectOwner(project, req.user.id);
    await project.deleteOne();
    res.status(204).end();
  } catch (err) { next(err); }
};

// --- Sub-document Operations ---

export const addFund = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    assertProjectOwner(project, req.user.id);
    if (project.projectType !== 'goal') throw new AppError('Funds are only allowed for "goal" projects', 400);
    project.funds.push(req.body);
    await project.save();
    res.status(201).json(project);
  } catch (err) { next(err); }
};

export const addTask = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);
        assertProjectOwner(project, req.user.id);
        if (project.projectType !== 'task') throw new AppError('Tasks are only allowed for "task" projects', 400);
        project.tasks.push(req.body);
        await project.save();
        res.status(201).json(project);
    } catch(err) { next(err); }
};

export const toggleTask = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);
        assertProjectOwner(project, req.user.id);
        const task = project.tasks.id(req.params.taskId);
        if (!task) throw new AppError('Task not found', 404);
        task.done = !task.done;
        await project.save();
        res.json(project);
    } catch(err) { next(err); }
};

export const deleteTask = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);
        assertProjectOwner(project, req.user.id);
        const task = project.tasks.id(req.params.taskId);
        if (task) {
            task.deleteOne();
            await project.save();
        }
        res.status(204).end();
    } catch(err) { next(err); }
};
