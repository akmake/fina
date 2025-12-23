// client/src/components/loans/LoanForm.jsx

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LoanForm = ({ onSave, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    principal: '100000',
    annualRate: '6',
    termInMonths: '60',
    startDate: new Date().toISOString().split('T')[0],
    repaymentType: 'שפיצר',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value) => {
    setFormData(prev => ({ ...prev, repaymentType: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submissionData = {
      ...formData,
      principal: Number(formData.principal),
      annualRate: Number(formData.annualRate),
      termInMonths: Number(formData.termInMonths),
      startDate: new Date(formData.startDate),
    };
    onSave(submissionData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow space-y-4 border">
      <h2 className="text-xl font-bold text-center">יצירת הלוואה חדשה</h2>
      
      <div>
        <Label htmlFor="name">שם ההלוואה</Label>
        <Input id="name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder="לדוגמה: הלוואה לרכב" required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="principal">סכום (₪)</Label>
          <Input id="principal" name="principal" type="number" value={formData.principal} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="annualRate">ריבית שנתית (%)</Label>
          <Input id="annualRate" name="annualRate" type="number" step="0.01" value={formData.annualRate} onChange={handleChange} required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="termInMonths">תקופה (חודשים)</Label>
          <Input id="termInMonths" name="termInMonths" type="number" value={formData.termInMonths} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="startDate">תאריך תשלום ראשון</Label>
          <Input id="startDate" name="startDate" type="date" value={formData.startDate} onChange={handleChange} required />
        </div>
      </div>
      
      <div>
        <Label>שיטת החזר</Label>
        <Select value={formData.repaymentType} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue placeholder="בחר שיטת החזר" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="שפיצר">שפיצר</SelectItem>
            <SelectItem value="קרן שווה">קרן שווה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'שומר...' : 'שמור וחשב לוח סילוקין'}
      </Button>
    </form>
  );
};

export default LoanForm;