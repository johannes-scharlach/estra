import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";

const projectToken = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;
const missingVariable = !projectToken
  ? "POSTHOG_PROJECT_TOKEN"
  : !host
    ? "POSTHOG_HOST"
    : null;

if (missingVariable && process.env.NODE_ENV !== "production") {
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  );
}

const posthogLogRecordProcessor =
  projectToken && host
    ? new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host.replace(/\/$/, "")}/i/v1/logs`,
          headers: { Authorization: `Bearer ${projectToken}` },
        }),
      })
    : null;

const telemetrySdk = posthogLogRecordProcessor
  ? new NodeSDK({
      resource: resourceFromAttributes({ "service.name": "estra-api" }),
      logRecordProcessors: [posthogLogRecordProcessor],
    })
  : null;

telemetrySdk?.start();

export async function shutdownTelemetry(): Promise<void> {
  await telemetrySdk?.shutdown();
}
