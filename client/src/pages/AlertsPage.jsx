import { useState, useEffect, useCallback } from 'react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, RefreshCw, AlertTriangle, Info, CheckCircle, Shield, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const SEVERITY_CONFIG = {
  info:    { icon: Info,          bg: 'bg-blue-50 dark:bg-blue-950/30',   border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600' },
  warning: { icon: AlertTriangle, bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-600' },
  danger:  { icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-950/30',    border: 'border-red-200 dark:border-red-800',   text: 'text-red-600' },
  success: { icon: CheckCircle,   bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-600' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await api.get('/alerts');
      setAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
    } catch { toast.error('שגיאה בטעינת התראות'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const generateAlerts = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/alerts/generate');
      toast.success(`נוצרו ${data.generated} התראות חדשות`);
      fetchAlerts();
    } catch { toast.error('שגיאה ביצירת התראות'); }
    setGenerating(false);
  };

  const markAllRead = async () => {
    try {
      await api.post('/alerts/mark-read', {});
      fetchAlerts();
    } catch { toast.error('שגיאה'); }
  };

  const dismissAlert = async (id) => {
    try {
      await api.post(`/alerts/${id}/dismiss`);
      setAlerts(prev => prev.filter(a => a._id !== id));
    } catch { toast.error('שגיאה'); }
  };

  if (loading) return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-7 w-7 text-blue-500" /> התראות חכמות
            {unreadCount > 0 && <Badge variant="destructive" className="ms-2">{unreadCount}</Badge>}
          </h1>
          <p className="text-sm text-gray-500 mt-1">מעקב אוטומטי אחרי כל מה שחשוב בכספים שלך</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
            <Check className="h-4 w-4 me-1" /> סמן הכל כנקרא
          </Button>
          <Button onClick={generateAlerts} disabled={generating}>
            <RefreshCw className={`h-4 w-4 me-1 ${generating ? 'animate-spin' : ''}`} /> סרוק עכשיו
          </Button>
        </div>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-400 opacity-50" />
            <h3 className="text-lg font-semibold text-gray-500">הכל בסדר!</h3>
            <p className="text-sm text-gray-400 mt-2">אין התראות חדשות. לחץ "סרוק עכשיו" לבדיקה.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {alerts.map(alert => {
              const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
              const Icon = config.icon;
              return (
                <motion.div key={alert._id} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} layout>
                  <Card className={`${config.bg} ${config.border} border ${!alert.isRead ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 ${config.text}`}>
                          <span className="text-xl">{alert.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm">{alert.title}</h3>
                            {!alert.isRead && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{alert.message}</p>
                          <div className="flex items-center gap-3 mt-2">
                            {alert.actionUrl && (
                              <Link to={alert.actionUrl}>
                                <Button size="sm" variant="outline" className="text-xs h-7">
                                  {alert.actionLabel || 'צפה'} <ChevronLeft className="h-3 w-3 ms-1" />
                                </Button>
                              </Link>
                            )}
                            <span className="text-xs text-gray-400">
                              {new Date(alert.createdAt).toLocaleDateString('he-IL')}
                            </span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-500 shrink-0" onClick={() => dismissAlert(alert._id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
