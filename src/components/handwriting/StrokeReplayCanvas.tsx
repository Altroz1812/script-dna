import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { VoiceNarrationControls } from './VoiceNarrationControls';

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface NormalizedStroke {
  points: StrokePoint[];
  color: string;
  width: number;
}

interface StrokeReplayCanvasProps {
  normalizedBezier: NormalizedStroke[];
  className?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  onReplayComplete?: () => void;
}

export function StrokeReplayCanvas({
  normalizedBezier,
  className,
  canvasWidth = 500,
  canvasHeight = 400,
  onReplayComplete,
}: StrokeReplayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  
  const {
    isRecording,
    recordedAudio,
    error: recordingError,
    startRecording,
    stopRecording,
    clearRecording,
  } = useAudioRecorder();
  
  // Flatten all points for sequential playback
  const allPoints = useCallback(() => {
    const points: { x: number; y: number; pressure: number; strokeIndex: number; pointIndex: number; isNewStroke: boolean }[] = [];
    normalizedBezier.forEach((stroke, strokeIdx) => {
      stroke.points.forEach((point, pointIdx) => {
        points.push({
          x: point.x * canvasWidth,
          y: point.y * canvasHeight,
          pressure: point.pressure,
          strokeIndex: strokeIdx,
          pointIndex: pointIdx,
          isNewStroke: pointIdx === 0,
        });
      });
    });
    return points;
  }, [normalizedBezier, canvasWidth, canvasHeight]);

  const drawPoint = useCallback((
    ctx: CanvasRenderingContext2D,
    points: ReturnType<typeof allPoints>,
    upToIndex: number
  ) => {
    // Clear canvas
    ctx.fillStyle = 'hsl(220, 14%, 4%)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (upToIndex < 0 || points.length === 0) return;

    let currentStrokeIndex = -1;
    
    for (let i = 0; i <= upToIndex && i < points.length; i++) {
      const point = points[i];
      
      if (point.isNewStroke) {
        // Start new stroke
        if (currentStrokeIndex >= 0) {
          ctx.stroke();
        }
        currentStrokeIndex = point.strokeIndex;
        const stroke = normalizedBezier[currentStrokeIndex];
        
        ctx.beginPath();
        ctx.strokeStyle = stroke.color || '#3b82f6';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(point.x, point.y);
      } else {
        const stroke = normalizedBezier[point.strokeIndex];
        const pressureWidth = (stroke.width || 3) * (0.5 + point.pressure * 0.5);
        ctx.lineWidth = pressureWidth;
        
        if (i > 0) {
          const prevPoint = points[i - 1];
          const midX = (prevPoint.x + point.x) / 2;
          const midY = (prevPoint.y + point.y) / 2;
          ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
        }
      }
    }
    
    if (currentStrokeIndex >= 0) {
      ctx.stroke();
    }

    // Draw pen cursor at current position
    if (upToIndex >= 0 && upToIndex < points.length) {
      const currentPoint = points[upToIndex];
      ctx.beginPath();
      ctx.arc(currentPoint.x, currentPoint.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(220, 100%, 60%)';
      ctx.fill();
      ctx.strokeStyle = 'hsl(220, 100%, 80%)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [normalizedBezier, canvasWidth, canvasHeight]);

  const startReplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = allPoints();
    if (points.length === 0) return;

    setIsPlaying(true);
    setIsPaused(false);

    // Start audio playback if we have a recording
    if (recordedAudio && audioRef.current) {
      audioRef.current.currentTime = (progress / 100) * audioRef.current.duration || 0;
      audioRef.current.playbackRate = speed;
      audioRef.current.play().catch(console.error);
    }

    let currentIndex = Math.floor((progress / 100) * (points.length - 1));
    const baseInterval = 30 / speed; // ms per point

    const animate = () => {
      if (currentIndex >= points.length) {
        setIsPlaying(false);
        setProgress(100);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        onReplayComplete?.();
        return;
      }

      drawPoint(ctx, points, currentIndex);
      setProgress((currentIndex / (points.length - 1)) * 100);
      currentIndex++;

      animationRef.current = window.setTimeout(() => {
        requestAnimationFrame(animate);
      }, baseInterval);
    };

    animate();
  }, [allPoints, drawPoint, progress, speed, onReplayComplete, recordedAudio]);

  const pauseReplay = useCallback(() => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const resetReplay = useCallback(() => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'hsl(220, 14%, 4%)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }, [canvasWidth, canvasHeight]);

  const handleProgressChange = useCallback((value: number[]) => {
    const newProgress = value[0];
    setProgress(newProgress);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = allPoints();
    const index = Math.floor((newProgress / 100) * (points.length - 1));
    drawPoint(ctx, points, index);
  }, [allPoints, drawPoint]);

  useEffect(() => {
    // Initial render
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'hsl(220, 14%, 4%)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [canvasWidth, canvasHeight]);

  const totalPoints = allPoints().length;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-border/50 bg-background/50">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="w-full h-auto"
        />
        
        {/* Replay Label */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-background/60 backdrop-blur-sm rounded text-xs font-mono text-muted-foreground">
          REPLAY • {Math.round(progress)}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[progress]}
          onValueChange={handleProgressChange}
          max={100}
          step={0.1}
          className="w-full"
          disabled={isPlaying}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>{Math.floor((progress / 100) * totalPoints)} pts</span>
          <span>{totalPoints} total</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!isPlaying ? (
          <Button
            size="sm"
            onClick={startReplay}
            className="flex-1 bg-gradient-to-r from-primary to-accent"
          >
            <Play className="w-4 h-4 mr-2" />
            {isPaused ? 'Resume' : 'Play'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={pauseReplay}
            className="flex-1"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause
          </Button>
        )}
        
        <Button
          size="sm"
          variant="outline"
          onClick={resetReplay}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Speed Control */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Speed</span>
        <div className="flex gap-1">
          {[0.5, 1, 2, 3].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={speed === s ? 'default' : 'outline'}
              onClick={() => setSpeed(s)}
              className="h-7 px-2 text-xs"
              disabled={isPlaying || isRecording}
            >
              {s}x
            </Button>
          ))}
        </div>
      </div>

      {/* Voice Narration Controls */}
      <VoiceNarrationControls
        isRecording={isRecording}
        recordedAudio={recordedAudio}
        error={recordingError}
        isPlaying={isPlaying}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onClearRecording={clearRecording}
      />

      {/* Hidden audio element for playback */}
      {recordedAudio && (
        <audio
          ref={audioRef}
          src={recordedAudio.url}
          preload="auto"
          className="hidden"
        />
      )}
    </div>
  );
}
