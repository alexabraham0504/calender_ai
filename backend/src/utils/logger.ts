/**
 * Custom Logger Utility for Backend
 * Provides comprehensive logging with timestamps, colors, and different log levels
 */

enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    SUCCESS = 'SUCCESS',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
};

class Logger {
    private getTimestamp(): string {
        const now = new Date();
        return now.toISOString();
    }

    private formatMessage(level: LogLevel, message: string, data?: any): string {
        const timestamp = this.getTimestamp();
        let coloredLevel = '';

        switch (level) {
            case LogLevel.DEBUG:
                coloredLevel = `${colors.cyan}${level}${colors.reset}`;
                break;
            case LogLevel.INFO:
                coloredLevel = `${colors.blue}${level}${colors.reset}`;
                break;
            case LogLevel.SUCCESS:
                coloredLevel = `${colors.green}${level}${colors.reset}`;
                break;
            case LogLevel.WARN:
                coloredLevel = `${colors.yellow}${level}${colors.reset}`;
                break;
            case LogLevel.ERROR:
                coloredLevel = `${colors.red}${colors.bright}${level}${colors.reset}`;
                break;
        }

        let formattedMessage = `[${timestamp}] [${coloredLevel}] ${message}`;

        if (data !== undefined) {
            formattedMessage += `\n${colors.dim}Data: ${JSON.stringify(data, null, 2)}${colors.reset}`;
        }

        return formattedMessage;
    }

    debug(message: string, data?: any): void {
        console.log(this.formatMessage(LogLevel.DEBUG, message, data));
    }

    info(message: string, data?: any): void {
        console.log(this.formatMessage(LogLevel.INFO, message, data));
    }

    success(message: string, data?: any): void {
        console.log(this.formatMessage(LogLevel.SUCCESS, message, data));
    }

    warn(message: string, data?: any): void {
        console.warn(this.formatMessage(LogLevel.WARN, message, data));
    }

    error(message: string, error?: any): void {
        const errorData = error instanceof Error 
            ? { message: error.message, stack: error.stack }
            : error;
        console.error(this.formatMessage(LogLevel.ERROR, message, errorData));
    }

    // Special method for HTTP requests
    http(method: string, url: string, statusCode?: number, duration?: number): void {
        const message = `${method} ${url}${statusCode ? ` - ${statusCode}` : ''}${duration ? ` (${duration}ms)` : ''}`;
        const level = statusCode && statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
        console.log(this.formatMessage(level, message));
    }

    // Separator for visual clarity
    separator(): void {
        console.log(`${colors.dim}${'='.repeat(80)}${colors.reset}`);
    }

    // Section header
    section(title: string): void {
        console.log(`\n${colors.bright}${colors.cyan}╔${'═'.repeat(title.length + 2)}╗${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}║ ${title} ║${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}╚${'═'.repeat(title.length + 2)}╝${colors.reset}\n`);
    }
}

export const logger = new Logger();
