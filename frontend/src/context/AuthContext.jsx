import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function readIdentity() {
  try { return JSON.parse(localStorage.getItem('proxyhub_identity') || 'null'); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [token,    setToken]    = useState(() => localStorage.getItem('proxyhub_token'));
  const [identity, setIdentity] = useState(() => readIdentity());

  const login = (token, { serverName, adminName }) => {
    setToken(token);
    const id = { serverName, adminName };
    setIdentity(id);
    localStorage.setItem('proxyhub_token',    token);
    localStorage.setItem('proxyhub_identity', JSON.stringify(id));
  };

  const logout = () => {
    setToken(null);
    setIdentity(null);
    localStorage.removeItem('proxyhub_token');
    localStorage.removeItem('proxyhub_identity');
  };

  return (
    <AuthContext.Provider value={{
      token,
      isLoggedIn:  !!token,
      serverName:  identity?.serverName || 'ProxyHub',
      adminName:   identity?.adminName  || 'Admin',
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
