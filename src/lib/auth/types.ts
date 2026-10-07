export type UserRole = "learner" | "admin";

export type UserAvatarKey =
  | "cloud"
  | "star"
  | "moon"
  | "book"
  | "sparkles"
  | "leaf";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarKey?: UserAvatarKey;
  joinedAt?: string;
};

export type AuthStatus = {
  configured: boolean;
  user: AuthUser | null;
};
