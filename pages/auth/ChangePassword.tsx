import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@services/authService';
import { ApiError, errorMessage } from '@services/api';
import { homeFor, useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { AuthLayout } from '@components/layout/AuthLayout';
import { Button } from '@components/ui/Button';
import { PasswordInput } from '@components/ui/Field';

/** Troca obrigatória após o administrador definir uma senha provisória (RF28). */
export default function ChangePassword() {
  const { setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (password.length < 6) errs.password = 'A senha precisa ter pelo menos 6 caracteres.';
    if (password !== confirmation) errs.password_confirmation = 'As senhas não conferem.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const res = await authService.changePassword({ password, password_confirmation: confirmation });
      setUser(res.data);
      toast.success('Senha alterada com sucesso!');
      navigate(homeFor(res.data), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
      } else {
        toast.error('Não foi possível alterar a senha', errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Crie uma nova senha" subtitle="Você entrou com uma senha provisória. Por segurança, escolha uma nova senha para continuar.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <PasswordInput label="Nova senha" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Mínimo de 6 caracteres" required />
        <PasswordInput label="Confirme a nova senha" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} error={errors.password_confirmation} required />
        <Button type="submit" block size="lg" loading={loading}>Salvar nova senha</Button>
        <Button variant="ghost" block onClick={async () => { await logout(); navigate('/entrar'); }}>Sair</Button>
      </form>
    </AuthLayout>
  );
}
