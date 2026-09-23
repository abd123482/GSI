'use client';

import { useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL } from '@/lib/api';

/**
 * Reusable hook providing an Axios client that automatically fetches and
 * attaches the current Clerk session Bearer token for NestJS API requests.
 */
export function useApi(): AxiosInstance {
  const { getToken, isSignedIn } = useAuth();

  const api = useMemo(() => {
    const client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    client.interceptors.request.use(
      async (config) => {
        if (isSignedIn) {
          try {
            const token = await getToken();
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          } catch (err) {
            console.error('[useApi] Error acquiring Clerk session token:', err);
            return Promise.reject(err);
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    return client;
  }, [getToken, isSignedIn]);

  return api;
}
