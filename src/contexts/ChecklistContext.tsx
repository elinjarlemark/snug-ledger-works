import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt?: string;
}

interface ChecklistContextType {
  items: ChecklistItem[];
  addItem: (text: string) => void;
  updateItem: (id: string, text: string) => void;
  deleteItem: (id: string) => void;
  toggleDone: (id: string, done: boolean) => void;
}

const ChecklistContext = createContext<ChecklistContextType | undefined>(undefined);

const storageKey = (companyId: string) => `checklist_items_${companyId}`;

export function ChecklistProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (!activeCompany) {
      setItems([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(activeCompany.id));
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, [activeCompany?.id]);

  const persist = useCallback(
    (next: ChecklistItem[]) => {
      setItems(next);
      if (activeCompany) {
        localStorage.setItem(storageKey(activeCompany.id), JSON.stringify(next));
      }
    },
    [activeCompany?.id]
  );

  const addItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newItem: ChecklistItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      done: false,
      createdAt: new Date().toISOString(),
    };
    persist([newItem, ...items]);
  };

  const updateItem = (id: string, text: string) => {
    persist(items.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  const deleteItem = (id: string) => {
    persist(items.filter((i) => i.id !== id));
  };

  const toggleDone = (id: string, done: boolean) => {
    persist(
      items.map((i) =>
        i.id === id
          ? { ...i, done, completedAt: done ? new Date().toISOString() : undefined }
          : i
      )
    );
  };

  return (
    <ChecklistContext.Provider value={{ items, addItem, updateItem, deleteItem, toggleDone }}>
      {children}
    </ChecklistContext.Provider>
  );
}

export function useChecklist() {
  const ctx = useContext(ChecklistContext);
  if (!ctx) throw new Error("useChecklist must be used within ChecklistProvider");
  return ctx;
}
