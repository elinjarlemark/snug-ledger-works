import { shouldUseLocalStorageMode } from "./runtimeMode";

type Values = Record<string, string>;
type VoucherAssignment = {
  voucherNumber?: number;
  series?: string;
  fiscalYearStart?: string;
};
type VoucherAssignments = Record<string, VoucherAssignment>;
type Scope = {
  kind: "user" | "company";
  id: string;
  userId: string;
  values: Values;
  version: number;
  dirty: boolean;
  error: string;
  flight?: Promise<void>;
};

let scopes: Scope[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const api = (import.meta.env.VITE_API_BASE_URL ?? "/backend").replace(/\/$/, "");
const announce = () => listeners.forEach(listener => listener());
const journalKey = (scope: Scope) => `accountpro-db-outbox:${scope.userId}:${scope.kind}:${scope.id}`;
const endpoint = (scope: Scope) => `${api}/workspace/${scope.kind}/${scope.id}`;

function isValues(value: unknown): value is Values {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(entry => typeof entry === "string");
}

function isAssignments(value: unknown): value is VoucherAssignments {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function journal(scope: Scope) {
  // A small local recovery copy remains until PostgreSQL acknowledges the write.
  try {
    localStorage.setItem(
      journalKey(scope),
      JSON.stringify({ version: scope.version, values: scope.values }),
    );
  } catch {
    // Large attachments can exceed browser quota; the database write still proceeds.
  }
}

function applyVoucherAssignments(
  scope: Scope,
  key: string,
  value: string,
  assignments: VoucherAssignments,
): string | null {
  if (scope.kind !== "company" || Object.keys(assignments).length === 0) return null;

  const voucherKey = `accountpro_vouchers_${scope.id}`;
  const receiptKey = `accountpro_receipts_${scope.id}`;

  try {
    if (key === voucherKey) {
      const rows = JSON.parse(value);
      if (!Array.isArray(rows)) return null;

      for (const voucher of rows) {
        if (!voucher || typeof voucher !== "object") continue;

        const own = assignments[String(voucher.id ?? "")];
        if (own) {
          if (typeof own.voucherNumber === "number") voucher.voucherNumber = own.voucherNumber;
          if (typeof own.series === "string") voucher.series = own.series;
        }

        const reversal = assignments[String(voucher.reversedByVoucherId ?? "")];
        if (reversal && typeof reversal.voucherNumber === "number") {
          voucher.reversedByVoucherNumber = reversal.voucherNumber;
        }
      }

      return JSON.stringify(rows);
    }

    if (key === receiptKey) {
      const rows = JSON.parse(value);
      if (!Array.isArray(rows)) return null;

      for (const receipt of rows) {
        if (!receipt || typeof receipt !== "object") continue;
        const assignment = assignments[String(receipt.voucherId ?? "")];
        if (assignment) {
          if (typeof assignment.voucherNumber === "number") {
            receipt.voucherNumber = assignment.voucherNumber;
          }
          if (typeof assignment.series === "string") {
            receipt.voucherSeries = assignment.series;
          }
        }
      }

      return JSON.stringify(rows);
    }
  } catch {
    return null;
  }

  return null;
}

function reconcileServerValues(
  scope: Scope,
  sentValues: Values,
  serverValues: Values,
  assignments: VoucherAssignments,
): void {
  const currentValues = scope.values;
  const merged: Values = { ...currentValues };
  const keys = new Set([
    ...Object.keys(sentValues),
    ...Object.keys(serverValues),
    ...Object.keys(currentValues),
  ]);

  for (const key of keys) {
    const sent = sentValues[key];
    const server = serverValues[key];
    const current = currentValues[key];

    // No local change happened to this key while the request was in flight.
    // The server response is therefore authoritative, including voucher numbers.
    if (current === sent) {
      if (server === undefined) delete merged[key];
      else merged[key] = server;
      continue;
    }

    // The server left this key untouched while the browser made a newer change.
    if (server === sent) {
      continue;
    }

    // Both sides already agree.
    if (current === server) {
      continue;
    }

    // Voucher allocation is the one expected case where both the server and a
    // newer local state can touch the same value. Replay the database-owned
    // assignment onto the newest browser value rather than restoring stale data.
    if (current !== undefined) {
      const reconciled = applyVoucherAssignments(scope, key, current, assignments);
      if (reconciled !== null) {
        merged[key] = reconciled;
        continue;
      }
    }

    // For any unrelated simultaneous change, keep the newer local value. It
    // remains dirty and is written in the next loop using the new DB version.
  }

  scope.values = merged;
}

async function save(scope: Scope): Promise<void> {
  if (scope.flight) return scope.flight;
  if (!scope.dirty) return;

  scope.flight = (async () => {
    while (scope.dirty) {
      const values = { ...scope.values };

      try {
        const response = await fetch(endpoint(scope), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: Number(scope.userId),
            version: scope.version,
            values,
            // Company workspaces use PostgreSQL as the owner of definitive
            // voucher numbers. User-scoped preferences never allocate numbers.
            allocate_voucher_numbers: scope.kind === "company",
          }),
        });

        const payload: unknown = await response.json();
        const body = payload && typeof payload === "object"
          ? payload as Record<string, unknown>
          : {};

        if (!response.ok) {
          const detail = body.detail;
          throw new Error(typeof detail === "string" ? detail : "Kunde inte spara till databasen.");
        }

        if (typeof body.version !== "number") {
          throw new Error("Databasen returnerade ett ogiltigt versionsnummer.");
        }

        const serverValues = isValues(body.values) ? body.values : values;
        const assignments = isAssignments(body.voucher_assignments)
          ? body.voucher_assignments
          : {};

        scope.version = body.version;
        reconcileServerValues(scope, values, serverValues, assignments);
        scope.error = "";
        scope.dirty = JSON.stringify(scope.values) !== JSON.stringify(serverValues);

        if (scope.dirty) journal(scope);
        else localStorage.removeItem(journalKey(scope));
      } catch (error) {
        scope.error = error instanceof Error ? error.message : "Databasen kunde inte nås.";
        announce();
        throw error;
      }

      announce();
    }
  })().finally(() => {
    scope.flight = undefined;
    announce();
  });

  return scope.flight;
}

export async function flushAppStorage() {
  if (timer) clearTimeout(timer);
  await Promise.all(scopes.map(save));
}

export async function activateAppStorage(userId?: string, companyId?: string) {
  if (shouldUseLocalStorageMode()) return;
  await flushAppStorage();

  const next: Scope[] = [];
  if (userId) {
    for (const [kind, id] of [["user", userId], ["company", companyId]] as const) {
      if (!id) continue;

      const scope: Scope = {
        kind,
        id,
        userId,
        values: {},
        version: 0,
        dirty: false,
        error: "",
      };

      const response = await fetch(`${endpoint(scope)}?user_id=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error("Kunde inte läsa sparade data. Kontrollera att Docker körs och försök igen.");
      }

      const payload = await response.json();
      scope.version = payload.version;
      scope.values = payload.values;

      const recovery = localStorage.getItem(journalKey(scope));
      if (recovery) {
        const pending = JSON.parse(recovery);
        if (JSON.stringify(pending.values) === JSON.stringify(scope.values)) {
          localStorage.removeItem(journalKey(scope));
        } else if (pending.version === scope.version) {
          scope.values = pending.values;
          scope.dirty = true;
          await save(scope);
        } else {
          throw new Error(
            "Det finns osparade ändringar från en tidigare session och nyare data i databasen. " +
            "Exportera återställningskopian innan du fortsätter.",
          );
        }
      }

      next.push(scope);
    }
  }

  scopes = next;
  announce();
}

function scopeFor(key: string) {
  const personal =
    key === "accountpro_standard_voucher_templates" ||
    key === "accountpro_voucher_confirmation_enabled" ||
    key.startsWith("accountpro_personal_number_");

  return scopes.find(scope => scope.kind === (personal ? "user" : "company"));
}

function change(key: string, value: string | null) {
  if (shouldUseLocalStorageMode()) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return;
  }

  const scope = scopeFor(key);
  if (!scope) return; // No company selected: nothing to persist yet.
  if ((scope.values[key] ?? null) === value) return;

  if (value === null) delete scope.values[key];
  else scope.values[key] = value;

  scope.dirty = true;
  journal(scope);
  announce();

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void flushAppStorage().catch(() => undefined);
  }, 150);
}

export const appStorage = {
  getItem(key: string): string | null {
    return shouldUseLocalStorageMode()
      ? localStorage.getItem(key)
      : scopeFor(key)?.values[key] ?? null;
  },
  setItem: (key: string, value: string) => change(key, value),
  removeItem: (key: string) => change(key, null),
};

export function subscribeStorage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function storageStatus() {
  return scopes.find(scope => scope.error)?.error ||
    (scopes.some(scope => scope.dirty) ? "saving" : "saved");
}

export function downloadRecovery() {
  const recovery: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("accountpro-db-outbox:")) {
      recovery[key] = JSON.parse(localStorage.getItem(key)!);
    }
  }

  const url = URL.createObjectURL(
    new Blob([JSON.stringify(recovery, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "accountpro-osparade-andringar.json";
  link.click();
  URL.revokeObjectURL(url);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", event => {
    if (scopes.some(scope => scope.dirty)) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
