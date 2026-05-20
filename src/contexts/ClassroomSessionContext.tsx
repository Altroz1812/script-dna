import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface ClassroomSession {
  classId: string;
  roomName: string;
  displayName: string;
  isTeacher: boolean;
  classStatus?: string;
}

interface Ctx {
  session: ClassroomSession | null;
  minimized: boolean;
  joinClass: (s: ClassroomSession) => void;
  leaveClass: () => void;
  toggleMinimize: () => void;
  setMinimized: (v: boolean) => void;
}

const ClassroomSessionContext = createContext<Ctx | null>(null);

export function ClassroomSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [minimized, setMinimized] = useState(false);

  const joinClass = useCallback((s: ClassroomSession) => {
    setSession(s);
    setMinimized(false);
  }, []);

  const leaveClass = useCallback(() => {
    setSession(null);
    setMinimized(false);
  }, []);

  const toggleMinimize = useCallback(() => setMinimized((m) => !m), []);

  return (
    <ClassroomSessionContext.Provider value={{ session, minimized, joinClass, leaveClass, toggleMinimize, setMinimized }}>
      {children}
    </ClassroomSessionContext.Provider>
  );
}

export function useClassroomSession() {
  const ctx = useContext(ClassroomSessionContext);
  if (!ctx) throw new Error('useClassroomSession must be used within ClassroomSessionProvider');
  return ctx;
}