import { Mic, MicOff, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioRecording } from '@/hooks/useAudioRecorder';
import { cn } from '@/lib/utils';

interface VoiceNarrationControlsProps {
  isRecording: boolean;
  recordedAudio: AudioRecording | null;
  error: string | null;
  isPlaying: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClearRecording: () => void;
  disabled?: boolean;
}

export function VoiceNarrationControls({
  isRecording,
  recordedAudio,
  error,
  isPlaying,
  onStartRecording,
  onStopRecording,
  onClearRecording,
  disabled,
}: VoiceNarrationControlsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Volume2 className="w-3 h-3" />
          Voice Narration
        </span>
        
        {recordedAudio && (
          <span className="text-[10px] text-primary font-mono">
            {(recordedAudio.duration / 1000).toFixed(1)}s recorded
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isRecording ? (
          <Button
            size="sm"
            variant={recordedAudio ? "outline" : "destructive"}
            onClick={onStartRecording}
            disabled={disabled || isPlaying}
            className="flex-1"
          >
            <Mic className="w-4 h-4 mr-2" />
            {recordedAudio ? 'Re-record' : 'Record Narration'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={onStopRecording}
            className="flex-1 animate-pulse"
          >
            <MicOff className="w-4 h-4 mr-2" />
            Stop Recording
          </Button>
        )}

        {recordedAudio && !isRecording && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearRecording}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {isRecording && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          Recording... Describe the writing as it plays
        </div>
      )}

      {recordedAudio && !isRecording && (
        <p className="text-[10px] text-muted-foreground">
          Your narration will play during stroke replay
        </p>
      )}
    </div>
  );
}
