import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface RecurringChecklistMeta {
  kind: "recurring-invoice";
  recurringId: string;
  occurrenceIndex: number; // 0-based
  customerId: string;
  customerName: string;
  customerAddress?: string;
  description: string;
  issueDate: string;
  dueDate: string;
  lines: Array<{
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>;
}

export interface SmartRuleChecklistMeta {
  kind: "smart-rule";
  ruleId: string;
  templateId?: string;
  occurrenceKey: string;
  explanation: string;
  suggestedAccountNumber?: string;
}

export type ChecklistItemMeta = RecurringChecklistMeta | SmartRuleChecklistMeta;

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt?: string;
  /** Set by smart-rule sync when the underlying condition becomes satisfied. */
  resolvedAt?: string;
  meta?: ChecklistItemMeta;
}

interface ChecklistContextType {
  items: ChecklistItem[];
  addItem: (text: string, meta?: ChecklistItemMeta) => ChecklistItem;
  updateItem: (id: string, text: string) => void;
  deleteItem: (id: string) => void;
  toggleDone: (id: string, done: boolean) => void;
  setResolved: (id: string, resolved: boolean) => void;
  /** Bulk replace items that match a predicate — used by SmartChecklistContext to sync rule items. */
  syncSmartItems: (
    nextSmartItems: Array<{
      occurrenceKey: string;
      text: string;
      meta: SmartRuleChecklistMeta;
      resolved: boolean;
    }>,
  ) => void;
  hasItemForRecurring: (recurringId: string, occurrenceIndex: number) => boolean;
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

  const addItem = (text: string, meta?: ChecklistItemMeta) => {
    const trimmed = text.trim();
    const newItem: ChecklistItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed || text,
      done: false,
      createdAt: new Date().toISOString(),
      meta,
    };
    persist([newItem, ...items]);
    return newItem;
  };

  const hasItemForRecurring = (recurringId: string, occurrenceIndex: number) =>
    items.some(
      (i) =>
        i.meta?.kind === "recurring-invoice" &&
        i.meta.recurringId === recurringId &&
        i.meta.occurrenceIndex === occurrenceIndex,
    );

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

  const setResolved = (id: string, resolved: boolean) => {
    persist(
      items.map((i) =>
        i.id === id
          ? { ...i, resolvedAt: resolved ? new Date().toISOString() : undefined }
          : i,
      ),
    );
  };

  /**
   * Reconcile smart-rule items with the latest evaluation pass.
   *
   * Behaviour:
   *  - New occurrenceKey → insert a fresh active smart item.
   *  - Existing key, no longer in evaluation set → leave the item untouched
   *    (rule stopped triggering AFTER user dismissed; user already handled it).
   *  - Existing key still present, evaluation says resolved → mark resolvedAt
   *    (shows green "Löst!" badge in Active until user confirms).
   *  - Existing key still present, evaluation says NOT resolved (and item was
   *    previously marked resolved) → clear resolvedAt (rule re-triggered).
   *  - Done items are never re-resurrected.
   */
  const syncSmartItems: ChecklistContextType["syncSmartItems"] = (nextSmartItems) => {
    const now = new Date().toISOString();
    const byKey = new Map(nextSmartItems.map((s) => [s.occurrenceKey, s]));

    let next = items.map((i) => {
      if (i.meta?.kind !== "smart-rule") return i;
      const evalItem = byKey.get(i.meta.occurrenceKey);
      if (!evalItem) return i; // not in current eval — leave as-is
      // Refresh text/explanation in case wording or counts changed
      const updated: ChecklistItem = {
        ...i,
        text: evalItem.text,
        meta: { ...i.meta, explanation: evalItem.meta.explanation },
      };
      if (evalItem.resolved && !i.resolvedAt && !i.done) {
        updated.resolvedAt = now;
      } else if (!evalItem.resolved && i.resolvedAt) {
        updated.resolvedAt = undefined;
      }
      return updated;
    });

    const existingKeys = new Set(
      items
        .filter((i) => i.meta?.kind === "smart-rule")
        .map((i) => (i.meta as SmartRuleChecklistMeta).occurrenceKey),
    );
    for (const s of nextSmartItems) {
      if (existingKeys.has(s.occurrenceKey)) continue;
      next = [
        {
          id: `smart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: s.text,
          done: false,
          createdAt: now,
          resolvedAt: s.resolved ? now : undefined,
          meta: s.meta,
        },
        ...next,
      ];
    }
    persist(next);
  };

  return (
    <ChecklistContext.Provider
      value={{
        items,
        addItem,
        updateItem,
        deleteItem,
        toggleDone,
        setResolved,
        syncSmartItems,
        hasItemForRecurring,
      }}
    >
      {children}
    </ChecklistContext.Provider>
  );
}

export function useChecklist() {
  const ctx = useContext(ChecklistContext);
  if (!ctx) throw new Error("useChecklist must be used within ChecklistProvider");
  return ctx;
}
