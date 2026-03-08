const explicitStorageMode = (import.meta.env.VITE_STORAGE_MODE ?? "").toLowerCase();

function isLovableHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname.toLowerCase();
  return host.includes("lovable") || host.endsWith("lovable.app") || host.endsWith("lovable.dev");
}

export function shouldUseLocalStorageMode(): boolean {
  if (explicitStorageMode === "local") {
    return true;
  }

  if (explicitStorageMode === "database") {
    return false;
  }

  return isLovableHost();
}

