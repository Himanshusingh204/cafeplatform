"use client";

import * as React from "react";

export interface CartModifierSelection {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  id: string;
  dishId?: string;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  image?: string | null;
  modifiers?: CartModifierSelection[];
}

interface CartContextType {
  items: CartItem[];
  /** False during the first render so cart-dependent UI can avoid hydration mismatches. */
  hydrated: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  subtotal: number;
}

const CartContext = React.createContext<CartContextType | null>(null);

const STORAGE_KEY = "spice_saffron_cart";

function readCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Always start empty so the server and the first client render agree. The
  // stored cart is merged in after mount, which is also when persistence
  // becomes safe (we must not overwrite storage before reading it).
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    // One-time hydration from localStorage. There is no render-time equivalent:
    // the server cannot read storage, so the first client render must match the
    // server's empty cart and only then adopt the stored one.
    /* eslint-disable react-hooks/set-state-in-effect -- one-time storage hydration */
    setItems((prev) => (prev.length > 0 ? prev : readCartFromStorage()));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const persist = React.useCallback((nextItems: CartItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
    } catch {
      // Ignore
    }
  }, []);

  const openCart = React.useCallback(() => setIsOpen(true), []);
  const closeCart = React.useCallback(() => setIsOpen(false), []);

  const addItem = React.useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      const modifierKey =
        item.modifiers && item.modifiers.length > 0
          ? `::${item.modifiers.map((m) => m.optionId).sort().join(";")}`
          : "";
      const uniqueLineId = `${item.dishId || item.id}${modifierKey}`;
      const lineItem = { ...item, id: uniqueLineId, dishId: item.dishId || item.id };

      setItems((prev) => {
        const existing = prev.find((i) => i.id === uniqueLineId);
        const updated = existing
          ? prev.map((i) => (i.id === uniqueLineId ? { ...i, quantity: i.quantity + quantity } : i))
          : [...prev, { ...lineItem, quantity }];
        persist(updated);
        return updated;
      });
      setIsOpen(true);
    },
    [persist]
  );

  const removeItem = React.useCallback(
    (id: string) => {
      setItems((prev) => {
        const updated = prev.filter((i) => i.id !== id);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const updateQuantity = React.useCallback(
    (id: string, quantity: number) => {
      setItems((prev) => {
        const updated =
          quantity <= 0
            ? prev.filter((i) => i.id !== id)
            : prev.map((i) => (i.id === id ? { ...i, quantity } : i));
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const clearCart = React.useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        hydrated,
        isOpen,
        openCart,
        closeCart,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = React.useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
