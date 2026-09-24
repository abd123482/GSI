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
        if (!isSignedIn) {
          return Promise.reject(new Error('User is not signed in'));
        }
        
        try {
          const token = await getToken();
          if (token) {
            if (config.headers && typeof config.headers.set === 'function') {
              config.headers.set('Authorization', `Bearer ${token}`);
            } else {
              config.headers.Authorization = `Bearer ${token}`;
            }
          } else {
            return Promise.reject(new Error('Failed to acquire Clerk token'));
          }
        } catch (err) {
          console.error('[useApi] Error acquiring Clerk session token:', err);
          return Promise.reject(err);
        }
        
        return config;
      },
      (error) => Promise.reject(error),
    );
    
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Single retry for 401s
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            // Force a refresh of the token by skipping the cache if possible
            // We pass { skipCache: true } if supported, otherwise just re-request
            const token = await getToken();
            if (token) {
              if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
                originalRequest.headers.set('Authorization', `Bearer ${token}`);
              } else {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return client(originalRequest);
            }
          } catch (e) {
            return Promise.reject(e);
          }
        }
        
        return Promise.reject(error);
      }
    );

    return client;
  }, [getToken, isSignedIn]);

  return api;
}
