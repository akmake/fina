// server/controllers/dashboardController.js
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Project from '../models/Project.js';
import FinanceProfile from '../models/FinanceProfile.js';
import { startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';

export const getDashboardData = async (req, res, next) => {
    try {
        const userObjectId = new mongoose.Types.ObjectId(req.user._id.toString());
        const today = new Date();

        // Find most recent transaction to determine effective month
        const mostRecentTx = await Transaction.findOne({ user: userObjectId }).sort({ date: -1 }).lean();

        let effectiveMonthStart = startOfMonth(today);
        if (mostRecentTx) {
            const currentMonthCount = await Transaction.countDocuments({
                user: userObjectId,
                date: { $gte: startOfMonth(today) }
            });
            if (currentMonthCount === 0) {
                effectiveMonthStart = startOfMonth(new Date(mostRecentTx.date));
            }
        }

        const effectivePrevMonthStart = startOfMonth(subMonths(effectiveMonthStart, 1));
        const effectiveMonthEnd = endOfMonth(effectiveMonthStart);

        // For balance chart: 30 days ending at effective month end
        const chartStart = subDays(effectiveMonthEnd, 29);

        const effectiveMonthStr = effectiveMonthStart.toISOString().slice(0, 7) + '-01';
        const prevMonthStr = effectivePrevMonthStart.toISOString().slice(0, 7) + '-01';

        const [
            financeProfile,
            monthlyAggregation,
            projects,
            balanceFlowRaw,
            recentTransactions,
            topCategories,
        ] = await Promise.all([
            FinanceProfile.findOne({ user: req.user._id }).lean(),

            // Monthly income/expense for effective month + previous
            Transaction.aggregate([
                { $match: { user: userObjectId, date: { $gte: effectivePrevMonthStart, $lte: effectiveMonthEnd } } },
                { $group: {
                    _id: {
                        monthStart: { $dateToString: { format: "%Y-%m-01", date: "$date" } },
                        type: "$type"
                    },
                    total: { $sum: "$amount" }
                }}
            ]),

            Project.find({
                $or: [
                    { user: req.user._id },
                    { userId: req.user._id },
                    { owner: req.user._id }
                ]
            }).sort({ createdAt: -1 }).lean(),

            // Balance trend for chart
            Transaction.aggregate([
                { $match: { user: userObjectId, date: { $gte: chartStart, $lte: effectiveMonthEnd } } },
                { $sort: { date: 1 } },
                { $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    dailyChange: { $sum: { $cond: [{ $eq: ["$type", "הכנסה"] }, "$amount", { $multiply: ["$amount", -1] }] }}
                }},
                { $sort: { _id: 1 } }
            ]),

            // Recent transactions (last 10)
            Transaction.find({ user: userObjectId })
                .sort({ date: -1 })
                .limit(10)
                .lean(),

            // Top 5 expense categories in effective month
            Transaction.aggregate([
                { $match: { user: userObjectId, type: 'הוצאה', date: { $gte: effectiveMonthStart, $lte: effectiveMonthEnd } } },
                { $group: { _id: "$category", total: { $sum: "$amount" } } },
                { $sort: { total: -1 } },
                { $limit: 5 }
            ]),
        ]);

        const monthlySummary = {
            thisMonth: { income: 0, expense: 0 },
            prevMonth: { income: 0, expense: 0 },
            effectiveMonth: effectiveMonthStart.toISOString(),
        };

        monthlyAggregation.forEach(item => {
            const ms = item._id.monthStart;
            if (ms === effectiveMonthStr) {
                if (item._id.type === 'הכנסה') monthlySummary.thisMonth.income = item.total;
                if (item._id.type === 'הוצאה') monthlySummary.thisMonth.expense = item.total;
            } else if (ms === prevMonthStr) {
                if (item._id.type === 'הכנסה') monthlySummary.prevMonth.income = item.total;
                if (item._id.type === 'הוצאה') monthlySummary.prevMonth.expense = item.total;
            }
        });

        let cumulativeChange = 0;
        const balanceChartData = balanceFlowRaw.map(item => {
            cumulativeChange += item.dailyChange;
            return { date: item._id, balance: cumulativeChange };
        });

        const accounts = financeProfile ? [
            { _id: '1', name: 'עובר ושב', balance: financeProfile.checking || 0 },
            { _id: '2', name: 'מזומן', balance: financeProfile.cash || 0 }
        ] : [];

        res.json({
            accounts,
            monthlySummary,
            projects,
            balanceChartData,
            recentTransactions,
            topCategories: topCategories.map(c => ({ category: c._id || 'כללי', total: c.total })),
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        next(error);
    }
};
