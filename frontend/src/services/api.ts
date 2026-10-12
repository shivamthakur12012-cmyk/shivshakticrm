import axios from 'axios';
import { useAuthStore, setCachedSubscriptionExpired } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // critical for cookie exchange
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach JWT & Active Organization ID
api.interceptors.request.use(
  (config) => {
    const { token, activeOrganizationId, organizations } = useAuthStore.getState();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    const validOrgId = (activeOrganizationId && activeOrganizationId !== 'pcs-org' && activeOrganizationId !== 'undefined' && activeOrganizationId !== 'null')
      ? activeOrganizationId
      : (organizations && organizations.length > 0 && organizations[0]?.id && organizations[0].id !== 'pcs-org' ? organizations[0].id : null);

    if (validOrgId) {
      config.headers['x-organization-id'] = validOrgId;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto Refresh Token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if the request is an authentication request
    const isAuthRequest = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register');
    
    // Check if error is 401, we haven't retried yet, and it is not an auth request
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        const newToken = data.data.token;
        
        // Update store with new token
        useAuthStore.getState().setToken(newToken);
        
        // Re-run original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, log out user
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    // Check if error is due to expired or suspended subscription
    const errorCode = error.response?.data?.errorCode;
    const isSuspendedOrExpired = 
      error.response?.status === 402 || 
      errorCode === 'SUBSCRIPTION_SUSPENDED' || 
      errorCode === 'ORGANIZATION_SUSPENDED' || 
      errorCode === 'SUBSCRIPTION_EXPIRED' ||
      errorCode === 'SUBSCRIPTION_CANCELLED';

    const currentUser = useAuthStore.getState().user;
    const activeOrgId = useAuthStore.getState().activeOrganizationId;
    const isSuperAdmin = currentUser?.email === 'shivamthakur12012@gmail.com';

    if (isSuspendedOrExpired && !isSuperAdmin) {
      if (activeOrgId) {
        setCachedSubscriptionExpired(activeOrgId, true);
      }
      if (
        typeof window !== 'undefined' && 
        !window.location.pathname.includes('/subscription') && 
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/super-admin')
      ) {
        window.location.href = '/subscription';
      }
    }
    
    return Promise.reject(error);
  }
);
