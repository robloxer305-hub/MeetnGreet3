import axios from 'axios';
import { API_BASE_URL } from './config.js';

export function createApiClient(getToken) {
  const api = axios.create({
    baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  });

  api.interceptors.request.use((config) => {
    const token = getToken?.();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return api;
}

// Create default API client
export const api = createApiClient(() => localStorage.getItem('token'));
