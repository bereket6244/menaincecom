import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, User } from '../lib/types';
import { apiGet, apiSend, onDbStatus, setToken } from '../lib/api';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  online: boolean;
  dbDown: boolean;
  user: User | null;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (name: string, identifier: string, password: string) => Promise<void>;
  logout: () => void;
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'key'>) => void;
  updateCartItem: (key: string, patch: Partial<CartItem>) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  toasts: Toast[];
  toast: (kind: Toast['kind'], message: string) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppState | null>(null);

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem('mena_cart') || '[]');
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [dbDown, setDbDown] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    onDbStatus(setDbDown);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Restore session on load.
  useEffect(() => {
    if (!localStorage.getItem('mena_token')) return;
    apiGet<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setToken(null));
  }, []);

  useEffect(() => {
    localStorage.setItem('mena_cart', JSON.stringify(cart));
  }, [cart]);

  const toast = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const r = await apiSend<{ token: string; user: User }>('POST', '/auth/login', { identifier, password });
    setToken(r.token);
    setUser(r.user);
  }, []);

  const signup = useCallback(async (name: string, identifier: string, password: string) => {
    const r = await apiSend<{ token: string; user: User }>('POST', '/auth/signup', { name, identifier, password });
    setToken(r.token);
    setUser(r.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const addToCart = useCallback((item: Omit<CartItem, 'key'>) => {
    const key = item.productId + '|' + JSON.stringify(item.variantSelections);
    setCart((c) => {
      const existing = c.find((x) => x.key === key);
      if (existing) {
        return c.map((x) => (x.key === key ? { ...x, qty: x.qty + item.qty } : x));
      }
      return [...c, { ...item, key }];
    });
  }, []);

  const updateCartItem = useCallback((key: string, patch: Partial<CartItem>) => {
    setCart((c) => c.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setCart((c) => c.filter((x) => x.key !== key));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo<AppState>(
    () => ({
      online, dbDown, user, login, signup, logout,
      cart, addToCart, updateCartItem, removeFromCart, clearCart,
      toasts, toast, dismissToast,
    }),
    [online, dbDown, user, login, signup, logout, cart, addToCart, updateCartItem, removeFromCart, clearCart, toasts, toast, dismissToast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
