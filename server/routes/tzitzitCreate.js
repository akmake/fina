import express from 'express';
import { body, param } from 'express-validator';

import requireAuth from '../middlewares/requireAuth.js';
import { publicLimiter } from '../middlewares/rateLimiter.js';
import TzitzitOrder from '../models/TzitzitOrder.js';
import { appendOrder } from '../utils/googleSheets.js';

const router = express.Router();

/* ---------- GET ---------- */
router.get('/', publicLimiter, requireAuth, async (req, res, next) => {
  try {
    const orders = await TzitzitOrder
      .find({ user: req.user._id }) // <-- תוקן
      .sort({ date: -1 });
    res.json(orders);
  } catch (err) { next(err); }
});

/* ---------- POST ---------- */
router.post(
  '/',
  publicLimiter,
  requireAuth,
  body('supplier').notEmpty(),
  body('date').isISO8601().toDate(),
  body('type').isIn(['ציצית', 'טלית']),
  body('quantity').isInt({ min: 1 }),
  body('unitPrice').isFloat({ min: 0 }),
  async (req, res, next) => {
    try {
      const order = await TzitzitOrder.create({ ...req.body, user: req.user._id }); // <-- תוקן

      await appendOrder(
        [
          new Date(order.date).toLocaleDateString('he-IL'),
          order.type,
          order.quantity,
          order.unitPrice,
          order.totalPrice,
          order.paidMoney,
        ],
        order.supplier
      );

      res.status(201).json(order);
    } catch (err) { next(err); }
  }
);

/* ---------- תשלום חלקי לספק ---------- */
router.patch(
  '/pay-supplier-partial',
  publicLimiter,
  requireAuth,
  body('supplier').notEmpty(),
  body('amount').isFloat({ min: 0.01 }),
  async (req, res, next) => {
    try {
      let remaining = Number(req.body.amount);
      const queue = await TzitzitOrder.find({
      user: req.user._id,
      supplier: req.body.supplier,
      // quantity * unitPrice  >  paidMoney
      $expr: {
        $gt: [
          { $multiply: ['$quantity', '$unitPrice'] },
         '$paidMoney',
          ],
         },
        }).sort({ date: 1 });

      for (const ord of queue) {
        const owed = ord.totalPrice - ord.paidMoney;
        if (remaining >= owed) {
          ord.paidMoney = ord.totalPrice;
          remaining   -= owed;
        } else {
          ord.paidMoney += remaining;
          remaining     = 0;
        }
        await ord.save();
        if (!remaining) break;
      }
      res.json({ remaining });
    } catch (err) { next(err); }
  }
);

/* ---------- PATCH /:id ---------- */
router.patch(
  '/:id([0-9a-fA-F]{24})',
  publicLimiter,
  requireAuth,
  param('id').isMongoId(),
  async (req, res, next) => {
    try {
      const ord = await TzitzitOrder.findOne({ _id: req.params.id, user: req.user._id }); // <-- תוקן
      if (!ord) return res.status(404).json({ message: 'לא נמצא' });

      // Update allowed fields
      const allowedUpdates = ['supplier', 'date', 'type', 'quantity', 'unitPrice', 'paidMoney'];
      allowedUpdates.forEach(key => {
        if (req.body[key] !== undefined) {
          ord[key] = req.body[key];
        }
      });
      
      await ord.save();
      res.json(ord);
    } catch (err) { next(err); }
  }
);

/* ---------- DELETE /:id ---------- */
router.delete(
  '/:id([0-9a-fA-F]{24})',
  publicLimiter,
  requireAuth,
  param('id').isMongoId(),
  async (req, res, next) => {
    try {
      const r = await TzitzitOrder.deleteOne({ _id: req.params.id, user: req.user._id }); // <-- תוקן
      if (!r.deletedCount) return res.status(404).json({ message: 'לא נמצא' });
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

export default router;