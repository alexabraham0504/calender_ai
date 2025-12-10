/**
 * Frontend Logger Utility
 * Provides comprehensive console logging with timestamps, colors, and different log levels
 */

enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    SUCCESS = 'SUCCESS',
    WARN = 'WARN',
    ERROR = 'ERROR',
    API = 'API',
}

// Console styling
const styles = {
    debug: 'color: #00bcd4; font-weight: bold',
    info: 'color: #2196f3; font-weight: bold',
    success: 'color: #4caf50; font-weight: bold',
    warn: 'color: #ff9800; font-weight: bold',
    error: 'color: #f44336; font-weight: bold',
    api: 'color: #9c27b0; font-weight: bold',
    timestamp: 'color: #757575; font-size: 0.9em',
    data: 'color: #616161',
    separator: 'color: #e0e0e0',
};

class FrontendLogger {
    private isDevelopment = import.meta.env.DEV;

    private getTimestamp(): string {
        const now = new Date();
        return now.toISOString();
    }

    private formatMessage(level: LogLevel, message: string, data?: any): void {
        if (!this.isDevelopment && level === LogLevel.DEBUG) {
            return; // Skip debug logs in production
        }

        const timestamp = this.getTimestamp();
        let style = '';

        switch (level) {
            case LogLevel.DEBUG:
                style = styles.debug;
                break;
            case LogLevel.INFO:
                style = styles.info;
                break;
            case LogLevel.SUCCESS:
                style = styles.success;
                break;
            case LogLevel.WARN:
                style = styles.warn;
                break;
            case LogLevel.ERROR:
                style = styles.error;
                break;
            case LogLevel.API:
                style = styles.api;
                break;
        }

        console.log(
            `%c[${level}]%c ${timestamp} %c${message}`,
            style,
            styles.timestamp,
            'color: inherit'
        );

        if (data !== undefined) {
            console.log('%cData:', styles.data, data);
        }
    }

    debug(message: string, data?: any): void {
        this.formatMessage(LogLevel.DEBUG, `🔍 ${message}`, data);
    }

    info(message: string, data?: any): void {
        this.formatMessage(LogLevel.INFO, `ℹ️ ${message}`, data);
    }

    success(message: string, data?: any): void {
        this.formatMessage(LogLevel.SUCCESS, `✅ ${message}`, data);
    }

    warn(message: string, data?: any): void {
        this.formatMessage(LogLevel.WARN, `⚠️ ${message}`, data);
    }

    error(message: string, error?: any): void {
        const errorData = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;
        this.formatMessage(LogLevel.ERROR, `❌ ${message}`, errorData);
    }

    // Special method for API calls
    api(method: string, url: string, status?: number, duration?: number, data?: any): void {
        const statusEmoji = status && status >= 400 ? '❌' : '✅';
        const message = `${statusEmoji} ${method} ${url}${status ? ` - ${status}` : ''}${duration ? ` (${duration}ms)` : ''}`;
        this.formatMessage(LogLevel.API, message, data);
    }

    // Separator for visual clarity
    separator(): void {
        console.log('%c' + '='.repeat(80), styles.separator);
    }

    // Section header
    section(title: string): void {
        console.log(`\n%c╔${'═'.repeat(title.length + 2)}╗`, 'color: #00bcd4; font-weight: bold');
        console.log(`%c║ ${title} ║`, 'color: #00bcd4; font-weight: bold');
        console.log(`%c╚${'═'.repeat(title.length + 2)}╝\n`, 'color: #00bcd4; font-weight: bold');
    }

    // Group related logs
    group(title: string, collapsed: boolean = false): void {
        if (collapsed) {
            console.groupCollapsed(`%c${title}`, 'font-weight: bold; color: #2196f3');
        } else {
            console.group(`%c${title}`, 'font-weight: bold; color: #2196f3');
        }
    }

    groupEnd(): void {
        console.groupEnd();
    }

    // Table for structured data
    table(data: any): void {
        console.table(data);
    }

    // Performance timing
    time(label: string): void {
        console.time(label);
    }

    timeEnd(label: string): void {
        console.timeEnd(label);
    }

    // Component lifecycle logging
    componentMount(componentName: string, props?: any): void {
        this.debug(`Component mounted: ${componentName}`, props);
    }

    componentUnmount(componentName: string): void {
        this.debug(`Component unmounted: ${componentName}`);
    }

    // State changes
    stateChange(componentName: string, oldState: any, newState: any): void {
        this.debug(`State changed in ${componentName}`, {
            old: oldState,
            new: newState,
        });
    }

    // User interactions
    userAction(action: string, details?: any): void {
        this.info(`User action: ${action}`, details);
    }
}

export const logger = new FrontendLogger();

// Auto-log unhandled errors
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        logger.error('Unhandled error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled promise rejection', {
            reason: event.reason,
        });
    });
}
