import {
  BookOpen,
  Cloud,
  Leaf,
  Moon,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { UserAvatarKey } from "@/lib/auth/types";

export const avatarOptions: Array<{
  key: UserAvatarKey;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "cloud", label: "Đám mây", icon: Cloud },
  { key: "star", label: "Ngôi sao", icon: Star },
  { key: "moon", label: "Mặt trăng", icon: Moon },
  { key: "book", label: "Quyển sách", icon: BookOpen },
  { key: "sparkles", label: "Lấp lánh", icon: Sparkles },
  { key: "leaf", label: "Chiếc lá", icon: Leaf },
];

export function UserAvatarGlyph({
  avatarKey,
  size = 28,
}: {
  avatarKey: UserAvatarKey;
  size?: number;
}) {
  const Icon =
    avatarOptions.find((option) => option.key === avatarKey)?.icon ??
    Cloud;

  return <Icon aria-hidden="true" size={size} strokeWidth={2.4} />;
}
