import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DebtFree Dashboard",
    short_name: "DebtFree",
    description: "Personal debt accounts and payoff planning dashboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f6fa",
    theme_color: "#132238",
  };
}