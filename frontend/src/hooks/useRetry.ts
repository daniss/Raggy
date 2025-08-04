'use client';

import { useState, useCallback } from 'react';

interface UseRetryOptions {
  maxRetries?: number;
  delay?: number;
  onError?: (error: any, attempt: number) => void;
}

interface UseRetryReturn<T> {
  execute: (fn?: () => Promise<T>) => Promise<T>;
  retry: (fn?: () => Promise<T>) => Promise<T>;
  isLoading: boolean;
  isRetrying: boolean;
  error: string | null;
  retryCount: number;
  reset: () => void;
}

export function useRetry<T>(
  asyncFn?: () => Promise<T>,
  options: UseRetryOptions = {}
): UseRetryReturn<T> {
  const { maxRetries = 3, delay = 1000, onError } = options;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const reset = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsLoading(false);
  }, []);

  const execute = useCallback(async (fn?: () => Promise<T>): Promise<T> => {
    const targetFn = fn || asyncFn;
    if (!targetFn) {
      throw new Error('No function provided to execute');
    }

    setIsLoading(true);
    setError(null);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await targetFn();
        setIsLoading(false);
        setRetryCount(attempt);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Une erreur inattendue s\'est produite';
        
        if (onError) {
          onError(err, attempt + 1);
        }

        if (attempt === maxRetries) {
          setError(errorMessage);
          setIsLoading(false);
          setRetryCount(attempt + 1);
          throw err;
        }

        // Wait before retry
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
        }
      }
    }

    throw new Error('Max retries exceeded');
  }, [asyncFn, maxRetries, delay, onError]);

  const retry = execute; // Alias for clarity

  return {
    execute,
    retry,
    isLoading,
    isRetrying: isLoading,
    error,
    retryCount,
    reset
  };
}