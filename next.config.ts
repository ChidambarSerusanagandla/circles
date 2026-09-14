import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  ...(process.env.CIRCLES_CONSTRAINED_BUILD === "true"
    ? {
        experimental: {
          workerThreads: true,
          webpackBuildWorker: false,
          useTypeScriptCli: false,
          cpus: 2,
        },
      }
    : {}),
};
export default config;
