// Auth configuration - easily swap between test mode and database
import { AuthConfig } from "./types";
import { shouldUseLocalStorageMode } from "@/lib/runtimeMode";

// In a real app, these would come from environment variables
// For now, we use hardcoded values that can be easily replaced
export const authConfig: AuthConfig = {
  // Test account configuration
  enableTestAccount: true,
  testAccountEmail: import.meta.env.VITE_TEST_ACCOUNT_EMAIL ?? "test@test.com",
  testAccountPassword: import.meta.env.VITE_TEST_ACCOUNT_PASSWORD ?? "test",

  // Database configuration - can be forced off in Lovable/local mode
  databaseConnected:
    (import.meta.env.VITE_DATABASE_CONNECTED ?? "false") === "true" && !shouldUseLocalStorageMode(),
};

// Helper to check if we should use database auth
export function isDatabaseAuthEnabled(): boolean {
  return authConfig.databaseConnected;
}

// Helper to check if test account is enabled
export function isTestAccountEnabled(): boolean {
  return authConfig.enableTestAccount;
}
