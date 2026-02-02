import { useEffect, useState } from "react";
import {
  Download,
  CreditCard,
  Pencil,
  Trash2,
  Check,
  X as XIcon,
  PlusCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import api from "@/utils/api";

// --- Shadcn/UI Components ---
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function TzitzitPage() {
  /* ---------- state ---------- */
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); // State for error messages

  /* ---------- fetch ---------- */
  useEffect(() => {
    api.get("/tzitzit")
      .then(({ data }) => {
        setOrders(data);
      })
      .catch(err => {
        console.error("Failed to fetch orders:", err);
        setError("שגיאה בטעינת הנתונים. נסה לרענן את הדף.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /* ---------- add-form ---------- */
  const [form, setForm] = useState({
    supplier: "",
    date: new Date().toISOString().substring(0, 10),
    type: "ציצית",
    quantity: 1,
    unitPrice: 0,
  });
  const total = form.quantity * form.unitPrice;

  const addOrder = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/tzitzit", form);
      setOrders((o) => [data, ...o]);
      setForm({ ...form, supplier: "", quantity: 1, unitPrice: 0 }); // Reset form
    } catch (err) {
        alert("שגיאה בהוספת ההזמנה.");
    }
  };

  /* ---------- supplier balances ---------- */
  const suppliers = orders.reduce((acc, o) => {
    const diff = Math.max(0, (o.totalPrice ?? 0) - (o.paidMoney ?? 0));
    if (diff) acc[o.supplier] = (acc[o.supplier] || 0) + diff;
    return acc;
  }, {});
  const outstanding = Object.values(suppliers).reduce((a, b) => a + b, 0);

  /* ---------- pay-dialog ---------- */
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgSupplier, setDlgSupplier] = useState("");
  const [dlgAmount, setDlgAmount] = useState("");

  const openDialog = () => {
    const firstSupplier = Object.keys(suppliers)[0] || "";
    setDlgSupplier(firstSupplier);
    setDlgAmount(firstSupplier ? suppliers[firstSupplier].toFixed(2) : "");
    setDlgOpen(true);
  };

  const handleDialogPay = async () => {
    try {
      await api.patch("/tzitzit/pay-supplier-partial", {
        supplier: dlgSupplier,
        amount: Number(dlgAmount) || 0,
      });
      const { data } = await api.get("/tzitzit");
      setOrders(data);
      setDlgOpen(false);
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "שגיאה מצד השרת (בדוק את ה־Console לפרטים)"
      );
    }
  };

  /* ---------- close single order ---------- */
  const payFull = async (id) => {
    const ord = orders.find((o) => o._id === id);
    if (!ord) return;
    try {
        await api.patch(`/tzitzit/${id}`, { paidMoney: ord.totalPrice });
        setOrders((o) =>
          o.map((x) => (x._id === id ? { ...x, paidMoney: x.totalPrice } : x))
        );
    } catch (err) {
        alert("שגיאה בעדכון התשלום.");
    }
  };

  /* ---------- edit / delete ---------- */
  const toggleEdit = (id) =>
    setOrders((o) =>
      o.map((r) =>
        r._id === id
          ? { ...r, _editing: !r._editing, _local: { ...r } }
          : r
      )
    );

  const handleLocalChange = (id, field, value) =>
    setOrders((o) =>
      o.map((r) =>
        r._id === id ? { ...r, _local: { ...r._local, [field]: value } } : r
      )
    );

  const saveEdit = async (id) => {
    const row = orders.find((x) => x._id === id)?._local;
    if (!row) return;
    try {
        await api.patch(`/tzitzit/${id}`, {
          supplier: row.supplier,
          date: row.date,
          type: row.type,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          paidMoney: row.paidMoney,
        });
        const { data } = await api.get("/tzitzit");
        setOrders(data);
    } catch (err) {
        alert("שגיאה בשמירת השינויים.");
    }
  };

  const deleteRow = async (id) => {
    if (!confirm("למחוק הזמנה?")) return;
    try {
        await api.delete(`/tzitzit/${id}`);
        setOrders((o) => o.filter((r) => r._id !== id));
    } catch (err) {
        alert("שגיאה במחיקת ההזמנה.");
    }
  };

  /* ---------- Excel ---------- */
  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      orders.map((o) => ({
        Date: new Date(o.date).toLocaleDateString("he-IL"),
        Supplier: o.supplier,
        Type: o.type,
        Qty: o.quantity ?? 0,
        UnitPrice: o.unitPrice ?? 0,
        Total: o.totalPrice ?? 0,
        Paid: o.paidMoney ?? 0,
        Status:
          (o.totalPrice ?? 0) - (o.paidMoney ?? 0) === 0 ? "סגור" : "פתוח",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Tzitzit");
    XLSX.writeFile(wb, "tzitzit_orders.xlsx");
  };

  /* ---------- UI ---------- */
  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">הזמנות ציצית / טלית</h1>
          <div className="flex gap-2">
            <Button
              onClick={openDialog}
              disabled={Object.keys(suppliers).length === 0}
            >
              <CreditCard className="ms-2 h-4 w-4" /> תשלום לספק
            </Button>
            {orders.length > 0 && (
              <Button variant="outline" onClick={exportExcel}>
                <Download className="ms-2 h-4 w-4" />
                ייצוא Excel
              </Button>
            )}
          </div>
        </div>

        {/* Add Form */}
        <Card>
          <CardHeader>
            <CardTitle>הוספת הזמנה חדשה</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addOrder} className="grid gap-4 md:grid-cols-6">
              <Input
                placeholder="ספק"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                required
              />
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ציצית">ציצית</SelectItem>
                  <SelectItem value="טלית">טלית</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                placeholder="כמות"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: +e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="מחיר יחידה"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: +e.target.value })}
              />
              <Button type="submit" className="md:col-start-6">
                <PlusCircle className="ms-2 h-4 w-4" />
                הוסף ({total.toFixed(2)} ₪)
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>רשימת הזמנות</CardTitle>
            <CardDescription>
              סה"כ {orders.length} הזמנות. חוב כולל פתוח: {outstanding.toFixed(2)} ₪
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>ספק</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead className="text-center">כמות</TableHead>
                  <TableHead className="text-center">מחיר יח'</TableHead>
                  <TableHead className="text-center">סה״כ</TableHead>
                  <TableHead className="text-center">שולם</TableHead>
                  <TableHead className="text-center">סטטוס</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      טוען נתונים...
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  orders.map((o) =>
                    o._editing ? (
                      <EditableRow
                        key={o._id}
                        order={o}
                        onSave={saveEdit}
                        onCancel={toggleEdit}
                        onLocalChange={handleLocalChange}
                      />
                    ) : (
                      <DisplayRow
                        key={o._id}
                        order={o}
                        onEdit={toggleEdit}
                        onDelete={deleteRow}
                        onPayFull={payFull}
                      />
                    )
                  )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>תשלום לספק</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Select value={dlgSupplier} onValueChange={(val) => {
                setDlgSupplier(val);
                setDlgAmount((suppliers[val] ?? 0).toFixed(2));
              }}>
                <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(suppliers).map((n) => (
                    <SelectItem key={n} value={n}>{n} (חוב: {suppliers[n].toFixed(2)} ₪)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="סכום לתשלום"
                value={dlgAmount}
                onChange={(e) => setDlgAmount(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDlgOpen(false)}>ביטול</Button>
              <Button onClick={handleDialogPay}>שלם</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// --- Helper Components for Table Rows ---

function DisplayRow({ order, onEdit, onDelete, onPayFull }) {
  const diff = Math.max(0, (order.totalPrice ?? 0) - (order.paidMoney ?? 0));
  const status = diff === 0 ? "סגור" : "פתוח";
  const isClosed = diff === 0;

  return (
    <TableRow>
      <TableCell>{new Date(order.date).toLocaleDateString("he-IL")}</TableCell>
      <TableCell className="font-medium">{order.supplier}</TableCell>
      <TableCell>{order.type}</TableCell>
      <TableCell className="text-center">{order.quantity ?? 0}</TableCell>
      <TableCell className="text-center">{(order.unitPrice ?? 0).toFixed(2)}</TableCell>
      <TableCell className="text-center font-semibold">{(order.totalPrice ?? 0).toFixed(2)}</TableCell>
      <TableCell className="text-center">{(order.paidMoney ?? 0).toFixed(2)}</TableCell>
      <TableCell className="text-center">
        <Badge variant={isClosed ? "default" : "secondary"}>
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end items-center gap-1">
          {!isClosed && (
            <Button variant="link" size="sm" className="h-auto p-1" onClick={() => onPayFull(order._id)}>
              סגור עסקה
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => onEdit(order._id)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>עריכה</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(order._id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>מחיקה</p></TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EditableRow({ order, onSave, onCancel, onLocalChange }) {
  const l = order._local;
  return (
    <TableRow className="bg-muted/50">
      <TableCell>
        <Input type="date" value={l.date?.substring(0, 10)} onChange={(e) => onLocalChange(order._id, "date", e.target.value)} />
      </TableCell>
      <TableCell>
        <Input value={l.supplier} onChange={(e) => onLocalChange(order._id, "supplier", e.target.value)} />
      </TableCell>
      <TableCell>
        <Select value={l.type} onValueChange={(val) => onLocalChange(order._id, "type", val)}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="ציצית">ציצית</SelectItem>
            <SelectItem value="טלית">טלית</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input type="number" value={l.quantity} onChange={(e) => onLocalChange(order._id, "quantity", +e.target.value)} className="min-w-[70px] text-center" />
      </TableCell>
      <TableCell>
        <Input type="number" value={l.unitPrice} onChange={(e) => onLocalChange(order._id, "unitPrice", +e.target.value)} className="min-w-[80px] text-center" />
      </TableCell>
      <TableCell className="text-center font-semibold">
        {(l.quantity * l.unitPrice).toFixed(2)}
      </TableCell>
      <TableCell>
        <Input type="number" value={l.paidMoney} onChange={(e) => onLocalChange(order._id, "paidMoney", +e.target.value)} className="min-w-[80px] text-center" />
      </TableCell>
      <TableCell></TableCell> {/* Placeholder for Status */}
      <TableCell className="text-right">
        <div className="flex justify-end items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => onSave(order._id)}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>שמירה</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => onCancel(order._id)}>
                <XIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>ביטול</p></TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

