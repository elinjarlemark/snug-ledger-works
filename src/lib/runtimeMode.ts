const explicitStorageMode = (import.meta.env.VITE_STORAGE_MODE ?? "").toLowerCase();

export function isLovableHost(host = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  const hostname = host.toLowerCase();
  return ["lovable.app", "lovable.dev", "lovableproject.com"].some(domain => hostname === domain || hostname.endsWith("." + domain));
}

export function shouldUseLocalStorageMode(): boolean {
  // Preview must never depend on a backend running on the visitor's computer.
  if (isLovableHost()) return true;
  if (explicitStorageMode === "local") return true;
  if (explicitStorageMode === "database") return false;
  return import.meta.env.VITE_DATABASE_CONNECTED !== "true";
}
