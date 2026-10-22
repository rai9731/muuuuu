import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, errorMessage } from '@services/api';
import { publicService } from '@services/publicService';
import type { RegisterPayload } from '@services/authService';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { AuthLayout, Divider, GoogleButton } from '@components/layout/AuthLayout';
import { Button } from '@components/ui/Button';
import { Checkbox, Input, PasswordInput, Select } from '@components/ui/Field';
import { UFS } from '@utils/constants';
import { isValidDocument, isValidEmail, maskDocument, maskPhone, onlyDigits } from '@utils/validators';

const EMPTY: RegisterPayload = {
  name: '', document: '', email: '', phone: '', city: '', state: '', farm_name: '',
  password: '', password_confirmation: '', terms: false,
};

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterPayload>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(true);

  useEffect(() => {
    publicService.config().then((c) => setGoogleEnabled(c.google_enabled)).catch(() => undefined);
  }, []);

  const set = <K extends keyof RegisterPayload>(key: K, value: RegisterPayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (form.name.trim().split(/\s+/).length < 2) e.name = 'Informe seu nome completo.';
    if (!isValidDocument(form.document)) e.document = 'CPF ou CNPJ inválido.';
    if (!isValidEmail(form.email)) e.email = 'Informe um e-mail válido.';
    if (onlyDigits(form.phone).length < 10) e.phone = 'Informe um telefone com DDD.';
    if (!form.city.trim()) e.city = 'Informe a cidade.';
    if (!form.state) e.state = 'Selecione o estado.';
    if (form.password.length < 6) e.password = 'A senha precisa ter pelo menos 6 caracteres.';
    if (form.password !== form.password_confirmation) e.password_confirmation = 'As senhas não conferem.';
    if (!form.terms) e.terms = 'É preciso aceitar os termos de uso e a política de privacidade.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast.warning('Confira os campos destacados.');
      return;
    }
    setLoading(true);
    try {
      const user = await register(form);
      toast.success('Conta criada com sucesso!', `Bem-vindo(a) ao Boi na Rede, ${user.name.split(' ')[0]}.`);
      navigate('/painel', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
        toast.warning('Confira os campos destacados.');
      } else {
        toast.error('Não foi possível criar sua conta', errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Criar conta" subtitle="Cadastre-se gratuitamente para anunciar e comprar vacas." wide>
      {googleEnabled && (
        <>
          <GoogleButton label="Cadastrar com Google" />
          <Divider label="ou preencha seus dados" />
        </>
      )}
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input label="Nome completo" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} required wrapperClassName="sm:col-span-2" />
        <Input label="CPF ou CNPJ" inputMode="numeric" value={form.document} onChange={(e) => set('document', maskDocument(e.target.value))} error={errors.document} required />
        <Input label="Telefone / WhatsApp" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} error={errors.phone} placeholder="(00) 00000-0000" required />
        <Input label="E-mail" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} required wrapperClassName="sm:col-span-2" />
        <Input label="Cidade" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} required />
        <Select label="Estado" value={form.state} onChange={(e) => set('state', e.target.value)} error={errors.state} placeholder="Selecione" options={UFS.map((uf) => ({ value: uf, label: uf }))} required />
        <Input label="Nome da fazenda / propriedade" value={form.farm_name} onChange={(e) => set('farm_name', e.target.value)} hint="Opcional" wrapperClassName="sm:col-span-2" />
        <PasswordInput label="Senha" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} error={errors.password} hint="Mínimo de 6 caracteres" required />
        <PasswordInput label="Confirmação de senha" autoComplete="new-password" value={form.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} error={errors.password_confirmation} required />
        <Checkbox
          className="sm:col-span-2"
          checked={form.terms}
          onChange={(e) => set('terms', e.target.checked)}
          error={errors.terms}
          label={
            <>
              Li e aceito os{' '}
              <Link to="/termos" target="_blank" className="font-semibold text-pasto underline">termos de uso e a política de privacidade</Link>
              , e autorizo o tratamento dos meus dados pessoais conforme a LGPD.
            </>
          }
        />
        <Button type="submit" size="lg" block loading={loading} className="sm:col-span-2">
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-grafite/75">
        Já tenho conta.{' '}
        <Link to="/entrar" className="font-semibold text-pasto hover:text-folha">Entrar</Link>
      </p>
    </AuthLayout>
  );
}
