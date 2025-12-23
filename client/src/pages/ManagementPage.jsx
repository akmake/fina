import React, { useState, useEffect, memo } from 'react';
import api from '@/utils/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { Edit, Trash2, PlusCircle, Settings, ArrowRight, Wand2, Link2, PlayCircle, LoaderCircle, Cpu } from 'lucide-react';

const CREATE_NEW_CATEGORY_VALUE = "CREATE_NEW";

// הנחת קובץ CSS עם מחלקות מותאמות
// index.css:
/*
.btn-primary {
  @apply tw-px-4 tw-py-2 tw-bg-brand-primary tw-text-white tw-rounded-md tw-transition-all tw-duration-300 tw-hover:bg-brand-primary-dark tw-hover:scale-105 tw-focus:ring-2 tw-focus:ring-brand-primary tw-focus:ring-offset-2;
}
.btn-ghost {
  @apply tw-px-2 tw-py-1 tw-text-slate-600 tw-hover:bg-slate-100 tw-rounded-md tw-transition-all tw-duration-300;
}
.card {
  @apply tw-bg-white tw-dark:bg-gray-800 tw-shadow-md tw-rounded-lg tw-transition-all tw-duration-300 tw-hover:shadow-lg;
}
*/

const MapCard = memo(({ map, onEdit, onDelete }) => (
  <div
    className="flex items-center p-3 border-b last:border-b-0 transition-colors hover:bg-slate-50/50 dark:hover:bg-gray-700/50"
    role="listitem"
    aria-label={`מיפוי עבור ${map.originalName}`}
  >
    <div className="flex-1 min-w-0">
      <p className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate" title={map.originalName}>
        {map.originalName}
      </p>
    </div>
    <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500 mx-4" aria-hidden="true" />
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={map.newName}>
        {map.newName}
      </p>
    </div>
    <div className="flex-1 flex justify-start pl-4">
      {map.category?.name && (
        <Badge variant="secondary" className="bg-brand-secondary/20 text-brand-secondary dark:bg-brand-secondary/30">
          {map.category.name}
        </Badge>
      )}
    </div>
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(map)}
        className="btn-ghost"
        aria-label={`ערוך מיפוי ${map.originalName}`}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(map._id)}
        className="btn-ghost text-destructive"
        aria-label={`מחק מיפוי ${map.originalName}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
));

const RuleCard = memo(({ rule, onDelete }) => (
  <div
    className="flex items-center p-3 border-b last:border-b-0 transition-colors hover:bg-slate-50/50 dark:hover:bg-gray-700/50"
    role="listitem"
    aria-label={`חוק עבור ${rule.keyword}`}
  >
    <div className="flex items-center gap-3 flex-1">
      <p className="text-sm text-slate-600 dark:text-slate-400">אם שם העסק מכיל</p>
      <Badge variant="outline" className="font-mono border-brand-primary text-brand-primary">
        {rule.keyword}
      </Badge>
      <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
      <p className="text-sm text-slate-600 dark:text-slate-400">שייך לקטגורית</p>
      <Badge className="bg-brand-secondary/20 text-brand-secondary dark:bg-brand-secondary/30">
        {rule.category?.name || 'N/A'}
      </Badge>
    </div>
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onDelete(rule._id)}
      className="btn-ghost text-destructive"
      aria-label={`מחק חוק ${rule.keyword}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
));

export default function ManagementPage() {
  const [data, setData] = useState({ categories: [], merchantMaps: [], categoryRules: [] });
  const [loading, setLoading] = useState(true);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState(null);
  const [currentMap, setCurrentMap] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isApplyingRules, setIsApplyingRules] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: responseData } = await api.get('/management');
      setData(responseData);
    } catch (error) {
      toast({ title: "שגיאה", description: "טעינת הנתונים נכשלה.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validateMapForm = () => {
    const errors = {};
    if (!currentMap?.newName?.trim()) errors.newName = "שם נקי נדרש";
    if (!currentMap?.category) errors.category = "קטגוריה נדרשת";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRuleForm = () => {
    const errors = {};
    if (!currentRule?.keyword?.trim()) errors.keyword = "מילת מפתח נדרשת";
    if (!currentRule?.category) errors.category = "קטגוריה נדרשת";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditMap = (map) => {
    setCurrentMap({ ...map, category: map.category?._id || '' });
    setFormErrors({});
    setIsMapDialogOpen(true);
  };

  const handleMapUpdate = async () => {
    if (!validateMapForm()) return;
    try {
      await api.put(`/management/merchant-maps/${currentMap._id}`, {
        newName: currentMap.newName.trim(),
        category: currentMap.category,
      });
      toast({ title: "הצלחה", description: "המיפוי עודכן בהצלחה.", variant: "success" });
      fetchData();
      setIsMapDialogOpen(false);
    } catch (error) {
      toast({ title: "שגיאה", description: "עדכון המיפוי נכשל.", variant: "destructive" });
    }
  };

  const handleMapDelete = async (mapId) => {
    if (!window.confirm("האם למחוק את המיפוי?")) return;
    try {
      await api.delete(`/management/merchant-maps/${mapId}`);
      toast({ title: "הצלחה", description: "המיפוי נמחק.", variant: "success" });
      fetchData();
    } catch (error) {
      toast({ title: "שגיאה", description: "מחיקת המיפוי נכשלה.", variant: "destructive" });
    }
  };

  const handleOpenRuleDialog = (rule = null) => {
    setCurrentRule(rule ? { ...rule, category: rule.category?._id || '' } : { keyword: '', category: '' });
    setFormErrors({});
    setIsRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!validateRuleForm()) return;
    try {
      if (currentRule._id) {
        await api.put(`/management/category-rules/${currentRule._id}`, currentRule);
        toast({ title: "הצלחה", description: "החוק עודכן.", variant: "success" });
      } else {
        await api.post('/management/category-rules', currentRule);
        toast({ title: "הצלחה", description: "חוק חדש נוצר.", variant: "success" });
      }
      fetchData();
      setIsRuleDialogOpen(false);
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error.response?.data?.message || "פעולת החוק נכשלה.",
        variant: "destructive",
      });
    }
  };

  const handleRuleDelete = async (ruleId) => {
    if (!window.confirm("האם למחוק את החוק?")) return;
    try {
      await api.delete(`/management/category-rules/${ruleId}`);
      toast({ title: "הצלחה", description: "החוק נמחק.", variant: "success" });
      fetchData();
    } catch (error) {
      toast({ title: "שגיאה", description: "מחיקת החוק נכשלה.", variant: "destructive" });
    }
  };

  const handleMapCategoryChange = (value) => {
    if (value === CREATE_NEW_CATEGORY_VALUE) {
      setIsCategoryDialogOpen(true);
    } else {
      setCurrentMap((prev) => ({ ...prev, category: value }));
    }
  };

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) {
      setFormErrors({ newCategoryName: "שם קטגוריה נדרש" });
      return;
    }
    try {
      const { data: newCategory } = await api.post('/categories', { name: newCategoryName.trim() });
      toast({ title: "הצלחה", description: "קטגוריה חדשה נוצרה.", variant: "success" });
      await fetchData();
      setIsCategoryDialogOpen(false);
      setNewCategoryName('');
      setCurrentMap((prev) => ({ ...prev, category: newCategory._id }));
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err.response?.data?.message || "יצירת הקטגוריה נכשלה.",
        variant: "destructive",
      });
    }
  };

  const handleApplyRulesRetroactively = async () => {
    if (!window.confirm("פעולה זו תסרוק את כל העסקאות ותחיל עליהן את החוקים והמיפויים מחדש. האם להמשיך?")) return;
    setIsApplyingRules(true);
    toast({ title: "מתחיל תהליך...", description: "החלת החוקים על עסקאות קיימות. התהליך עשוי לקחת מספר דקות." });
    try {
      const { data: response } = await api.post('/management/apply-rules');
      toast({ title: "הצלחה!", description: `${response.updatedCount} עסקאות עודכנו.`, variant: "success" });
    } catch (error) {
      toast({ title: "שגיאה בתהליך", description: "החלת החוקים נכשלה.", variant: "destructive" });
    } finally {
      setIsApplyingRules(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center flex items-center justify-center h-screen">
        <LoaderCircle className="h-8 w-8 animate-spin text-brand-primary" aria-label="טוען נתונים" />
        <span className="mr-2 text-slate-600 dark:text-slate-400">טוען נתונים...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 dark:bg-gray-900 min-h-screen" dir="rtl">
      <header className="flex items-center gap-4">
        <div className="bg-brand-secondary/10 p-3 rounded-lg">
          <Settings className="h-8 w-8 text-brand-secondary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            מרכז האוטומציה
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            למד את המערכת כיצד למיין ולקטלג את העסקאות שלך באופן אוטומטי.
          </p>
        </div>
      </header>

      <Card className="card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Cpu className="h-5 w-5 text-brand-primary" aria-hidden="true" />
            הפעלת מנוע החוקים
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            יצרת חוקים או מיפויים חדשים? הפעל את מנוע החוקים על כל היסטוריית העסקאות.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="btn-primary w-full sm:w-auto"
            onClick={handleApplyRulesRetroactively}
            disabled={isApplyingRules}
            aria-label="החל חוקים על כל ההיסטוריה"
          >
            {isApplyingRules ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {isApplyingRules ? 'מעבד...' : 'החל חוקים על כל ההיסטוריה'}
          </Button>
        </CardContent>
      </Card>

      <Card className="card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Wand2 className="h-5 w-5 text-brand-primary" aria-hidden="true" />
              חוקים אוטומטיים
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              הגדר חוקים לשיוך אוטומטי של ספקים לקטגוריות על בסיס מילת מפתח.
            </CardDescription>
          </div>
          <Button
            className="btn-primary"
            onClick={() => handleOpenRuleDialog()}
            aria-label="צור חוק חדש"
          >
            <PlusCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            חוק חדש
          </Button>
        </CardHeader>
        <CardContent role="list" aria-label="רשימת חוקים אוטומטיים">
          {data.categoryRules.length === 0 ? (
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-4">
              אין חוקים. לחץ על 'חוק חדש' כדי להתחיל.
            </p>
          ) : (
            data.categoryRules.map((rule) => (
              <RuleCard key={rule._id} rule={rule} onDelete={handleRuleDelete} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Link2 className="h-5 w-5 text-brand-primary" aria-hidden="true" />
            מיפויי ספקים
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            תרגום שמות ספקים גולמיים לשמות נקיים וקטגוריות קבועות.
          </CardDescription>
        </CardHeader>
        <CardContent role="list" aria-label="רשימת מיפויי ספקים">
          {data.merchantMaps.length === 0 ? (
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-4">
              אין מיפויים מוגדרים.
            </p>
          ) : (
            data.merchantMaps.map((map) => (
              <MapCard key={map._id} map={map} onEdit={handleEditMap} onDelete={handleMapDelete} />
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">
              {currentRule?._id ? 'עריכת חוק' : 'יצירת חוק חדש'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Input
                placeholder="מילת מפתח (לדוגמה: 'Wolt')"
                value={currentRule?.keyword || ''}
                onChange={(e) => setCurrentRule({ ...currentRule, keyword: e.target.value })}
                aria-invalid={!!formErrors.keyword}
                aria-describedby={formErrors.keyword ? 'keyword-error' : undefined}
                className="dark:bg-gray-700 dark:text-slate-100 dark:border-gray-600"
              />
              {formErrors.keyword && (
                <p id="keyword-error" className="text-sm text-destructive mt-1">
                  {formErrors.keyword}
                </p>
              )}
            </div>
            <div>
              <Select
                value={currentRule?.category || ''}
                onValueChange={(value) => setCurrentRule({ ...currentRule, category: value })}
                aria-invalid={!!formErrors.category}
                aria-describedby={formErrors.category ? 'category-error' : undefined}
              >
                <SelectTrigger className="dark:bg-gray-700 dark:text-slate-100 dark:border-gray-600">
                  <SelectValue placeholder="בחר קטגוריה לשיוך" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:text-slate-100">
                  {data.categories.map((cat) => (
                    <SelectItem key={cat._id} value={cat._id} className="dark:hover:bg-gray-700">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.category && (
                <p id="category-error" className="text-sm text-destructive mt-1">
                  {formErrors.category}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsRuleDialogOpen(false)}
              className="btn-ghost dark:text-slate-300"
            >
              ביטול
            </Button>
            <Button onClick={handleSaveRule} className="btn-primary">
              שמור חוק
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        {currentMap && (
          <DialogContent className="dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle className="dark:text-slate-100">עריכת מיפוי</DialogTitle>
              <DialogDescription className="font-mono pt-2 text-slate-500 dark:text-slate-400">
                {currentMap.originalName}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Input
                  label="שם נקי"
                  value={currentMap.newName}
                  onChange={(e) => setCurrentMap({ ...currentMap, newName: e.target.value })}
                  aria-invalid={!!formErrors.newName}
                  aria-describedby={formErrors.newName ? 'newName-error' : undefined}
                  className="dark:bg-gray-700 dark:text-slate-100 dark:border-gray-600"
                />
                {formErrors.newName && (
                  <p id="newName-error" className="text-sm text-destructive mt-1">
                    {formErrors.newName}
                  </p>
                )}
              </div>
              <div>
                <Select
                  value={currentMap.category}
                  onValueChange={handleMapCategoryChange}
                  aria-invalid={!!formErrors.category}
                  aria-describedby={formErrors.category ? 'category-error' : undefined}
                >
                  <SelectTrigger className="dark:bg-gray-700 dark:text-slate-100 dark:border-gray-600">
                    <SelectValue placeholder="בחר קטגוריה" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:text-slate-100">
                    {data.categories.map((cat) => (
                      <SelectItem key={cat._id} value={cat._id} className="dark:hover:bg-gray-700">
                        {cat.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={CREATE_NEW_CATEGORY_VALUE} className="dark:hover:bg-gray-700">
                      --- הוסף קטגוריה חדשה ---
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.category && (
                  <p id="category-error" className="text-sm text-destructive mt-1">
                    {formErrors.category}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setIsMapDialogOpen(false)}
                className="btn-ghost dark:text-slate-300"
              >
                ביטול
              </Button>
              <Button onClick={handleMapUpdate} className="btn-primary">
                שמור שינויים
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">הוספת קטגוריה חדשה</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="שם הקטגוריה..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              aria-invalid={!!formErrors.newCategoryName}
              aria-describedby={formErrors.newCategoryName ? 'newCategoryName-error' : undefined}
              className="dark:bg-gray-700 dark:text-slate-100 dark:border-gray-600"
            />
            {formErrors.newCategoryName && (
              <p id="newCategoryName-error" className="text-sm text-destructive mt-1">
                {formErrors.newCategoryName}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsCategoryDialogOpen(false)}
              className="btn-ghost dark:text-slate-300"
            >
              ביטול
            </Button>
            <Button onClick={handleSaveNewCategory} className="btn-primary">
              שמור קטגוריה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}