import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { api } from '../utils/api';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  verifyPassword: (password: string) => Promise<boolean>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionStr = localStorage.getItem('session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        api.setToken(session.token);
        setUser(session.user);
      } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const { token, user } = await api.login(username, password);
    api.setToken(token);
    localStorage.setItem('session', JSON.stringify({ token, user }));
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('session');
    api.setToken(null);
    setUser(null);
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    try {
      const { reauthToken, expiresInSec } = await api.reauth(password);
      api.setReauthToken(reauthToken, expiresInSec);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      verifyPassword,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
