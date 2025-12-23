import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const BalanceChart = ({ data = [] }) => {
  const formattedData = data.map(item => ({
    ...item,
    // פורמט התאריך לתצוגה ידידותית
    formattedDate: new Date(item.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>יתרה מצטברת</CardTitle>
      </CardHeader>
      <CardContent className="h-80 w-full">
        <ResponsiveContainer>
          <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="formattedDate" />
            <YAxis width={80} tickFormatter={(value) => `₪${value.toLocaleString()}`} />
            <Tooltip formatter={(value) => [`₪${value.toLocaleString()}`, 'יתרה']} />
            <Area type="monotone" dataKey="balance" stroke="#3b82f6" fillOpacity={1} fill="url(#colorBalance)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};