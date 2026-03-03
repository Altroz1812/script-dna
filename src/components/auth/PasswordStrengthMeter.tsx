import { checkPasswordStrength } from '@/lib/security';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password: string;
}

const STRENGTH_COLORS = [
  'bg-destructive',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-green-500',
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;
  const { score, label, suggestions } = checkPasswordStrength(password);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              i <= score ? STRENGTH_COLORS[score] : 'bg-muted'
            )}
          />
        ))}
      </div>
      <div className="flex justify-between items-center">
        <span className={cn('text-xs font-medium', STRENGTH_COLORS[score].replace('bg-', 'text-'))}>
          {label}
        </span>
      </div>
      {suggestions.length > 0 && score < 3 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {suggestions.slice(0, 2).map((s) => (
            <li key={s}>• {s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
