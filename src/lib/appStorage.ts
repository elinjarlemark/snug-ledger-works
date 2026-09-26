import { shouldUseLocalStorageMode } from "./runtimeMode";

type Values = Record<string, string>;
type Scope = { kind: "user" | "company"; id: string; userId: string; values: Values; version: number; dirty: boolean; error: string; flight?: Promise<void> };
let scopes: Scope[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const api = (import.meta.env.VITE_API_BASE_URL ?? "/backend").replace(/\/$/, "");
const announce = () => listeners.forEach(listener => listener());
const journalKey = (scope: Scope) => `accountpro-db-outbox:${scope.userId}:${scope.kind}:${scope.id}`;
const endpoint = (scope: Scope) => `${api}/workspace/${scope.kind}/${scope.id}`;

function journal(scope: Scope) {
  // A small local recovery copy remains until PostgreSQL acknowledges the write.
  try { localStorage.setItem(journalKey(scope), JSON.stringify({ version: scope.version, values: scope.values })); }
  catch { /* Large attachments can exceed browser quota; the database write still proceeds. */ }
}

async function save(scope: Scope): Promise<void> {
  if (scope.flight) return scope.flight;
  if (!scope.dirty) return;
  scope.flight = (async () => {
    while (scope.dirty) {
      const values = { ...scope.values };
      try {
        const response = await fetch(endpoint(scope), {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: Number(scope.userId), version: scope.version, values }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Kunde inte spara till databasen.");
        scope.version = payload.version;
        scope.error = "";
        scope.dirty = JSON.stringify(scope.values) !== JSON.stringify(values);
        if (scope.dirty) journal(scope);
        else localStorage.removeItem(journalKey(scope));
      } catch (error) {
        scope.error = error instanceof Error ? error.message : "Databasen kunde inte nås.";
        announce();
        throw error;
      }
      announce();
    }
  })().finally(() => { scope.flight = undefined; announce(); });
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
      const scope: Scope = { kind, id, userId, values: {}, version: 0, dirty: false, error: "" };
      const response = await fetch(`${endpoint(scope)}?user_id=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error("Kunde inte läsa sparade data. Kontrollera att Docker körs och försök igen.");
      const payload = await response.json();
      scope.version = payload.version;
      scope.values = payload.values;
      const recovery = localStorage.getItem(journalKey(scope));
      if (recovery) {
        const pending = JSON.parse(recovery);
        if (JSON.stringify(pending.values) === JSON.stringify(scope.values)) localStorage.removeItem(journalKey(scope));
        else if (pending.version === scope.version) {
          scope.values = pending.values;
          scope.dirty = true;
          await save(scope);
        } else {
          throw new Error("Det finns osparade ändringar från en tidigare session och nyare data i databasen. Exportera återställningskopian innan du fortsätter.");
        }
      }
      next.push(scope);
    }
  }
  scopes = next;
  announce();
}

function scopeFor(key: string) {
  const personal = key === "accountpro_standard_voucher_templates" || key === "accountpro_voucher_confirmation_enabled" || key.startsWith("accountpro_personal_number_");
  return scopes.find(scope => scope.kind === (personal ? "user" : "company"));
}

function change(key: string, value: string | null) {
  if (shouldUseLocalStorageMode()) {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    return;
  }
  const scope = scopeFor(key);
  if (!scope) return; // No company selected: nothing to persist yet.
  if ((scope.values[key] ?? null) === value) return;
  if (value === null) delete scope.values[key]; else scope.values[key] = value;
  scope.dirty = true;
  journal(scope);
  announce();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void flushAppStorage().catch(() => undefined); }, 150);
}

export const appStorage = {
  getItem(key: string): string | null {
    return shouldUseLocalStorageMode() ? localStorage.getItem(key) : scopeFor(key)?.values[key] ?? null;
  },
  setItem: (key: string, value: string) => change(key, value),
  removeItem: (key: string) => change(key, null),
};

export function subscribeStorage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function storageStatus() { return scopes.find(scope => scope.error)?.error || (scopes.some(scope => scope.dirty) ? "saving" : "saved"); }
export function downloadRecovery() {
  const recovery: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("accountpro-db-outbox:")) recovery[key] = JSON.parse(localStorage.getItem(key)!);
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(recovery, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "accountpro-osparade-andringar.json"; link.click(); URL.revokeObjectURL(url);
}

if (typeof window !== "undefined") window.addEventListener("beforeunload", event => {
  if (scopes.some(scope => scope.dirty)) { event.preventDefault(); event.returnValue = ""; }
});
