import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  id: string;
  name: string;
  description: string | null;
  fee: number;
  grade_level: string | null;
  duration_days: number | null;
}

export interface StudentDetail {
  name: string;
  grade: string;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  total: number;
  count: number;
  studentDetails: Record<string, StudentDetail[]>;
  setStudentDetails: (courseId: string, students: StudentDetail[]) => void;
  getStudentDetails: (courseId: string) => StudentDetail[];
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [studentDetails, setStudentDetailsState] = useState<Record<string, StudentDetail[]>>({});

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => prev.some(i => i.id === item.id) ? prev : [...prev, item]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setStudentDetailsState(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setStudentDetailsState({});
  }, []);

  const isInCart = useCallback((id: string) => items.some(i => i.id === id), [items]);

  const total = items.reduce((sum, i) => sum + (i.fee || 0), 0);

  const setStudentDetails = useCallback((courseId: string, students: StudentDetail[]) => {
    setStudentDetailsState(prev => ({ ...prev, [courseId]: students }));
  }, []);

  const getStudentDetails = useCallback((courseId: string) => {
    return studentDetails[courseId] || [];
  }, [studentDetails]);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, clearCart, isInCart, total, count: items.length,
      studentDetails, setStudentDetails, getStudentDetails,
    }}>
      {children}
    </CartContext.Provider>
  );
}
