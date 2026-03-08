import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function RequireCompany({ children }: { children: JSX.Element }) {
  const { user, isLoading, companies, activeCompany } = useAuth();

  if (isLoading) return children;

  if (!user) {
    return <Navigate to='/login' replace />;
  }

  if (!companies || companies.length === 0 || !activeCompany) {
    return <Navigate to='/company-gate' replace />;
  }

  return children;
}