import Log from '../models/Log.js';

// =============================================
// GET /api/logs/admin/all — כל הלוגים (אדמין)
// =============================================
export const getAllLogs = async (req, res) => {
  try {
    const {
      limit = 100,
      skip = 0,
      startDate,
      endDate,
      userId,
      ipAddress,
      device,
      method,
      page,
      statusCode,
      browser,
      os,
    } = req.query;

    const filter = {};

    // Date range filter
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    if (userId) filter.userId = userId;
    if (ipAddress) filter.ipAddress = { $regex: ipAddress, $options: 'i' };
    if (device) filter['device.type'] = device;
    if (method) filter.method = method.toUpperCase();
    if (page) filter.page = { $regex: page, $options: 'i' };
    if (statusCode) filter.statusCode = parseInt(statusCode);
    if (browser) filter['browser.name'] = { $regex: browser, $options: 'i' };
    if (os) filter['os.name'] = { $regex: os, $options: 'i' };

    const [total, data] = await Promise.all([
      Log.countDocuments(filter),
      Log.find(filter)
        .sort({ timestamp: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .lean(),
    ]);

    res.json({
      status: 'success',
      total,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('[LogsController] getAllLogs error:', error);
    res.status(500).json({ status: 'error', message: 'שגיאה בטעינת לוגים' });
  }
};

// =============================================
// GET /api/logs/admin/summary — סיכום אנליטי
// =============================================
export const getLogsSummary = async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Basic counts
    const [last24Hours, last7Days, last30Days, totalLogs] = await Promise.all([
      Log.countDocuments({ timestamp: { $gte: last24h } }),
      Log.countDocuments({ timestamp: { $gte: last7d } }),
      Log.countDocuments({ timestamp: { $gte: last30d } }),
      Log.countDocuments({}),
    ]);

    // Unique IPs & users
    const [uniqueIPsResult, uniqueUsersResult] = await Promise.all([
      Log.distinct('ipAddress'),
      Log.distinct('userId', { userId: { $ne: null } }),
    ]);

    // Top browsers
    const topBrowsers = await Log.aggregate([
      { $group: { _id: '$browser.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { name: '$_id', count: 1, _id: 0 } },
    ]);

    // Top devices
    const topDevices = await Log.aggregate([
      { $group: { _id: '$device.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { name: '$_id', count: 1, _id: 0 } },
    ]);

    // Top OS
    const topOS = await Log.aggregate([
      { $group: { _id: '$os.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { name: '$_id', count: 1, _id: 0 } },
    ]);

    // Top pages
    const topPages = await Log.aggregate([
      { $group: { _id: '$page', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
      { $project: { name: '$_id', count: 1, _id: 0 } },
    ]);

    // Hourly distribution (last 24h)
    const hourlyDistribution = await Log.aggregate([
      { $match: { timestamp: { $gte: last24h } } },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { hour: '$_id', count: 1, _id: 0 } },
    ]);

    // Daily distribution (last 30 days)
    const dailyDistribution = await Log.aggregate([
      { $match: { timestamp: { $gte: last30d } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    // Average response time
    const avgResponseTime = await Log.aggregate([
      { $match: { timestamp: { $gte: last24h } } },
      { $group: { _id: null, avg: { $avg: '$responseTime' } } },
    ]);

    // Status code distribution
    const statusCodes = await Log.aggregate([
      { $group: { _id: '$statusCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { code: '$_id', count: 1, _id: 0 } },
    ]);

    // HTTP method distribution
    const methodDistribution = await Log.aggregate([
      { $group: { _id: '$method', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { method: '$_id', count: 1, _id: 0 } },
    ]);

    // Top referrers
    const topReferrers = await Log.aggregate([
      { $match: { referrer: { $ne: '' } } },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { referrer: '$_id', count: 1, _id: 0 } },
    ]);

    // Top languages
    const topLanguages = await Log.aggregate([
      { $match: { language: { $ne: '' } } },
      { $group: { _id: '$language', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { language: '$_id', count: 1, _id: 0 } },
    ]);

    res.json({
      status: 'success',
      summary: {
        totalLogs,
        last24Hours,
        last7Days,
        last30Days,
        uniqueIPs: uniqueIPsResult.length,
        uniqueUsers: uniqueUsersResult.length,
        avgResponseTime: Math.round(avgResponseTime[0]?.avg || 0),
      },
      analytics: {
        topBrowsers,
        topDevices,
        topOS,
        topPages,
        hourlyDistribution,
        dailyDistribution,
        statusCodes,
        methodDistribution,
        topReferrers,
        topLanguages,
      },
    });
  } catch (error) {
    console.error('[LogsController] getLogsSummary error:', error);
    res.status(500).json({ status: 'error', message: 'שגיאה בטעינת סיכום' });
  }
};

// =============================================
// GET /api/logs/my-logs — הלוגים של המשתמש
// =============================================
export const getMyLogs = async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    const userId = req.user.id || req.user._id;

    const [total, data] = await Promise.all([
      Log.countDocuments({ userId }),
      Log.find({ userId })
        .sort({ timestamp: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .lean(),
    ]);

    res.json({
      status: 'success',
      total,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('[LogsController] getMyLogs error:', error);
    res.status(500).json({ status: 'error', message: 'שגיאה בטעינת לוגים' });
  }
};

// =============================================
// DELETE /api/logs/admin/cleanup — מחיקת לוגים ישנים
// =============================================
export const deleteOldLogs = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(days));

    const result = await Log.deleteMany({ timestamp: { $lt: cutoff } });

    res.json({
      status: 'success',
      message: `נמחקו ${result.deletedCount} לוגים ישנים מלפני ${days} ימים`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('[LogsController] deleteOldLogs error:', error);
    res.status(500).json({ status: 'error', message: 'שגיאה במחיקת לוגים' });
  }
};

// =============================================
// GET /api/logs/admin/live — לוגים חיים (אחרונים)
// =============================================
export const getLiveLogs = async (req, res) => {
  try {
    const { since } = req.query;
    const filter = {};
    if (since) {
      filter.timestamp = { $gt: new Date(since) };
    }

    const data = await Log.find(filter)
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    res.json({
      status: 'success',
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('[LogsController] getLiveLogs error:', error);
    res.status(500).json({ status: 'error', message: 'שגיאה בטעינת לוגים חיים' });
  }
};
