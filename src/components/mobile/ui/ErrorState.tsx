import { AlertTriangle, RotateCcw } from 'lucide-react';
import { TouchPress } from './TouchPress';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message = 'Please try again.', onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <div className="w-14 h-14 rounded-2xl bg-destructive/15 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{message}</p>
      {onRetry && (
        <TouchPress
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-card border border-white/10 text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" /> Retry
        </TouchPress>
      )}
    </div>
  );
}