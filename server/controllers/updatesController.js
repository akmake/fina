import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import BankConnection from '../models/BankConnection.js';
import ImportJob from '../models/ImportJob.js';
import Alert from '../models/Alert.js';
import { scopeFilter } from '../utils/scopeFilter.js';

/**
 * GET /api/dashboard/updates — the "what's new" feed the dashboard shows on
 * entry, so the user never has to trigger anything: what arrived since their
 * previous visit, the live state of every bank connection (incl. a CAL sync
 * waiting for its SMS code), and unread alerts.
 *
 * "Previous visit" = the visit before the current one. A visit starts when the
 * dashboard is opened after VISIT_GAP_MS of absence, so refreshing or polling
 * during a session keeps showing the same "since" window.
 */

const VISIT_GAP_MS = 30 * 60 * 1000;
const FIRST_VISIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const getUpdates = async (req, res, next) => {
  try {
    const now = new Date();
    const user = await User.findById(req.user._id).select('dashboardVisitAt dashboardPrevVisitAt role');

    // Roll the visit window only when this is a new visit.
    if (!user.dashboardVisitAt || now - user.dashboardVisitAt > VISIT_GAP_MS) {
      user.dashboardPrevVisitAt = user.dashboardVisitAt;
    }
    user.dashboardVisitAt = now;
    await user.save();

    const isFirstVisit = !user.dashboardPrevVisitAt;
    const since = user.dashboardPrevVisitAt || new Date(now.getTime() - FIRST_VISIT_WINDOW_MS);
    const scope = scopeFilter(req);

    const [connections, newTxCount, newTxItems, totals, alertCount, alertItems, pendingApprovals] = await Promise.all([
      BankConnection.find(scope)
        .select('company displayName status autoSync syncHour nextSyncAt lastSyncAt lastSyncStatus lastInserted lastError')
        .sort({ createdAt: 1 })
        .lean(),
      Transaction.countDocuments({ ...scope, createdAt: { $gt: since } }),
      Transaction.find({ ...scope, createdAt: { $gt: since } })
        .select('date description amount type category')
        .sort({ date: -1 })
        .limit(8)
        .lean(),
      Transaction.aggregate([
        { $match: { ...scope, createdAt: { $gt: since } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Alert.countDocuments({ user: req.user._id, isRead: false, isDismissed: false }),
      Alert.find({ user: req.user._id, isRead: false, isDismissed: false })
        .select('type title message severity actionUrl actionLabel createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      user.role === 'admin' ? User.countDocuments({ approvalStatus: 'pending', deletedAt: null }) : Promise.resolve(0),
    ]);

    const waiting = await ImportJob.find({
      connection: { $in: connections.map((c) => c._id) },
      status: { $in: ['queued', 'running', 'awaiting_otp'] },
      createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) },
    }).select('_id connection status otpExpiresAt maskedPhone runsOn deviceStage').sort({ createdAt: -1 }).lean();
    const jobByConn = new Map();
    for (const j of waiting) if (!jobByConn.has(String(j.connection))) jobByConn.set(String(j.connection), j);

    const byType = Object.fromEntries(totals.map((t) => [t._id, t.total]));
    const lastSyncAt = connections.reduce((max, c) => (c.lastSyncAt && (!max || c.lastSyncAt > max) ? c.lastSyncAt : max), null);

    res.json({
      since,
      isFirstVisit,
      lastSyncAt,
      connections: connections.map((c) => ({ ...c, activeJob: jobByConn.get(String(c._id)) || null })),
      newTransactions: {
        count: newTxCount,
        income: byType['הכנסה'] || 0,
        expense: byType['הוצאה'] || 0,
        items: newTxItems,
      },
      alerts: { count: alertCount, items: alertItems },
      pendingApprovals,
    });
  } catch (err) {
    next(err);
  }
};
