import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import { authService } from '@services/authService';
import { errorMessage } from '@services/api';
import { useToast } from '@hooks/useToast';
import { AuthLayout, Divider, GoogleButton } from '@components/layout/AuthLayout';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Field';
import { isValidEmail } from '@utils/validators';

/**
 * A plataforma não envia e-mails (RN09): a solicitação vira uma notificação para o
 * administrador, que define uma senha provisória pelo painel.
 */
export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error('Não foi possível registrar o pedido', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Recuperar senha" subtitle="Informe o e-mail da sua conta e nossa equipe vai redefinir seu acesso.">
      {sent ? (
        <div className="text-center" role="status">
          <CheckCircle2 className="mx-auto h-12 w-12 text-folha" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">Pedido enviado!</h2>
          <p className="mt-2 text-sm text-grafite/75">
            Se existir uma conta com este e-mail, o administrador vai definir uma <strong>senha provisória</strong> e entrar em contato pelo telefone
            cadastrado. No próximo login você vai escolher uma nova senha.
          </p>
          <Link to="/entrar" className="mt-6 inline-block text-sm font-semibold text-pasto hover:text-folha">Voltar para o login</Link>
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              icon={<Mail className="h-4 w-4" />}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              error={error}
              required
            />
            <Button type="submit" block size="lg" loading={loading}>
              Enviar pedido de redefinição
            </Button>
          </form>
          <div className="mt-5 rounded-2xl bg-palha/50 p-4 text-sm text-grafite/80">
            <strong className="text-grafite">Sua conta está vinculada ao Google?</strong> Você pode entrar agora mesmo, sem precisar de senha.
          </div>
          <Divider />
          <GoogleButton />
          <p className="mt-6 text-center text-sm text-grafite/75">
            Lembrou a senha?{' '}
            <Link to="/entrar" className="font-semibold text-pasto hover:text-folha">Entrar</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
