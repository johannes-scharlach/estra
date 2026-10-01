import { posthog } from "@/lib/posthog";

type LogAttributes = Record<string, boolean | number | string>;

export const posthogLogger = {
  info(body: string, attributes: LogAttributes) {
    posthog?.logger.info(body, attributes);
  },
  warn(body: string, attributes: LogAttributes) {
    posthog?.logger.warn(body, attributes);
  },
};
