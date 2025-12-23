import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useProjectsStore from '@/stores/projectsStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewProjectPage() {
  const navigate = useNavigate();
  const { createProject, loading } = useProjectsStore();
  const [projectType, setProjectType] = useState('goal');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!projectName.trim()) {
      setError('שם הפרויקט הוא שדה חובה.');
      return;
    }
    if (projectType === 'goal' && (!targetAmount || Number(targetAmount) <= 0)) {
      setError('סכום יעד חייב להיות מספר חיובי.');
      return;
    }

    const payload = {
      projectName,
      description,
      projectType,
      targetAmount: projectType === 'goal' ? Number(targetAmount) : 0,
    };

    try {
      const newProject = await createProject(payload);
      navigate(`/projects/${newProject._id}`);
    } catch (err) {
      setError(err.message || 'שגיאה ביצירת הפרויקט.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>יצירת פרויקט חדש</CardTitle>
          <CardDescription>בחר את סוג הפרויקט ומלא את הפרטים.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="projectType">סוג הפרויקט</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger id="projectType">
                  <SelectValue placeholder="בחר סוג..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="goal">פרויקט יעד (חיסכון)</SelectItem>
                  <SelectItem value="task">פרויקט משימות</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="projectName">שם הפרויקט</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="לדוגמה: שיפוץ המטבח, חופשה משפחתית"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">תיאור (אופציונלי)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="פרטים נוספים על הפרויקט..."
              />
            </div>

            {projectType === 'goal' && (
              <div>
                <Label htmlFor="targetAmount">סכום היעד (בש"ח)</Label>
                <Input
                  id="targetAmount"
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="לדוגמה: 10000"
                  required
                />
              </div>
            )}
            
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-4">
              <Button type="button" variant="ghost" onClick={() => navigate('/projects')}>
                ביטול
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'יוצר...' : 'צור פרויקט'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
