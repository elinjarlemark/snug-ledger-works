import { IAuthRepository, AuthCredentials, SignupData, AuthResult, User } from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class DatabaseAuthRepository implements IAuthRepository {
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      return {
        success: false,
        error: payload.error ?? "Invalid email or password",
      };
    }

    return {
      success: true,
      user: payload.user as User,
    };
  }

  async createUser(data: SignupData): Promise<AuthResult> {
    const response = await fetch(`${apiBaseUrl}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: payload?.detail?.[0]?.msg ?? "Unable to create user",
      };
    }

    return {
      success: true,
      user: payload as User,
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const response = await fetch(`${apiBaseUrl}/users`);
    const payload = await response.json().catch(() => []);
    if (!response.ok) {
      return null;
    }
    return payload.find((user: User) => user.id === id) ?? null;
  }
}
