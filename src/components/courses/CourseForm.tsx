import { useState } from 'react';
import { type Course, type CreateCourseParams } from '@/services/api/courseService';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';

interface CourseFormProps {
  initialValues?: Partial<CreateCourseParams & { delivery_mode: string; center: string }>;
  onSubmit: (values: Partial<CreateCourseParams>) => void;
  isPending: boolean;
  submitLabel: string;
}

const DEFAULT_VALUES: Partial<CreateCourseParams> = {
  name: '', description: '', grade_level: '', duration_days: 30, total_hours: 25,
  daily_hours: 1.0, language: 'English', writing_style: 'Cursive', includes_speed: false, fee: 0,
  delivery_mode: 'online', center: '',
};

export function CourseForm({ initialValues, onSubmit, isPending, submitLabel }: CourseFormProps) {
  const [form, setForm] = useState<Partial<CreateCourseParams>>({ ...DEFAULT_VALUES, ...initialValues });

  const parseIntSafe = (raw: string, fallback: number): number => {
    const trimmed = raw.trim();
    if (trimmed === '') return fallback;
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const parseFloatSafe = (raw: string, fallback: number): number => {
    const trimmed = raw.trim();
    if (trimmed === '') return fallback;
    const n = parseFloat(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const handleSubmit = () => {
    if (!form.name?.trim()) return;
    // Coerce numerics one final time so typed "0" / "30" / "2499" survive intact.
    onSubmit({
      ...form,
      duration_days: Number.isFinite(form.duration_days as number) ? (form.duration_days as number) : 0,
      total_hours: Number.isFinite(form.total_hours as number) ? (form.total_hours as number) : 0,
      daily_hours: Number.isFinite(form.daily_hours as number) ? (form.daily_hours as number) : 0,
      fee: Number.isFinite(form.fee as number) ? (form.fee as number) : 0,
    });
  };

  return (
    <div className="space-y-4">
      {/* Delivery Mode */}
      <div>
        <Label>Delivery Mode</Label>
        <RadioGroup
          value={form.delivery_mode || 'online'}
          onValueChange={v => setForm(f => ({ ...f, delivery_mode: v, center: v === 'online' ? '' : f.center }))}
          className="flex gap-4 mt-1.5"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="online" id="mode-online" />
            <Label htmlFor="mode-online" className="font-normal">Online</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="offline" id="mode-offline" />
            <Label htmlFor="mode-offline" className="font-normal">Offline</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Center (only for offline) */}
      {form.delivery_mode === 'offline' && (
        <div>
          <Label>Center / Location</Label>
          <Input value={form.center || ''} onChange={e => setForm(f => ({ ...f, center: e.target.value }))} placeholder="e.g. Kudlu Gate, HSR Layout" />
        </div>
      )}

      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={200} placeholder="e.g. English Cursive Handwriting" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={1000} placeholder="Optional description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Language</Label>
          <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Hindi">Hindi</SelectItem>
              <SelectItem value="Kannada">Kannada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Writing Style</Label>
          <Select value={form.writing_style} onValueChange={v => setForm(f => ({ ...f, writing_style: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Cursive">Cursive</SelectItem>
              <SelectItem value="Split">Split</SelectItem>
              <SelectItem value="Speedwriting">Speedwriting</SelectItem>
              <SelectItem value="Hindi">Hindi</SelectItem>
              <SelectItem value="Kannada">Kannada</SelectItem>
              <SelectItem value="Calligraphy">Calligraphy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Grade Level</Label>
        <Input value={form.grade_level} onChange={e => setForm(f => ({ ...f, grade_level: e.target.value }))} placeholder="e.g. UKG, 1st, 2nd" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Duration (days)</Label>
          <Input
            type="number"
            min="0"
            value={form.duration_days ?? 0}
            onChange={e => setForm(f => ({ ...f, duration_days: parseIntSafe(e.target.value, 0) }))}
          />
        </div>
        <div>
          <Label>Total Hours</Label>
          <Input
            type="number"
            min="0"
            value={form.total_hours ?? 0}
            onChange={e => setForm(f => ({ ...f, total_hours: parseIntSafe(e.target.value, 0) }))}
          />
        </div>
        <div>
          <Label>Daily Hours</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={form.daily_hours ?? 0}
            onChange={e => setForm(f => ({ ...f, daily_hours: parseFloatSafe(e.target.value, 0) }))}
          />
        </div>
      </div>
      <div>
        <Label>Course Fee (₹)</Label>
        <Input
          type="number"
          min="0"
          value={form.fee ?? 0}
          onChange={e => setForm(f => ({ ...f, fee: parseFloatSafe(e.target.value, 0) }))}
          placeholder="e.g. 5000"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.includes_speed} onCheckedChange={v => setForm(f => ({ ...f, includes_speed: v }))} />
        <Label>Includes Speedwriting</Label>
      </div>
      <Button onClick={handleSubmit} disabled={isPending || !form.name?.trim()} className="w-full">
        {isPending ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
}
