export class TemplateError extends Error {
  constructor(
    public code: string,
    public status = 400,
    message = "The request could not be completed.",
    public retryable = false,
  ) {
    super(message);
  }
}
export function unavailable(): never {
  throw new TemplateError("SERVICE_UNAVAILABLE", 503, "Template service is temporarily unavailable.", true);
}
export function requireValue<T>(value: T | null | undefined): T {
  if (value == null) unavailable();
  return value;
}
