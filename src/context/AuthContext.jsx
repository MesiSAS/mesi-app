import { createContext, useContext, useState } from 'react';
import { useUsuarios } from '../hooks/useUsuarios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {

  const { updateUsuario } = useUsuarios();

  const [user, setUser] = useState(() => {

    const saved =
      sessionStorage.getItem('mesi_user');

    return saved
      ? JSON.parse(saved)
      : null;
  });

  const login = (userData) => {

    sessionStorage.setItem(
      'mesi_user',
      JSON.stringify(userData)
    );

    setUser(userData);
  };

  const logout = () => {

    sessionStorage.removeItem(
      'mesi_user'
    );

    setUser(null);
  };

  const changePassword = async (
    newPassword
  ) => {

    if (!user) return;

    await updateUsuario(
      user.id,
      {
        password: newPassword
      }
    );

    const updated = {
      ...user,
      password: newPassword,
    };

    sessionStorage.setItem(
      'mesi_user',
      JSON.stringify(updated)
    );

    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () =>
  useContext(AuthContext);