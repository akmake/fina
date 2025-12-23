// client/src/components/dashboard/ProjectsOverview.jsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress"; // שימוש ברכיב הקיים שלך

export const ProjectsOverview = ({ projects = [] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>פרויקטים פעילים</CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length > 0 ? (
          <div className="space-y-4">
            {projects.map((project) => {
              const progress = project.targetAmount > 0 
                ? (project.currentAmount / project.targetAmount) * 100 
                : 0;

              return (
                <div key={project._id}>
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="font-medium">{project.projectName}</span>
                    <span className="text-gray-500">
                      ₪{project.currentAmount.toLocaleString()} / ₪{project.targetAmount.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">אין פרויקטים פעילים כרגע.</p>
        )}
      </CardContent>
    </Card>
  );
};