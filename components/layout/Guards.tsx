import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { homeFor, useAuth } from '@hooks/useAuth';

export function FullScreenLoader() {
  return (
    <div className="bg-rural flex min-h-screen items-center justify-center" role="status" aria-label="Carregando">
      <Loader2 className="h-8 w-8 animate-spin text-pasto" />
    </div>
  );
}

/** Exige login. Usuários com senha provisória são levados para a troca de senha. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />;
  if (user.must_change_password && location.pathname !== '/trocar-senha') return <Navigate to="/trocar-senha" replace />;
  return <>{children}</>;
}

/** Exige perfil de administrador; outros perfis recebem acesso negado. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/entrar" replace />;
  if (user.role !== 'admin') return <Navigate to="/acesso-negado" replace />;
  return <>{children}</>;
}

/** Telas de login/cadastro: quem já está logado vai para o seu painel. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}
