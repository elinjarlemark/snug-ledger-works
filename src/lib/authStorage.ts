import { shouldUseLocalStorageMode } from "./runtimeMode";

// Keep preview logins and numeric database accounts separate on the same origin.
const prefix = () => shouldUseLocalStorageMode() ? "" : "accountpro-database:";
const keys = () => Object.keys(localStorage).filter(key => key.startsWith(prefix()));
export const authStorage = {
  getItem: (key: string) => localStorage.getItem(prefix() + key),
  setItem: (key: string, value: string) => localStorage.setItem(prefix() + key, value),
  removeItem: (key: string) => localStorage.removeItem(prefix() + key),
  get length() { return keys().length; },
  key: (index: number) => keys()[index]?.slice(prefix().length) ?? null,
};
