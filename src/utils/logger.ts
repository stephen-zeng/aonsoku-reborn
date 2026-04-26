import { isDev } from "./env";

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.debug(`[logger] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.info(`[logger] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[logger] ${message}`, ...args);
  },
};
