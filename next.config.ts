import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^\/audio\/.*\.mp3$/,
        handler: "CacheFirst",
        options: {
          cacheName: "nanamen-audio",
          expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
