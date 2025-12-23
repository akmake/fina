// client/src/components/dashboard/CategorySpendingTable.jsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// פונקציית עזר לחישוב ועיצוב השינוי באחוזים
const calculateChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? <span className="text-blue-600">חדש</span> : <span className="text-gray-500">-</span>;
  }
  const change = ((current - previous) / previous) * 100;
  const color = change > 0 ? 'text-red-600' : 'text-green-600';
  const arrow = change > 0 ? '▲' : '▼';
  return <span className={color}>{arrow} {Math.abs(change).toFixed(1)}%</span>;
};

export const CategorySpendingTable = ({ data = {} }) => {
  const sortedCategories = Object.entries(data)
    .map(([name, values]) => ({ name, ...values }))
    .sort((a, b) => b.current - a.current);

  return (
    <Card>
      <CardHeader>
        <CardTitle>הוצאות לפי קטגוריה</CardTitle>
        <CardDescription>השוואה לחודש הקודם.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">קטגוריה</TableHead>
              <TableHead className="text-center">החודש</TableHead>
              <TableHead className="text-center">חודש קודם</TableHead>
              <TableHead className="text-center">שינוי</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCategories.length > 0 ? sortedCategories.map((cat) => (
              <TableRow key={cat.name}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-center">₪{cat.current.toLocaleString()}</TableCell>
                <TableCell className="text-center">₪{cat.previous.toLocaleString()}</TableCell>
                <TableCell className="text-center font-semibold">{calculateChange(cat.current, cat.previous)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan="4" className="text-center text-gray-500 py-8">
                  אין נתוני הוצאות להצגה.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};