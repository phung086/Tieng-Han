export type UserRole = "learner" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type AuthStatus = {
  configured: boolean;
  user: AuthUser | null;
};
