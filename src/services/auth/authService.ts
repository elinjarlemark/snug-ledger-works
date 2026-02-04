// Auth service - single point of entry for authentication
// Easy to swap repositories by changing the import

import { IAuthRepository, AuthCredentials, SignupData, AuthResult, User } from "./types";
import { LocalAuthRepository } from "./localAuthRepository";
import { DatabaseAuthRepository } from "./databaseAuthRepository";
import { isDatabaseAuthEnabled } from "./config";

// Factory function to get the appropriate repository
function getAuthRepository(): IAuthRepository {
  if (isDatabaseAuthEnabled()) {
    return new DatabaseAuthRepository();
  }
  
  return new LocalAuthRepository();
}

class AuthService {
  private repository: IAuthRepository;

  constructor() {
    this.repository = getAuthRepository();
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const credentials: AuthCredentials = { email, password };
    return this.repository.authenticate(credentials);
  }

  async signup(email: string, password: string, name: string): Promise<AuthResult> {
    const data: SignupData = { email, password, name };
    return this.repository.createUser(data);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.repository.getUserById(id);
  }

  // Method to check if database auth is configured
  isDatabaseConnected(): boolean {
    return isDatabaseAuthEnabled();
  }
}

// Export singleton instance
export const authService = new AuthService();

// Also export types for convenience
export type { User, AuthResult } from "./types";
