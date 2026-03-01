import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  id: string;
  name: string;
  description: string | null;
  fee: number;
  grade_level: string | null;
  duration_days: number | null;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => prev.some(i => i.id === item.id) ? prev : [...prev, item]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const isInCart = useCallback((id: string) => items.some(i => i.id === id), [items]);

  const total = items.reduce((sum, i) => sum + (i.fee || 0), 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, isInCart, total, count: items.length }}>
      {children}
    </CartContext.Provider>
  );
}
