import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Shield, ShoppingCart, Store, Zap } from 'lucide-react';
import { ApiError, errorMessage } from '@services/api';
import { publicService } from '@services/publicService';
import type { PublicConfig } from '@services/types';
import { homeFor, useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { AuthLayout, Divider, GoogleButton } from '@components/layout/AuthLayout';
import { Button } from '@components/ui/Button';
import { Checkbox, Input, PasswordInput } from '@components/ui/Field';

const DEMO_STYLE: Record<string, { icon: typeof Shield; color: string }> = {
  admin: { icon: Shield, color: 'from-terra to-[#6b4428]' },
  seller: { icon: Store, color: 'from-folha to-pasto' },
  buyer: { icon: ShoppingCart, color: 'from-trigo to-trigo-dark' },
};

const GOOGLE_ERRORS: Record<string, string> = {
  google_failed: 'Não foi possível entrar com o Google. Tente novamente.',
  google_disabled: 'O login com Google ainda não foi configurado nesta plataforma.',
  blocked: 'Sua conta está bloqueada. Fale com o suporte da plataforma.',
};

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [filledKey, setFilledKey] = useState(0);

  useEffect(() => {
    publicService.config().then(setConfig).catch(() => setConfig(null));
    const params = new URLSearchParams(location.search);
    const err = params.get('erro');
    if (err) setError(GOOGLE_ERRORS[err] ?? GOOGLE_ERRORS.google_failed);
  }, [location.search]);

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setError(null);
    setEmail('');
    setPassword('');
    // Preenchimento animado, caractere a caractere
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setEmail(demoEmail.slice(0, i));
      if (i >= demoEmail.length) {
        window.clearInterval(id);
        setPassword(demoPassword);
        setFilledKey((k) => k + 1);
      }
    }, 18);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email.trim(), password, remember);
      toast.success(`Bem-vindo(a), ${user.name.split(' ')[0]}!`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(user.must_change_password ? '/trocar-senha' : from && user.role !== 'admin' ? from : homeFor(user), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 422 ? err.field('email') ?? err.message : errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const demo = config?.demo_login_enabled ? config.demo_accounts : [];

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse sua conta para anunciar e comprar."
      below={
        demo.length > 0 && (
          <div className="glass-dark animate-fade-up rounded-3xl p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Zap className="h-4 w-4 text-trigo" aria-hidden /> Acesso rápido (demonstração)
            </p>
            <p className="mt-1 text-xs text-white/75">Clique em um perfil para preencher e-mail e senha automaticamente.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {demo.map((acc) => {
                const style = DEMO_STYLE[acc.role] ?? DEMO_STYLE.buyer;
                const Icon = style.icon;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc.email, acc.password)}
                    className="group flex items-center gap-3 rounded-2xl bg-white/90 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg sm:flex-col sm:text-center"
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${style.color} text-white shadow-sm`}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-grafite">{acc.label}</span>
                      <span className="block truncate text-[11px] text-grafite/60">{acc.email}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )
      }
    >
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          key={`email-${filledKey}`}
          label="E-mail"
          type="email"
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={filledKey ? 'animate-fill' : ''}
        />
        <PasswordInput
          key={`pass-${filledKey}`}
          label="Senha"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={filledKey ? 'animate-fill' : ''}
        />
        <div className="flex items-center justify-between gap-3">
          <Checkbox label="Lembrar de mim" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link to="/esqueci-senha" className="text-sm font-semibold text-pasto hover:text-folha">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" block size="lg" loading={loading} disabled={!email || !password}>
          Entrar
        </Button>
      </form>
      {config?.google_enabled !== false && (
        <>
          <Divider />
          <GoogleButton />
        </>
      )}
      <p className="mt-6 text-center text-sm text-grafite/75">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-semibold text-pasto hover:text-folha">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
}
