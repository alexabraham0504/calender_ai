/**
 * API Client with Comprehensive Logging
 * Wraps fetch calls with automatic logging of requests and responses
 */

import { logger } from './logger';

interface RequestOptions extends RequestInit {
    skipLogging?: boolean;
}

class APIClient {
    private baseURL: string;

    constructor(baseURL: string = 'http://localhost:5000') {
        this.baseURL = baseURL;
        logger.info(`API Client initialized with base URL: ${baseURL}`);
    }

    private async request<T>(
        method: string,
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        const startTime = performance.now();

        const { skipLogging, ...fetchOptions } = options;

        if (!skipLogging) {
            logger.separator();
            logger.api(method, endpoint);
            if (fetchOptions.body) {
                logger.debug('Request body:', JSON.parse(fetchOptions.body as string));
            }
            if (fetchOptions.headers) {
                const headers = { ...fetchOptions.headers } as any;
                if (headers.Authorization) {
                    headers.Authorization = 'Bearer [REDACTED]';
                }
                logger.debug('Request headers:', headers);
            }
        }

        try {
            const response = await fetch(url, {
                method,
                ...fetchOptions,
                headers: {
                    'Content-Type': 'application/json',
                    ...fetchOptions.headers,
                },
            });

            const duration = Math.round(performance.now() - startTime);
            const data = await response.json();

            if (!skipLogging) {
                logger.api(method, endpoint, response.status, duration);

                if (response.ok) {
                    logger.success(`Request successful (${response.status})`, data);
                } else {
                    logger.error(`Request failed (${response.status})`, data);
                }
                logger.separator();
            }

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            const duration = Math.round(performance.now() - startTime);

            if (!skipLogging) {
                logger.api(method, endpoint, 0, duration);
                logger.error('Request error', error);
                logger.separator();
            }

            throw error;
        }
    }

    async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        return this.request<T>('GET', endpoint, options);
    }

    async post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
        return this.request<T>('POST', endpoint, {
            ...options,
            body: JSON.stringify(body),
        });
    }

    async put<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
        return this.request<T>('PUT', endpoint, {
            ...options,
            body: JSON.stringify(body),
        });
    }

    async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        return this.request<T>('DELETE', endpoint, options);
    }

    setAuthToken(token: string): void {
        logger.info('Auth token set for API client');
    }
}

// Create and export a singleton instance
export const apiClient = new APIClient();

// Helper function to get auth headers
export const getAuthHeaders = (token: string) => {
    return {
        Authorization: `Bearer ${token}`,
    };
};
