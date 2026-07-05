import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, User } from '../lib/types';
import { apiGet, apiSend, onDbStatus, setToken } from '../lib/api';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

export type AddToCartResult = 'added' | 'updated';

interface AppState {
  online: boolean;
  dbDown: boolean;
  user: User | null;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (name: string, identifier: string, password: string) => Promise<void>;
  logout: () => void;
  cart: CartItem[];
  /** 'increment' stacks qty onto an existing identical line; 'replace' sets it (used by Buy now so double-taps never double the order). */
  addToCart: (item: Omit<CartItem, 'key'>, mode?: 'increment' | 'replace') => AddToCartResult;
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

  const addToCart = useCallback((item: Omit<CartItem, 'key'>, mode: 'increment' | 'replace' = 'increment') => {
    const key = `${item.productId}|${JSON.stringify(item.variantSelections)}`;
    let result: AddToCartResult = 'added';
    setCart((c) => {
      const existing = c.find((x) => x.key === key);
      if (existing) {
        result = 'updated';
        const qty = mode === 'replace' ? item.qty : existing.qty + item.qty;
        const note =
          existing.note && item.note && existing.note !== item.note
            ? `${existing.note} | ${item.note}`
            : existing.note || item.note;
        return c.map((x) => (x.key === key ? { ...x, qty, note } : x));
      }
      return [...c, { ...item, key }];
    });
    return result;
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
