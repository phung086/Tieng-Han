import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Haneul — Học tiếng Hàn",
    short_name: "Haneul",
    description: "Ứng dụng ôn luyện tiếng Hàn bám sát giáo trình.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7fb",
    theme_color: "#6658e8",
  };
}
