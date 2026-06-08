import type { LoggerService } from '@nestjs/common';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

const SCOPE = '@lingua/observability';

export class OtelLoggerService implements LoggerService {
  private readonly otel = logs.getLogger(SCOPE);

  private emit(
    severityNumber: SeverityNumber,
    severityText: string,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const context = optionalParams
      .filter((p): p is string => typeof p === 'string')
      .pop();
    const stack = optionalParams.find(
      (p) => p instanceof Error || (typeof p === 'string' && p !== context),
    );
    const body =
      typeof message === 'string' ? message : JSON.stringify(message);

    this.otel.emit({
      severityNumber,
      severityText,
      body,
      attributes: {
        ...(context ? { 'code.namespace': context } : {}),
        ...(stack ? { 'exception.stacktrace': String(stack) } : {}),
      },
    });

    const prefix = context ? `[${context}] ` : '';
    const line = `${severityText} ${prefix}${body}`;
    if (severityNumber >= SeverityNumber.ERROR) console.error(line);
    else if (severityNumber >= SeverityNumber.WARN) console.warn(line);
    else console.log(line);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(SeverityNumber.INFO, 'INFO', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(SeverityNumber.ERROR, 'ERROR', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(SeverityNumber.WARN, 'WARN', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(SeverityNumber.DEBUG, 'DEBUG', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(SeverityNumber.TRACE, 'TRACE', message, optionalParams);
  }
}

export function createOtelLogger(): OtelLoggerService {
  return new OtelLoggerService();
}
