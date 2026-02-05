// Auth service types - designed for easy database swapping

export interface User {
  id: string | number;
  email: string;
  name: string;
  role?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignupData extends AuthCredentials {
  name: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

// Repository interface - implement this for different data sources
export interface IAuthRepository {
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  createUser(data: SignupData): Promise<AuthResult>;
  getUserById(id: string): Promise<User | null>;
}

// Configuration interface
export interface AuthConfig {
  enableTestAccount: boolean;
  testAccountEmail: string;
  testAccountPassword: string;
  databaseConnected: boolean;
}
