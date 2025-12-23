import { Router } from 'express';
// Import order controllers here
const router = Router();

// Example route
router.get('/', (req, res) => {
  res.json({ message: 'This will return all orders for the logged in user' });
});

export default router;