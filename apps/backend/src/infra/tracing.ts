import { SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";

const tracer = trace.getTracer("cv-tool-backend");

export function getTracer() {
  return tracer;
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(error),
        });
      }
      throw error;
    } finally {
      span.end();
    }
  });
}
