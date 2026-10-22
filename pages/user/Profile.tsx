import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Trash2, Upload } from 'lucide-react';
import { profileService, type PayoutPayload, type ProfilePayload } from '@services/profileService';
import { ApiError, errorMessage } from '@services/api';
import type { User } from '@services/types';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { Button } from '@components/ui/Button';
import { ConfirmDialog } from '@components/ui/ConfirmDialog';
import { Avatar, GlassCard, PageHeader } from '@components/ui/Display';
import { Input, PasswordInput, Select, Textarea, Toggle } from '@components/ui/Field';
import { UFS, USER_NOTIFICATION_PREFERENCES } from '@utils/constants';
import { isValidDocument, maskDocument, maskPhone } from '@utils/validators';

const PIX_TYPES = [
  { value: 'cpf', label: 'CPF' }, { value: 'cnpj', label: 'CNPJ' }, { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' }, { value: 'random', label: 'Chave aleatória' },
];

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { hash, search } = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfilePayload>({
    name: user?.name ?? '', document: user?.document ?? '', phone: user?.phone ?? '', city: user?.city ?? '',
    state: user?.state ?? '', farm_name: user?.farm_name ?? '', farm_description: user?.farm_description ?? '',
  });
  const [payout, setPayout] = useState<PayoutPayload>({
    payout_pix_key_type: user?.payout_pix_key_type ?? 'cpf', payout_pix_key: user?.payout_pix_key ?? '',
    bank: user?.payout_bank?.bank ?? '', agency: user?.payout_bank?.agency ?? '', account: user?.payout_bank?.account ?? '',
    account_type: user?.payout_bank?.account_type ?? 'corrente', holder: user?.payout_bank?.holder ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  if (!user) return null;
  const set = <K extends keyof ProfilePayload>(k: K, v: ProfilePayload[K]) => setForm((f) => ({ ...f, [k]: v }));

  const run = async (key: string, action: () => Promise<{ data: User; message: string }>) => {
    setSaving(key);
    setErrors({});
    try {
      const res = await action();
      setUser(res.data);
      toast.success(res.message);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.errors).length) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
      }
      toast.error('Não foi possível salvar', errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidDocument(form.document)) return setErrors({ document: 'Informe um CPF ou CNPJ válido.' });
    void run('profile', () => profileService.update(form));
  };

  const savePayout = (e: FormEvent) => {
    e.preventDefault();
    void run('payout', () => profileService.updatePayout(payout));
  };

  const togglePref = (key: string, value: boolean) =>
    run('prefs', () => profileService.updatePreferences({ ...user.notification_preferences, [key]: value }));

  const onAvatar = (file?: File) => file && run('avatar', () => profileService.uploadAvatar(file));

  const removeAccount = async () => {
    try {
      await profileService.deleteAccount(password);
      toast.success('Conta excluída.');
      await logout();
      navigate('/');
    } catch (err) {
      toast.error('Não foi possível excluir a conta', errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" description="Seus dados, recebimentos e preferências." />
      {search.includes('completar') && !user.profile_complete && (
        <GlassCard className="border-l-4 border-l-trigo text-sm">Complete CPF/CNPJ, telefone e cidade para poder comprar.</GlassCard>
      )}

      <GlassCard>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={user.name} src={user.avatar_url} size="xl" />
          <div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onAvatar(e.target.files?.[0])} />
            <Button variant="outline" size="sm" icon={<Upload className="h-4 w-4" />} loading={saving === 'avatar'} onClick={() => fileRef.current?.click()}>
              Trocar foto
            </Button>
            <p className="mt-1 text-xs text-grafite/60">{user.email}</p>
          </div>
        </div>
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} required />
          <Input label="CPF/CNPJ" value={form.document} onChange={(e) => set('document', maskDocument(e.target.value))} error={errors.document} required />
          <Input label="Telefone" value={form.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} error={errors.phone} required />
          <Input label="Cidade" value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} required />
          <Select label="Estado" value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="Selecione" options={UFS.map((u) => ({ value: u, label: u }))} error={errors.state} required />
          <Input label="Nome da fazenda" value={form.farm_name} onChange={(e) => set('farm_name', e.target.value)} error={errors.farm_name} />
          <Textarea wrapperClassName="sm:col-span-2" label="Sobre a fazenda" value={form.farm_description} onChange={(e) => set('farm_description', e.target.value)} error={errors.farm_description} />
          <div className="sm:col-span-2"><Button type="submit" loading={saving === 'profile'}>Salvar dados</Button></div>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 id="recebimento" className="mb-1 scroll-mt-24 text-lg font-bold">Dados de recebimento</h2>
        <p className="mb-4 text-sm text-grafite/70">Usados para repassar o valor das suas vendas. Informe uma chave Pix ou a conta bancária.</p>
        <form onSubmit={savePayout} className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo da chave Pix" value={payout.payout_pix_key_type} onChange={(e) => setPayout({ ...payout, payout_pix_key_type: e.target.value })} options={PIX_TYPES} />
          <Input label="Chave Pix" value={payout.payout_pix_key} onChange={(e) => setPayout({ ...payout, payout_pix_key: e.target.value })} error={errors.payout_pix_key} />
          <Input label="Banco" value={payout.bank} onChange={(e) => setPayout({ ...payout, bank: e.target.value })} />
          <Input label="Titular" value={payout.holder} onChange={(e) => setPayout({ ...payout, holder: e.target.value })} />
          <Input label="Agência" value={payout.agency} onChange={(e) => setPayout({ ...payout, agency: e.target.value })} />
          <Input label="Conta" value={payout.account} onChange={(e) => setPayout({ ...payout, account: e.target.value })} />
          <Select label="Tipo de conta" value={payout.account_type} onChange={(e) => setPayout({ ...payout, account_type: e.target.value })} options={[{ value: 'corrente', label: 'Corrente' }, { value: 'poupanca', label: 'Poupança' }]} />
          <div className="sm:col-span-2"><Button type="submit" loading={saving === 'payout'}>Salvar recebimento</Button></div>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="mb-2 text-lg font-bold">Notificações</h2>
        <div className="divide-y divide-pasto/10">
          {USER_NOTIFICATION_PREFERENCES.map((p) => (
            <Toggle key={p.key} label={p.label} description={p.description} checked={user.notification_preferences[p.key] ?? true} onChange={(v) => togglePref(p.key, v)} disabled={saving === 'prefs'} />
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="mb-1 text-lg font-bold">Privacidade (LGPD)</h2>
        <p className="mb-4 text-sm text-grafite/70">Baixe uma cópia dos seus dados ou exclua sua conta. Seus dados pessoais serão anonimizados.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => profileService.exportData().catch((e) => toast.error('Falha ao exportar', errorMessage(e)))}>Baixar meus dados</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleting(true)}>Excluir minha conta</Button>
        </div>
      </GlassCard>

      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={removeAccount} tone="danger" confirmLabel="Excluir definitivamente" title="Excluir sua conta?" description="Esta ação não pode ser desfeita." confirmDisabled={user.has_password && !password}>
        {user.has_password && <PasswordInput label="Confirme sua senha" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </ConfirmDialog>
    </div>
  );
}
