import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@services/authService';
import { homeFor, useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { FullScreenLoader } from '@components/layout/Guards';

/** Recebe o token do backend (no fragmento da URL, que não vai para logs de servidor). */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const toast = useToast();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    const error = params.get('error');
    window.history.replaceState(null, '', window.location.pathname);

    if (!token) {
      navigate(`/entrar?erro=${error ?? 'google_failed'}`, { replace: true });
      return;
    }
    authService.storeGoogleToken(token);
    refresh().then((user) => {
      if (!user) {
        navigate('/entrar?erro=google_failed', { replace: true });
        return;
      }
      toast.success(`Bem-vindo(a), ${user.name.split(' ')[0]}!`);
      if (!user.profile_complete && user.role !== 'admin') {
        toast.info('Complete seu cadastro', 'Informe CPF/CNPJ, telefone, cidade e estado para anunciar e comprar.');
        navigate('/perfil?completar=1', { replace: true });
      } else {
        navigate(homeFor(user), { replace: true });
      }
    });
  }, [navigate, refresh, toast]);

  return <FullScreenLoader />;
}
