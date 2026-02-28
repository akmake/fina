// server/controllers/dashboardController.js
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Project from '../models/Project.js';
import FinanceProfile from '../models/FinanceProfile.js';
import { startOfMonth, subMonths } from 'date-fns';

export const getDashboardData = async (req, res, next) => {
    try {
        // המרה קריטית של מזהה המשתמש ל-ObjectId כדי ששאילתות Aggregate יעבדו
        const userObjectId = new mongoose.Types.ObjectId(req.user._id.toString());
        const today = new Date();

        const thisMonthStart = startOfMonth(today);
        const prevMonthStart = startOfMonth(subMonths(today, 1));

        const [
            financeProfile,
            monthlyAggregation,
            categoryAggregation,
            projects,
            balanceFlowRaw
        ] = await Promise.all([
            FinanceProfile.findOne({ user: req.user._id }).lean(),
            
            // חישוב הכנסות והוצאות - עכשיו משתמש ב-userObjectId
            Transaction.aggregate([
                { $match: { user: userObjectId, date: { $gte: prevMonthStart } } },
                { $group: {
                    _id: { month: { $month: "$date" }, type: "$type" },
                    total: { $sum: "$amount" }
                }}
            ]),
            
            Transaction.aggregate([
                 { $match: { user: userObjectId, type: 'הוצאה', date: { $gte: prevMonthStart } } },
                 { $group: {
                     _id: { category: "$category", month: { $month: "$date" } },
                     total: { $sum: "$amount" }
                 }}
            ]),
            
            // משיכת פרויקטים: מכסה את כל האופציות האפשריות לשם השדה במסד הנתונים שלך
            Project.find({ 
                $or: [
                    { user: req.user._id }, 
                    { userId: req.user._id }, 
                    { owner: req.user._id }
                ] 
            }).sort({ createdAt: -1 }).lean(),
            
            // חישוב נתוני הגרף (תזרים נקי יומי) 
            Transaction.aggregate([
                { $match: { user: userObjectId, date: { $gte: subMonths(today, 1) } } },
                { $sort: { date: 1 } },
                { $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    dailyChange: { $sum: { $cond: [{ $eq: ["$type", "הכנסה"] }, "$amount", { $multiply: ["$amount", -1] }] }}
                }},
                { $sort: { _id: 1 } }
            ])
        ]);

        const thisMonthNum = today.getMonth() + 1;
        const prevMonthNum = prevMonthStart.getMonth() + 1;
        
        const monthlySummary = {
            thisMonth: { income: 0, expense: 0 },
            prevMonth: { income: 0, expense: 0 }
        };

        monthlyAggregation.forEach(item => {
            const target = item._id.month === thisMonthNum ? monthlySummary.thisMonth : monthlySummary.prevMonth;
            if (item._id.type === 'הכנסה') target.income = item.total;
            if (item._id.type === 'הוצאה') target.expense = item.total;
        });

        const categorySummary = {};
        categoryAggregation.forEach(item => {
            const categoryName = item._id.category;
            if (!categorySummary[categoryName]) {
                categorySummary[categoryName] = { current: 0, previous: 0 };
            }
            if (item._id.month === thisMonthNum) {
                categorySummary[categoryName].current = item.total;
            } else {
                categorySummary[categoryName].previous = item.total;
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
            categorySummary,
            projects,
            balanceChartData
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        next(error); 
    }
};