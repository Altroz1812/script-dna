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
  /** Field-level error messages keyed by form field name (e.g. { fee: 'Did not save' }) */
  fieldErrors?: Partial<Record<keyof CreateCourseParams, string>>;
}

const DEFAULT_VALUES: Partial<CreateCourseParams> = {
  name: '', description: '', grade_level: '', duration_days: 30, total_hours: 25,
  daily_hours: 1.0, language: 'English', writing_style: 'Cursive', includes_speed: false, fee: 0,
  delivery_mode: 'online', center: '',
};

export function CourseForm({ initialValues, onSubmit, isPending, submitLabel, fieldErrors }: CourseFormProps) {
  const [form, setForm] = useState<Partial<CreateCourseParams>>({ ...DEFAULT_VALUES, ...initialValues });
  const errFor = (k: keyof CreateCourseParams) => fieldErrors?.[k];
  const ErrorText = ({ k }: { k: keyof CreateCourseParams }) =>
    errFor(k) ? <p className="text-xs text-destructive mt-1">{errFor(k)}</p> : null;
  const errClass = (k: keyof CreateCourseParams) =>
    errFor(k) ? 'border-destructive focus-visible:ring-destructive' : '';

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
          <Input className={errClass('center')} value={form.center || ''} onChange={e => setForm(f => ({ ...f, center: e.target.value }))} placeholder="e.g. Kudlu Gate, HSR Layout" />
          <ErrorText k="center" />
        </div>
      )}

      <div>
        <Label>Name</Label>
        <Input className={errClass('name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={200} placeholder="e.g. English Cursive Handwriting" />
        <ErrorText k="name" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea className={errClass('description')} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={1000} placeholder="Optional description" />
        <ErrorText k="description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Language</Label>
          <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
            <SelectTrigger className={errClass('language')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Hindi">Hindi</SelectItem>
              <SelectItem value="Kannada">Kannada</SelectItem>
            </SelectContent>
          </Select>
          <ErrorText k="language" />
        </div>
        <div>
          <Label>Writing Style</Label>
          <Select value={form.writing_style} onValueChange={v => setForm(f => ({ ...f, writing_style: v }))}>
            <SelectTrigger className={errClass('writing_style')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Cursive">Cursive</SelectItem>
              <SelectItem value="Split">Split</SelectItem>
              <SelectItem value="Speedwriting">Speedwriting</SelectItem>
              <SelectItem value="Hindi">Hindi</SelectItem>
              <SelectItem value="Kannada">Kannada</SelectItem>
              <SelectItem value="Calligraphy">Calligraphy</SelectItem>
            </SelectContent>
          </Select>
          <ErrorText k="writing_style" />
        </div>
      </div>
      <div>
        <Label>Grade Level</Label>
        <Input className={errClass('grade_level')} value={form.grade_level} onChange={e => setForm(f => ({ ...f, grade_level: e.target.value }))} placeholder="e.g. UKG, 1st, 2nd" />
        <ErrorText k="grade_level" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Duration (days)</Label>
          <Input
            type="number"
            min="0"
            className={errClass('duration_days')}
            value={form.duration_days ?? 0}
            onChange={e => setForm(f => ({ ...f, duration_days: parseIntSafe(e.target.value, 0) }))}
          />
          <ErrorText k="duration_days" />
        </div>
        <div>
          <Label>Total Hours</Label>
          <Input
            type="number"
            min="0"
            className={errClass('total_hours')}
            value={form.total_hours ?? 0}
            onChange={e => setForm(f => ({ ...f, total_hours: parseIntSafe(e.target.value, 0) }))}
          />
          <ErrorText k="total_hours" />
        </div>
        <div>
          <Label>Daily Hours</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            className={errClass('daily_hours')}
            value={form.daily_hours ?? 0}
            onChange={e => setForm(f => ({ ...f, daily_hours: parseFloatSafe(e.target.value, 0) }))}
          />
          <ErrorText k="daily_hours" />
        </div>
      </div>
      <div>
        <Label>Course Fee (₹)</Label>
        <Input
          type="number"
          min="0"
          className={errClass('fee')}
          value={form.fee ?? 0}
          onChange={e => setForm(f => ({ ...f, fee: parseFloatSafe(e.target.value, 0) }))}
          placeholder="e.g. 5000"
        />
        <ErrorText k="fee" />
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
