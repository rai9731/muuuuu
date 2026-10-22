import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adminService, type PlatformSettings } from '@services/adminService';
import { publicService } from '@services/publicService';
import { errorMessage } from '@services/api';
import type { Breed, PaymentMethod } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { useToast } from '@hooks/useToast';
import { Button } from '@components/ui/Button';
import { ErrorState, GlassCard, PageHeader, Skeleton } from '@components/ui/Display';
import { Checkbox, Input, Textarea, Toggle } from '@components/ui/Field';
import { PAYMENT_METHODS } from '@utils/constants';

const LANDING_FIELDS: [string, string][] = [
  ['hero_title', 'Título da página inicial'], ['hero_subtitle', 'Subtítulo'], ['cta_title', 'Chamada final'], ['cta_subtitle', 'Subtítulo da chamada final'],
  ['contact_email', 'E-mail de contato'], ['contact_phone', 'Telefone'], ['contact_address', 'Endereço'],
];

export default function AdminSettings() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => adminService.settings(), []);
  const [form, setForm] = useState<Omit<PlatformSettings, 'breeds'> | null>(null);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [newBreed, setNewBreed] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const { breeds: b, ...rest } = data;
    setForm({ ...rest, landing: { ...rest.landing } });
    setBreeds(b);
  }, [data]);

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;
  if (loading || !form) return <Skeleton className="h-64" />;

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminService.updateSettings(form);
      toast.success(res.message);
    } catch (err) {
      toast.error('Não foi possível salvar', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePayment = (m: PaymentMethod, on: boolean) =>
    setForm({ ...form, payment_methods: on ? [...form.payment_methods, m] : form.payment_methods.filter((x) => x !== m) });

  const breedAction = async (fn: () => Promise<{ message: string }>) => {
    try {
      toast.success((await fn()).message);
      publicService.clearBreedsCache();
      setNewBreed('');
      reload();
    } catch (err) {
      toast.error('Não foi possível concluir', errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Comissão, pagamentos, textos do site e raças." actions={<Button loading={saving} onClick={save}>Salvar alterações</Button>} />

      <GlassCard>
        <h2 className="mb-3 font-bold">Plataforma</h2>
        <Input label="Comissão da plataforma (%)" type="number" min={0} max={50} step="0.5" value={form.commission_percent}
          onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })} wrapperClassName="max-w-xs" hint="Aplicada a novos pedidos." />
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Formas de pagamento aceitas</p>
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
            <Checkbox key={m} label={PAYMENT_METHODS[m]} checked={form.payment_methods.includes(m)} onChange={(e) => togglePayment(m, e.target.checked)} />
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="mb-3 font-bold">Textos da página inicial</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {LANDING_FIELDS.map(([key, label]) => (
            <Input key={key} label={label} value={(form.landing as unknown as Record<string, string>)[key] ?? ''}
              onChange={(e) => setForm({ ...form, landing: { ...form.landing, [key]: e.target.value } })} />
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Depoimentos</h2>
          <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ ...form, testimonials: [...form.testimonials, { name: '', role: '', city: '', text: '' }] })}>Adicionar</Button>
        </div>
        <div className="space-y-4">
          {form.testimonials.map((t, i) => {
            const patch = (p: Partial<typeof t>) => setForm({ ...form, testimonials: form.testimonials.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="grid gap-3 rounded-xl border border-pasto/10 p-3 sm:grid-cols-3">
                <Input label="Nome" value={t.name} onChange={(e) => patch({ name: e.target.value })} />
                <Input label="Perfil" value={t.role} onChange={(e) => patch({ role: e.target.value })} />
                <Input label="Cidade" value={t.city} onChange={(e) => patch({ city: e.target.value })} />
                <Textarea wrapperClassName="sm:col-span-3" label="Depoimento" value={t.text} onChange={(e) => patch({ text: e.target.value })} />
                <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setForm({ ...form, testimonials: form.testimonials.filter((_, j) => j !== i) })}>Remover</Button>
              </div>
            );
          })}
          {!form.testimonials.length && <p className="text-sm text-grafite/60">Nenhum depoimento cadastrado.</p>}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="mb-3 font-bold">Raças</h2>
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newBreed.trim()) void breedAction(() => adminService.createBreed(newBreed.trim()).then((r) => r)); }}>
          <Input placeholder="Nova raça" value={newBreed} onChange={(e) => setNewBreed(e.target.value)} wrapperClassName="flex-1" />
          <Button type="submit" icon={<Plus className="h-4 w-4" />}>Adicionar</Button>
        </form>
        <div className="divide-y divide-pasto/10">
          {breeds.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3">
              <div className="flex-1"><Toggle label={b.name} description={`${b.cows_count ?? 0} anúncio(s)`} checked={b.active ?? true}
                onChange={(v) => breedAction(() => adminService.updateBreed(b.id, { active: v }))} /></div>
              <Button size="sm" variant="ghost" aria-label={`Excluir ${b.name}`} icon={<Trash2 className="h-4 w-4" />} onClick={() => breedAction(() => adminService.deleteBreed(b.id))} />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
