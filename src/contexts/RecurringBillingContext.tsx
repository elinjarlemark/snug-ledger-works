import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBilling } from "@/contexts/BillingContext";
import { useChecklist } from "@/contexts/ChecklistContext";
import {
  RecurringInvoice,
  computeIssueDate,
  computeDueDate,
  daysBetween,
  stepDescription,
  todayIso,
} from "@/lib/billing/recurring";

interface RecurringBillingContextType {
  recurring: RecurringInvoice[];
  addRecurring: (
    data: Omit<RecurringInvoice, "id" | "companyId" | "createdAt" | "generatedCount">,
  ) => RecurringInvoice;
  updateRecurring: (rec: RecurringInvoice) => void;
  deleteRecurring: (id: string) => void;
  /** Manually push the next pending occurrence to checklist (useful after edit). */
  generateNow: (id: string) => void;
}

const RecurringBillingContext = createContext<RecurringBillingContextType | undefined>(undefined);

const storageKey = (companyId: string) => `recurring_invoices_${companyId}`;

export function RecurringBillingProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const { customers } = useBilling();
  const { addItem, hasItemForRecurring } = useChecklist();
  const [recurring, setRecurring] = useState<RecurringInvoice[]>([]);
  const companyId = activeCompany?.id ?? "";

  useEffect(() => {
    if (!companyId) {
      setRecurring([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(companyId));
      setRecurring(raw ? JSON.parse(raw) : []);
    } catch {
      setRecurring([]);
    }
  }, [companyId]);

  const persist = useCallback(
    (next: RecurringInvoice[]) => {
      setRecurring(next);
      if (companyId) localStorage.setItem(storageKey(companyId), JSON.stringify(next));
    },
    [companyId],
  );

  const addRecurring = (
    data: Omit<RecurringInvoice, "id" | "companyId" | "createdAt" | "generatedCount">,
  ): RecurringInvoice => {
    const newRec: RecurringInvoice = {
      ...data,
      id: crypto.randomUUID(),
      companyId,
      generatedCount: 0,
      createdAt: new Date().toISOString(),
    };
    persist([...recurring, newRec]);
    return newRec;
  };

  const updateRecurring = (rec: RecurringInvoice) => {
    persist(recurring.map((r) => (r.id === rec.id ? rec : r)));
  };

  const deleteRecurring = (id: string) => {
    persist(recurring.filter((r) => r.id !== id));
  };

  /** Build a checklist item for a given occurrence. */
  const buildChecklistItem = useCallback(
    (rec: RecurringInvoice, occurrenceIndex: number) => {
      const issueDate = computeIssueDate(
        rec.firstIssueDate,
        occurrenceIndex,
        rec.frequency,
        rec.customIntervalDays,
      );
      const dueDate = computeDueDate(issueDate, rec.dueDateMode);
      const description = stepDescription(rec.description, occurrenceIndex, rec.frequency);
      const customer = customers.find((c) => c.id === rec.customerId);
      const customerAddress = customer
        ? `${customer.address}, ${customer.postalCode} ${customer.city}`
        : undefined;
      const text = `Automatisk invoice för ${rec.customerName} redo`;

      addItem(text, {
        kind: "recurring-invoice",
        recurringId: rec.id,
        occurrenceIndex,
        customerId: rec.customerId,
        customerName: rec.customerName,
        customerAddress,
        description,
        issueDate,
        dueDate,
        lines: rec.lines.map((l) => ({ ...l })),
      });
    },
    [addItem, customers],
  );

  /** Periodic check: for each recurring invoice, if next occurrence is within lead time, push to checklist. */
  const lastCheckRef = useRef(0);
  useEffect(() => {
    if (!companyId || recurring.length === 0) return;

    const tick = () => {
      const today = todayIso();
      let didChange = false;
      const next = recurring.map((rec) => {
        let generated = rec.generatedCount;
        // Generate every occurrence whose (issueDate - leadTime) is <= today,
        // up to totalCount.
        while (generated < rec.totalCount) {
          const issueDate = computeIssueDate(
            rec.firstIssueDate,
            generated,
            rec.frequency,
            rec.customIntervalDays,
          );
          const triggerOffset = -Math.max(0, rec.leadTimeDays); // create N days BEFORE issue
          const triggerDate = (() => {
            const [y, m, d] = issueDate.split("-").map(Number);
            const dt = new Date(y, m - 1, d);
            dt.setDate(dt.getDate() + triggerOffset);
            return dt.toISOString().slice(0, 10);
          })();
          if (daysBetween(triggerDate, today) >= 0) {
            // Trigger if checklist item not already present (avoids dupes after revert).
            if (!hasItemForRecurring(rec.id, generated)) {
              buildChecklistItem(rec, generated);
            }
            generated += 1;
            didChange = true;
          } else {
            break;
          }
        }
        return generated !== rec.generatedCount ? { ...rec, generatedCount: generated } : rec;
      });
      if (didChange) persist(next);
      lastCheckRef.current = Date.now();
    };

    // Run on mount and once per minute thereafter.
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [companyId, recurring, buildChecklistItem, hasItemForRecurring, persist]);

  const generateNow = (id: string) => {
    const rec = recurring.find((r) => r.id === id);
    if (!rec || rec.generatedCount >= rec.totalCount) return;
    if (!hasItemForRecurring(rec.id, rec.generatedCount)) {
      buildChecklistItem(rec, rec.generatedCount);
    }
    persist(
      recurring.map((r) => (r.id === id ? { ...r, generatedCount: r.generatedCount + 1 } : r)),
    );
  };

  return (
    <RecurringBillingContext.Provider
      value={{ recurring, addRecurring, updateRecurring, deleteRecurring, generateNow }}
    >
      {children}
    </RecurringBillingContext.Provider>
  );
}

export function useRecurringBilling() {
  const ctx = useContext(RecurringBillingContext);
  if (!ctx) throw new Error("useRecurringBilling must be used within RecurringBillingProvider");
  return ctx;
}
