import { createContext, useContext, useEffect, useState, useMemo, useRef, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting } from "@/contexts/AccountingContext";
import { useReceipts } from "@/contexts/ReceiptsContext";
import { useChecklist, SmartRuleChecklistMeta } from "@/contexts/ChecklistContext";
import {
  SmartRuleConfig,
  defaultRuleConfigs,
  evaluateAllRules,
  EvaluationContext,
  BuiltInTemplateId,
} from "@/lib/checklist/smartRules";

interface SmartChecklistContextType {
  rules: SmartRuleConfig[];
  setRuleEnabled: (id: string, enabled: boolean) => void;
  addCustomRule: (input: {
    accountNumber: string;
    label: string;
    period: SmartRuleConfig["custom"] extends { period: infer P } ? P : never;
    triggerWhen: "missing" | "present";
  }) => void;
  removeCustomRule: (id: string) => void;
  /** Trigger an immediate re-evaluation (e.g. after creating a voucher). */
  reevaluate: () => void;
}

const SmartChecklistContext = createContext<SmartChecklistContextType | undefined>(undefined);

const storageKey = (companyId: string) => `smart_checklist_rules_${companyId}`;

export function useReceiptsSafe() {
  // ReceiptsContext throws if used outside provider — but we know it's provided at app root.
  return useReceipts();
}

export function SmartChecklistProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const { vouchers } = useAccounting();
  const { receipts } = useReceipts();
  const { syncSmartItems } = useChecklist();

  const [rules, setRules] = useState<SmartRuleConfig[]>([]);
  const [tick, setTick] = useState(0); // for forced re-evaluation

  // Load + reset on company change
  useEffect(() => {
    if (!activeCompany) {
      setRules([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(activeCompany.id));
      if (raw) {
        const stored: SmartRuleConfig[] = JSON.parse(raw);
        // Merge with defaults to add any new templates introduced after the user first loaded
        const defaults = defaultRuleConfigs();
        const byId = new Map(stored.map((r) => [r.id, r]));
        for (const d of defaults) if (!byId.has(d.id)) byId.set(d.id, d);
        setRules(Array.from(byId.values()));
      } else {
        setRules(defaultRuleConfigs());
      }
    } catch {
      setRules(defaultRuleConfigs());
    }
  }, [activeCompany?.id]);

  const persist = useCallback(
    (next: SmartRuleConfig[]) => {
      setRules(next);
      if (activeCompany) {
        try {
          localStorage.setItem(storageKey(activeCompany.id), JSON.stringify(next));
        } catch (err) {
          console.error("Failed to persist smart rules:", err);
        }
      }
    },
    [activeCompany?.id],
  );

  const setRuleEnabled = (id: string, enabled: boolean) => {
    persist(rules.map((r) => (r.id === id ? { ...r, enabled } : r)));
  };

  const addCustomRule: SmartChecklistContextType["addCustomRule"] = ({
    accountNumber,
    label,
    period,
    triggerWhen,
  }) => {
    const id = `custom:${Date.now()}-${Math.random().toString(36).slice(2, 6)}` as const;
    const newRule: SmartRuleConfig = {
      id,
      kind: "custom-account",
      enabled: true,
      custom: { accountNumber, label, period, triggerWhen },
    };
    persist([...rules, newRule]);
  };

  const removeCustomRule = (id: string) => {
    persist(rules.filter((r) => r.id !== id));
  };

  const reevaluate = useCallback(() => setTick((t) => t + 1), []);

  // Build evaluation context (memoised)
  const ctx = useMemo<EvaluationContext>(() => {
    const now = new Date();
    return {
      vouchers,
      receipts,
      now,
      fiscalYearStart: new Date(now.getFullYear(), 0, 1),
      unallocatedReceiptDays: 14,
      bankReconcileDays: 30,
    };
    // We intentionally include `tick` so consumers can force a refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vouchers, receipts, tick]);

  // Run sync whenever rules or evaluation context changes
  const lastSyncRef = useRef<string>("");
  useEffect(() => {
    if (!activeCompany) return;
    const evals = evaluateAllRules(rules, ctx);
    const smartItems = evals.map((e) => ({
      occurrenceKey: e.occurrenceKey,
      text: e.text,
      resolved: e.resolved,
      meta: {
        kind: "smart-rule" as const,
        ruleId: e.ruleId,
        templateId: e.templateId,
        occurrenceKey: e.occurrenceKey,
        explanation: e.explanation,
        suggestedAccountNumber: e.suggestedAccountNumber,
      } satisfies SmartRuleChecklistMeta,
    }));

    // Avoid unnecessary state churn — only sync when content changes
    const sig = JSON.stringify(smartItems);
    if (sig === lastSyncRef.current) return;
    lastSyncRef.current = sig;
    syncSmartItems(smartItems);
  }, [rules, ctx, activeCompany?.id, syncSmartItems]);

  return (
    <SmartChecklistContext.Provider
      value={{ rules, setRuleEnabled, addCustomRule, removeCustomRule, reevaluate }}
    >
      {children}
    </SmartChecklistContext.Provider>
  );
}

export function useSmartChecklist() {
  const ctx = useContext(SmartChecklistContext);
  if (!ctx) throw new Error("useSmartChecklist must be used within SmartChecklistProvider");
  return ctx;
}
