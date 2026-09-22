import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  redirects: async () => [
    {
      source: "/dashboard/brouillons",
      destination: "/dashboard",
      permanent: true,
    },
    {
      source: "/dashboard/propositions",
      destination: "/dashboard/suivi-groupes",
      permanent: true,
    },
    {
      source: "/dashboard/roadmap",
      destination: "/dashboard/avancement",
      permanent: true,
    },
    {
      source: "/dashboard/preview",
      destination: "/dashboard/apercu",
      permanent: true,
    },
    {
      source: "/dashboard/missions-regles",
      destination: "/dashboard/regles-missions",
      permanent: true,
    },
    {
      source: "/dashboard/signalements",
      destination: "/dashboard/signaler",
      permanent: true,
    },
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.discordapp.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.discord.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
