// Local/Mock auth repository - uses localStorage
// This can be replaced with a database repository later

import { IAuthRepository, AuthCredentials, SignupData, AuthResult, User } from "./types";
import { authConfig, isTestAccountEnabled } from "./config";

export class LocalAuthRepository implements IAuthRepository {
  private readonly STORAGE_KEY = "accountpro_users";

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const { email, password } = credentials;

    // Check test account first if enabled
    if (isTestAccountEnabled()) {
      if (
        email === authConfig.testAccountEmail &&
        password === authConfig.testAccountPassword
      ) {
        return {
          success: true,
          user: {
            id: "test-user-id",
            email: authConfig.testAccountEmail,
            name: "Test User",
          },
        };
      }
    }

    // Check stored users (mock database)
    const users = this.getStoredUsers();
    const user = users.find(
      (u) => u.email === email && u.password === password
    );

    if (user) {
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    }

    // If no database is connected, allow any login for demo purposes
    // In production, this would return an error
    if (!authConfig.databaseConnected) {
      return {
        success: true,
        user: {
          id: crypto.randomUUID(),
          email,
          name: email.split("@")[0],
        },
      };
    }

    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  async createUser(data: SignupData): Promise<AuthResult> {
    const { email, password, name } = data;

    // Check if user already exists
    const users = this.getStoredUsers();
    if (users.some((u) => u.email === email)) {
      return {
        success: false,
        error: "User with this email already exists",
      };
    }

    const newUser = {
      id: crypto.randomUUID(),
      email,
      password, // In production, this would be hashed
      name,
    };

    users.push(newUser);
    this.saveUsers(users);

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    };
  }

  async getUserById(id: string): Promise<User | null> {
    // Handle test user
    if (id === "test-user-id" && isTestAccountEnabled()) {
      return {
        id: "test-user-id",
        email: authConfig.testAccountEmail,
        name: "Test User",
      };
    }

    const users = this.getStoredUsers();
    const user = users.find((u) => u.id === id);
    
    if (user) {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    }

    return null;
  }

  private getStoredUsers(): Array<{ id: string; email: string; password: string; name: string }> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveUsers(users: Array<{ id: string; email: string; password: string; name: string }>): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(users));
  }
}
