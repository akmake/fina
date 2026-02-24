import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useProjectsStore from '@/stores/projectsStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------
const ProjectCard = ({ project }) => {
  const navigate = useNavigate();
  const { targetAmount, currentAmount, projectName, description, projectType, _id } = project;
  const percentage = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

  return (
    <Card
      className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer dark:bg-slate-900 dark:border-slate-800"
      onClick={() => navigate(`/projects/${_id}`)}
    >
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg font-bold dark:text-slate-100">{projectName}</CardTitle>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            projectType === 'goal'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
          }`}>
            {projectType === 'goal' ? 'יעד' : 'משימות'}
          </span>
        </div>
        <CardDescription className="pt-1 line-clamp-2">
          {description || 'אין תיאור'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow">
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">
              {formatCurrency(currentAmount)}
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              מתוך {formatCurrency(targetAmount)}
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
          <p className="text-center text-sm font-bold text-gray-700 dark:text-slate-300">{percentage}%</p>
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="link" className="w-full text-blue-600 dark:text-blue-400">
          צפה בפרטים ←
        </Button>
      </CardFooter>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ProjectsPage() {
  const { projects, fetchProjects, loading, error } = useProjectsStore();

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100">
            הפרויקטים שלי
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">מעקב אחר יעדי חיסכון ומשימות</p>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <PlusCircle className="me-2 h-4 w-4" />
            פרויקט חדש
          </Link>
        </Button>
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">טוען פרויקטים...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-16 text-red-600 dark:text-red-400">
          <p>שגיאה: {error?.message || error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchProjects}>נסה שוב</Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-5 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
          <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Target className="h-8 w-8 text-blue-500" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-300">אין פרויקטים עדיין</h2>
            <p className="text-gray-500 dark:text-slate-400 mt-1">צור פרויקט ראשון ותתחיל לעקוב אחר היעדים שלך</p>
          </div>
          <Button asChild>
            <Link to="/projects/new">
              <PlusCircle className="me-2 h-4 w-4" />
              צור פרויקט ראשון
            </Link>
          </Button>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && projects.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
