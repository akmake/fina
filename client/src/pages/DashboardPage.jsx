import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

// דוגמאות לאייקונים מספריית lucide-react
import { ListOrdered, UserCog } from 'lucide-react';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-10">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          שלום, {user?.name || 'אורח'}!
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          ברוך הבא לאזור האישי שלך. מה תרצה לעשות?
        </p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* כרטיס ניווט להיסטוריית הזמנות */}
        <Link 
          to="/orders-history" 
          className="group block bg-white p-8 rounded-2xl border shadow-sm hover:border-amber-500 hover:shadow-lg transition-all"
        >
          <ListOrdered className="h-10 w-10 text-amber-600 mb-4" />
          <h3 className="font-bold text-2xl text-gray-800">ההזמנות שלי</h3>
          <p className="text-gray-600 mt-2">צפייה בכל היסטוריית ההזמנות שלך ומעקב אחר סטטוס משלוחים.</p>
        </Link>
        
        {/* כרטיס ניווט לפרופיל */}
        <Link 
          to="/profile" 
          className="group block bg-white p-8 rounded-2xl border shadow-sm hover:border-amber-500 hover:shadow-lg transition-all"
        >
          <UserCog className="h-10 w-10 text-amber-600 mb-4" />
          <h3 className="font-bold text-2xl text-gray-800">הפרופיל שלי</h3>
          <p className="text-gray-600 mt-2">עדכון פרטים אישיים, שינוי סיסמה וניהול החשבון.</p>
        </Link>
      </main>
    </div>
  );
}