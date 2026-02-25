// server/routes/realEstateRoutes.js
import express from 'express';
import { getProperties, addProperty, updateProperty, deleteProperty } from '../controllers/realEstateController.js';
const router = express.Router();

router.get('/', getProperties);
router.post('/', addProperty);
router.put('/:id', updateProperty);
router.delete('/:id', deleteProperty);

export default router;
