// Auth configuration - easily swap between test mode and database
import { AuthConfig } from "./types";

// In a real app, these would come from environment variables
// For now, we use hardcoded values that can be easily replaced
export const authConfig: AuthConfig = {
  // Test account configuration
  enableTestAccount: true,
  testAccountEmail: "test@test.com",
  testAccountPassword: "test",
  
  // Database configuration - set to true when database is connected
  // This would typically come from: import.meta.env.VITE_DATABASE_CONNECTED === 'true'
  databaseConnected: (import.meta.env.VITE_DATABASE_CONNECTED ?? "false") === "true",
};

// Helper to check if we should use database auth
export function isDatabaseAuthEnabled(): boolean {
  return authConfig.databaseConnected;
}

// Helper to check if test account is enabled
export function isTestAccountEnabled(): boolean {
  return authConfig.enableTestAccount;
}
