import {Config} from '../constants/config';
import {useAuthStore} from '../../store/authStore';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const state = useAuthStore.getState();
  const refreshToken = state.tokens?.refreshToken;
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${Config.API.BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({refreshToken}),
    });
    const data = await res.json();
    if (data.success && data.data?.accessToken) {
      const newTokens = {
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken || refreshToken,
        expiresAt: Date.now() + 15 * 60 * 1000,
      };
      state.setTokens(newTokens);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function handleAuthFailure() {
  useAuthStore.getState().logout();
}

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  _retry?: boolean;
}

async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const state = useAuthStore.getState();
  const token = state.tokens?.accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body && options.method !== 'GET') {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(`${Config.API.BASE_URL}${endpoint}`, fetchOptions);
  } catch (networkError) {
    throw {success: false, error: {code: 'NETWORK_ERROR', message: 'Network unavailable. Check your connection.'}};
  }

  if (res.status === 401 && !options._retry) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken();
    }
    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      return request<T>(endpoint, {...options, _retry: true});
    } else {
      handleAuthFailure();
      throw {success: false, error: {code: 'SESSION_EXPIRED', message: 'Session expired. Please login again.'}};
    }
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw {success: false, error: {code: 'PARSE_ERROR', message: 'Invalid server response.'}};
  }

  if (!res.ok) {
    throw data;
  }

  return data as T;
}

export const apiClient = {
  get: <T = any>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, {method: 'GET', headers}),

  post: <T = any>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {method: 'POST', body, headers}),

  put: <T = any>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {method: 'PUT', body, headers}),

  delete: <T = any>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, {method: 'DELETE', headers}),
};
