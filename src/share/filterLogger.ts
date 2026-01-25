import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { sensitiveDataRegexReplacements } from '../constants/sensitiveDataRegexReplacements.js';

export class FilterLogger extends AnsiLogger {
  constructor(readonly delegate: AnsiLogger) {
    super({
      extLog: delegate,
      logTimestampFormat: delegate.logTimestampFormat,
      logCustomTimestampFormat: delegate.logCustomTimestampFormat,
    });
  }

  public override get logLevel(): LogLevel {
    return this.delegate.logLevel;
  }
  public override set logLevel(logLevel: LogLevel) {
    this.delegate.logLevel = logLevel;
  }

  public override get logName(): string {
    return this.delegate.logName;
  }
  public override set logName(logName: string) {
    this.delegate.logName = logName;
  }

  public override log(level: LogLevel, message: string, ...parameters: unknown[]): void {
    // Filter the log message and parameters
    const filteredMessage = this.filterSensitive(message);
    const filteredParameters = parameters.map((p) => this.filterSensitive(p));

    // Call the delegate directly (not super.log) to avoid double-logging
    this.delegate.log(level, filteredMessage, ...filteredParameters);
  }

  private filterSensitive<T>(value: T): string | T {
    const str = String(value);
    const filtered = this.filterString(str);
    let jsonFiltered = str;
    try {
      jsonFiltered = this.filterString(JSON.stringify(value));
    } catch {
      /* empty */
    }
    const redacted = filtered !== str || jsonFiltered !== JSON.stringify(value);
    return redacted ? filtered : value;
  }

  private filterString(value: string): string {
    let filtered = value;
    for (const [pattern, replacement] of Object.entries(sensitiveDataRegexReplacements)) {
      const regex = new RegExp(pattern, 'g');
      filtered = filtered.replace(regex, replacement);
    }
    return filtered;
  }
}
