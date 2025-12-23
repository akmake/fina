import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useProjectsStore from '@/stores/projectsStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress'; // Assuming you have a Progress component
import { PlusCircle } from 'lucide-react';

// Helper component for a single project card
const ProjectCard = ({ project }) => {
  const navigate = useNavigate();
  const { targetAmount, currentAmount, projectName, description, projectType, _id } = project;
  
  const percentage = targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0;

  return (
    <Card 
      className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => navigate(`/projects/${_id}`)}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-bold">{projectName}</CardTitle>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${projectType === 'goal' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
            {projectType === 'goal' ? 'יעד' : 'משימות'}
          </span>
        </div>
        <CardDescription className="pt-1 h-10 overflow-hidden">{description || 'אין תיאור'}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm font-medium text-gray-700">
              {currentAmount.toLocaleString()} ₪
            </span>
            <span className="text-xs text-gray-500">
              מתוך {targetAmount.toLocaleString()} ₪
            </span>
          </div>
          <Progress value={percentage} className="w-full" />
          <p className="text-center text-sm font-bold mt-2 text-gray-800">{percentage}%</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="link" className="w-full">
          צפה בפרטים ←
        </Button>
      </CardFooter>
    </Card>
  );
};

// Main page component
export default function ProjectsPage() {
  const { projects, fetchProjects, loading, error } = useProjectsStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (loading) return <div className="text-center p-8">טוען פרויקטים...</div>;
  if (error) return <div className="text-center p-8 text-red-600">שגיאה: {error.message}</div>;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">הפרויקטים שלי</h1>
        <Button asChild>
          <Link to="/projects/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            צור פרויקט חדש
          </Link>
        </Button>
      </header>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl">
          <h2 className="text-xl font-semibold text-gray-700">עדיין אין לך פרויקטים</h2>
          <p className="text-gray-500 mt-2">בוא נתחיל וניצור את הפרויקט הראשון שלך!</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map(project => (
            <ProjectCard key={project._id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
