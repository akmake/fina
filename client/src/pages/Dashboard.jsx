import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus } from 'lucide-react';

// קומפוננטה פנימית להצגת פריט בודד בעגלה
const CartItem = ({ item }) => {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const { product, quantity } = item;

  return (
    <div className="flex items-center gap-4 py-4 border-b">
      <img src={product.image || 'https://via.placeholder.com/150'} alt={product.name} className="w-20 h-20 rounded-lg object-cover" />
      <div className="flex-grow">
        <p className="font-bold text-gray-800">{product.name}</p>
        <p className="text-sm text-gray-500">{product.price} ₪ ליחידה</p>
        <div className="flex items-center gap-2 mt-2">
          <Button size="icon" variant="outline" onClick={() => updateQuantity(product._id, quantity - 1)}>
            <Minus size={16} />
          </Button>
          <span className="font-bold w-8 text-center">{quantity}</span>
          <Button size="icon" variant="outline" onClick={() => updateQuantity(product._id, quantity + 1)}>
            <Plus size={16} />
          </Button>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-lg">{product.price * quantity} ₪</p>
        <Button size="icon" variant="ghost" className="text-gray-500 hover:text-red-500" onClick={() => removeItem(product._id)}>
          <Trash2 size={18} />
        </Button>
      </div>
    </div>
  );
};

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.getTotalPrice());

  if (items.length === 0) {
    return (
      <div className="container mx-auto p-10 text-center">
        <h1 className="text-3xl font-bold mb-4">העגלה שלך ריקה</h1>
        <p className="text-gray-600 mb-6">נראה שעדיין לא הוספת מוצרים לעגלה.</p>
        <Button asChild>
          <Link to="/menu">חזרה לתפריט</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">סל קניות ותשלום</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          
          {/* עמודה שמאלית: פרטי משלוח ותשלום */}
          <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">1. פרטי משלוח</h2>
              <div className="mt-6 p-10 bg-gray-100 rounded-lg text-center text-gray-500">
                טופס פרטי המשלוח יופיע כאן בשלב הבא...
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">2. פרטי תשלום</h2>
              <div className="mt-6 p-10 bg-gray-100 rounded-lg text-center text-gray-500">
                אפשרויות התשלום יופיעו כאן...
              </div>
            </div>
          </div>
          
          {/* עמודה ימנית: סיכום הזמנה */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border h-fit">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-4 mb-4">סיכום הזמנה</h2>
            <div className="space-y-4">
              {items.map(item => <CartItem key={item.product._id} item={item} />)}
            </div>
            <div className="border-t pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-lg">
                <span>סכום ביניים</span>
                <span>{totalPrice} ₪</span>
              </div>
              <div className="flex justify-between text-lg">
                <span>דמי משלוח</span>
                <span>יחושב בהמשך</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2">
                <span>סה"כ לתשלום</span>
                <span>{totalPrice} ₪</span>
              </div>
            </div>
            <Button className="w-full mt-6" size="lg">
              המשך למילוי פרטים
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}