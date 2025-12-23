import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useProjectsStore from '@/stores/projectsStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit } from 'lucide-react';

// --- Goal Project Components ---
const FundList = ({ funds }) => (
  <div className="space-y-3">
    {funds.map((fund, index) => (
      <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
        <div>
          <p className="font-medium">{fund.amount.toLocaleString()} ₪</p>
          <p className="text-sm text-gray-500">{fund.destination || 'הפקדה כללית'}</p>
        </div>
        <p className="text-sm text-gray-500">{new Date(fund.date).toLocaleDateString('he-IL')}</p>
      </div>
    ))}
  </div>
);

const AddFundForm = ({ projectId }) => {
  const { addFund, loading } = useProjectsStore();
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    addFund(projectId, { amount: Number(amount), destination });
    setAmount('');
    setDestination('');
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">הוספת הפקדה חדשה</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">סכום</Label>
          <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
        </div>
        <div>
          <Label htmlFor="destination">מקור/יעד (אופציונלי)</Label>
          <Input id="destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="לדוגמה: משכורת" />
        </div>
      </div>
      <Button type="submit" disabled={loading}>{loading ? 'מוסיף...' : 'הוסף'}</Button>
    </form>
  );
};


// --- Task Project Components ---
const TaskList = ({ tasks, projectId }) => {
    const { toggleTask, deleteTask } = useProjectsStore();
    return (
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task._id} className="flex items-center bg-gray-50 p-3 rounded-md">
            <Checkbox
              id={`task-${task._id}`}
              checked={task.done}
              onCheckedChange={() => toggleTask(projectId, task._id)}
              className="ml-3"
            />
            <label htmlFor={`task-${task._id}`} className={`flex-grow ${task.done ? 'line-through text-gray-500' : ''}`}>
              {task.name}
            </label>
            <span className={`font-semibold mx-4 ${task.done ? 'line-through text-gray-500' : ''}`}>{task.amount.toLocaleString()} ₪</span>
            <Button variant="ghost" size="icon" onClick={() => deleteTask(projectId, task._id)}>
                <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-600"/>
            </Button>
          </div>
        ))}
      </div>
    );
  };
  
  const AddTaskForm = ({ projectId }) => {
    const { addTask, loading } = useProjectsStore();
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
  
    const handleSubmit = (e) => {
      e.preventDefault();
      if (!name.trim() || !amount || Number(amount) < 0) return;
      addTask(projectId, { name, amount: Number(amount) });
      setName('');
      setAmount('');
    };
  
    return (
      <form onSubmit={handleSubmit} className="mt-6 p-4 border rounded-lg space-y-4">
        <h3 className="font-semibold">הוספת משימה חדשה</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="task-name">שם המשימה</Label>
            <Input id="task-name" value={name} onChange={e => setName(e.target.value)} placeholder="לדוגמה: קניית צבע" required />
          </div>
          <div>
            <Label htmlFor="task-amount">עלות משוערת (בש"ח)</Label>
            <Input id="task-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </div>
        </div>
        <Button type="submit" disabled={loading}>{loading ? 'מוסיף...' : 'הוסף משימה'}</Button>
      </form>
    );
  };

// --- Main Page Component ---
export default function ProjectPage() {
  const { id } = useParams();
  const { activeProject, fetchProject, loading, error } = useProjectsStore();

  useEffect(() => {
    fetchProject(id);
  }, [id, fetchProject]);

  if (loading && !activeProject) return <div className="text-center p-8">טוען פרטי פרויקט...</div>;
  if (error) return <div className="text-center p-8 text-red-600">שגיאה: {error.message}</div>;
  if (!activeProject) return <div className="text-center p-8">לא נמצא פרויקט. <Link to="/projects">חזור לרשימה</Link></div>;

  const { projectName, description, projectType, currentAmount, targetAmount } = activeProject;
  const percentage = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold">{projectName}</CardTitle>
              <CardDescription className="mt-2">{description}</CardDescription>
            </div>
            <Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-2"/> ערוך</Button>
          </div>
          <div className="pt-4">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-lg font-bold text-gray-800">{currentAmount.toLocaleString()} ₪</span>
              <span className="text-sm text-gray-500">מתוך {targetAmount.toLocaleString()} ₪</span>
            </div>
            <Progress value={percentage} />
            <p className="text-center text-lg font-bold mt-2 text-gray-800">{percentage}% הושלמו</p>
          </div>
        </CardHeader>
        <CardContent>
          {projectType === 'goal' && (
            <>
              <h2 className="text-xl font-semibold mb-4">הפקדות</h2>
              {activeProject.funds && activeProject.funds.length > 0 ? <FundList funds={activeProject.funds} /> : <p>עדיין לא בוצעו הפקדות.</p>}
              <AddFundForm projectId={id} />
            </>
          )}
          {projectType === 'task' && (
            <>
              <h2 className="text-xl font-semibold mb-4">משימות</h2>
              {activeProject.tasks && activeProject.tasks.length > 0 ? <TaskList tasks={activeProject.tasks} projectId={id}/> : <p>עדיין לא הוגדרו משימות.</p>}
              <AddTaskForm projectId={id} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
