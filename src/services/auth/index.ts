// Auth service exports
export { authService } from "./authService";
export type { User, AuthResult, AuthCredentials, SignupData, IAuthRepository, AuthConfig } from "./types";
export { authConfig, isDatabaseAuthEnabled, isTestAccountEnabled } from "./config";
