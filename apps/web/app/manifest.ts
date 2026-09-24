import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vector Privé",
    short_name: "Vector Privé",
    description: "Your private lifestyle office for travel, dining and life in motion.",
    start_url: "/",
    display: "standalone",
    background_color: "#142c25",
    theme_color: "#142c25",
    icons: [
      { src: "/images/vector-prive-vp-icon.png", sizes: "1254x1254", type: "image/png", purpose: "any" },
      { src: "/images/vector-prive-vp-icon.png", sizes: "1254x1254", type: "image/png", purpose: "maskable" },
    ],
  };
}
