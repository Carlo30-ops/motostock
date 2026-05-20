// Cliente de autenticación con refresh tokens para el frontend
import axios, { AxiosInstance, AxiosError } from 'axios';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

interface LoginCredentials {
  username: string;
  password: string;
}

class AuthRefreshClient {
  private axiosInstance: AxiosInstance;
  private refreshPromise: Promise<TokenResponse> | null = null;
  private isRefreshing = false;

  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor para añadir token de acceso
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor para manejar refresh de token
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newToken.access_token}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            // Si el refresh falla, redirigir al login
            this.logout();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  private setTokens(tokens: TokenResponse) {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    localStorage.setItem('user', JSON.stringify(tokens.user));
    
    // Configurar auto-refresh antes de que expire el token
    this.scheduleTokenRefresh(tokens.expires_in);
  }

  private scheduleTokenRefresh(expiresIn: number) {
    // Refrescar token 1 minuto antes de que expire
    const refreshTime = (expiresIn - 60) * 1000;
    
    setTimeout(() => {
      this.refreshAccessToken().catch(() => {
        // Si falla el refresh automático, logout
        this.logout();
      });
    }, refreshTime);
  }

  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    try {
      const response = await this.axiosInstance.post<TokenResponse>('/api/auth/token', credentials);
      const tokens = response.data;
      
      this.setTokens(tokens);
      return tokens;
    } catch (error) {
      throw new Error('Credenciales inválidas');
    }
  }

  async refreshAccessToken(): Promise<TokenResponse> {
    // Evitar múltiples refresh simultáneos
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performRefresh();

    try {
      const tokens = await this.refreshPromise;
      this.setTokens(tokens);
      return tokens;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<TokenResponse> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.axiosInstance.post<TokenResponse>('/api/auth/refresh', {
        refresh_token: refreshToken,
      });
      
      return response.data;
    } catch (error) {
      throw new Error('Failed to refresh token');
    }
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    
    if (refreshToken) {
      try {
        // Notificar al servidor que el refresh token fue revocado
        await this.axiosInstance.post('/api/auth/logout', {
          refresh_token: refreshToken,
        });
      } catch (error) {
        // Ignorar error si el servidor no está disponible
        console.warn('Failed to notify server of logout:', error);
      }
    }

    // Limpiar tokens locales
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  async logoutAll(): Promise<void> {
    try {
      await this.axiosInstance.post('/api/auth/logout-all');
    } catch (error) {
      console.warn('Failed to logout from all devices:', error);
    } finally {
      this.logout();
    }
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  }

  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  // Verificar si el token está próximo a expirar
  isTokenExpiringSoon(thresholdMinutes: number = 5): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    try {
      // Decodificar JWT (simplificado)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convertir a milisegundos
      const now = Date.now();
      const threshold = thresholdMinutes * 60 * 1000;
      
      return exp - now < threshold;
    } catch (error) {
      return true; // Si no puede decodificar, considerar como expirado
    }
  }

  // Forzar refresh manual del token
  async forceRefresh(): Promise<TokenResponse> {
    return this.refreshAccessToken();
  }

  // Verificar token actual con el servidor
  async verifyToken(): Promise<boolean> {
    try {
      await this.axiosInstance.post('/api/auth/verify-token', {
        token: this.getAccessToken(),
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Instancia global del cliente de autenticación
export const authClient = new AuthRefreshClient(import.meta.env.VITE_API_URL || 'http://localhost:8000');

// Hook para usar el cliente de autenticación
export function useAuthRefresh() {
  const login = async (credentials: LoginCredentials) => {
    return await authClient.login(credentials);
  };

  const logout = async () => {
    return await authClient.logout();
  };

  const logoutAll = async () => {
    return await authClient.logoutAll();
  };

  const refresh = async () => {
    return await authClient.refreshAccessToken();
  };

  const isAuthenticated = authClient.isAuthenticated();
  const currentUser = authClient.getCurrentUser();
  const isTokenExpiringSoon = authClient.isTokenExpiringSoon();

  return {
    login,
    logout,
    logoutAll,
    refresh,
    isAuthenticated,
    currentUser,
    isTokenExpiringSoon,
    forceRefresh: () => authClient.forceRefresh(),
    verifyToken: () => authClient.verifyToken(),
    axiosInstance: authClient.getAxiosInstance(),
  };
}

// Context provider para React
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: any;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    login: authLogin,
    logout: authLogout,
    logoutAll: authLogoutAll,
    isAuthenticated,
    currentUser,
  } = useAuthRefresh();

  useEffect(() => {
    // Verificar autenticación al cargar
    const checkAuth = async () => {
      try {
        if (isAuthenticated && currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        setError('Error verificando autenticación');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [isAuthenticated, currentUser]);

  const login = async (credentials: LoginCredentials) => {
    try {
      setError(null);
      const tokens = await authLogin(credentials);
      setUser(tokens.user);
    } catch (err) {
      setError('Credenciales inválidas');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authLogout();
      setUser(null);
      setError(null);
    } catch (err) {
      setError('Error al cerrar sesión');
    }
  };

  const logoutAll = async () => {
    try {
      await authLogoutAll();
      setUser(null);
      setError(null);
    } catch (err) {
      setError('Error al cerrar sesión en todos los dispositivos');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        logoutAll,
        isAuthenticated,
        isLoading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
