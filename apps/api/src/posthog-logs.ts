import { logs } from "@opentelemetry/api-logs";

type LogAttributes = Record<string, boolean | number | string>;

const logger = logs.getLogger("magpie-api-posthog-exporter");

export const posthogApiLogger = {
  info(body: string, attributes: LogAttributes) {
    logger.emit({ severityText: "INFO", body, attributes });
  },
  warn(body: string, attributes: LogAttributes) {
    logger.emit({ severityText: "WARN", body, attributes });
  },
};
