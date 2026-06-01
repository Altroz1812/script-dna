import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'aurapen_intro_played';

export function MobileIntroVideo({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hidden, setHidden] = useState(false);

  const finish = () => {
    if (hidden) return;
    setHidden(true);
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    onDone();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => finish());
    const safety = setTimeout(finish, 15000);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (hidden) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src="/intro/intro.mp4"
        muted
        autoPlay
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        className="max-w-full max-h-full w-auto h-auto object-contain"
      />
      <button
        onClick={finish}
        className="absolute bottom-6 right-6 px-4 py-2 rounded-full bg-white/15 backdrop-blur text-white text-sm font-medium"
      >
        Skip
      </button>
    </div>
  );
}

export function shouldShowIntro(): boolean {
  try { return sessionStorage.getItem(STORAGE_KEY) !== '1'; } catch { return true; }
}