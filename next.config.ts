import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Next's development Server Function trace includes raw arguments.
  logging: {
    serverFunctions: false,
    browserToTerminal: false,
  },
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
