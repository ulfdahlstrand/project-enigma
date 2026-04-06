import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { logger } from "./logger.js";

let telemetryStartup: Promise<void> | null = null;
let sdk: NodeSDK | null = null;

function shouldEnableTelemetry() {
  if (process.env["NODE_ENV"] === "test") {
    return false;
  }

  return process.env["OTEL_ENABLED"] !== "false";
}

function createSpanProcessor() {
  const tracesExporter = process.env["OTEL_TRACES_EXPORTER"]?.toLowerCase();

  if (tracesExporter === "none") {
    return null;
  }

  if (tracesExporter === "console") {
    return new SimpleSpanProcessor(new ConsoleSpanExporter());
  }

  if (
    tracesExporter === "otlp"
    || process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]
    || process.env["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"]
  ) {
    return new SimpleSpanProcessor(new OTLPTraceExporter());
  }

  return null;
}

export async function startTelemetry() {
  if (telemetryStartup) {
    return telemetryStartup;
  }

  telemetryStartup = (async () => {
    if (!shouldEnableTelemetry()) {
      logger.info("OpenTelemetry disabled");
      return;
    }

    if (process.env["OTEL_LOG_LEVEL"] === "debug") {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    const spanProcessor = createSpanProcessor();
    sdk = new NodeSDK({
      serviceName: process.env["OTEL_SERVICE_NAME"] ?? "cv-tool-backend",
      ...(spanProcessor ? { spanProcessor } : {}),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    await sdk.start();

    logger.info("OpenTelemetry initialised", {
      serviceName: process.env["OTEL_SERVICE_NAME"] ?? "cv-tool-backend",
      tracesExporter: process.env["OTEL_TRACES_EXPORTER"] ?? (spanProcessor ? "otlp" : "disabled"),
    });
  })();

  return telemetryStartup;
}

export async function shutdownTelemetry() {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
  telemetryStartup = null;
}
