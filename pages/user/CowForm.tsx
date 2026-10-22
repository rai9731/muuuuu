import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Send, TriangleAlert, X } from 'lucide-react';
import { cowService } from '@services/cowService';
import { publicService } from '@services/publicService';
import { ApiError, errorMessage } from '@services/api';
import type { Breed, CowDetail, Media } from '@services/types';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { Button, LinkButton } from '@components/ui/Button';
import { Badge, GlassCard, PageHeader, Skeleton } from '@components/ui/Display';
import { Dropzone, type DropItem } from '@components/ui/Dropzone';
import { Input, Select, Textarea, Toggle } from '@components/ui/Field';
import { Modal } from '@components/ui/Modal';
import { Stepper } from '@components/ui/Stepper';
import { PURPOSE_LABELS, SEX_LABELS, UFS } from '@utils/constants';
import { formatAge, formatCurrency, formatWeight } from '@utils/format';
import { parseMoney } from '@utils/validators';

const STEPS = ['Dados básicos', 'Saúde', 'Mídia', 'Preço e local', 'Revisão'];
const COMMON_VACCINES = ['Febre aftosa', 'Brucelose', 'Raiva', 'Clostridioses', 'IBR/BVD', 'Leptospirose'];

interface FormState {
  title: string;
  breed_id: string;
  sex: string;
  age_months: string;
  weight_kg: string;
  purpose: string;
  milk_production_liters: string;
  description: string;
  vaccinated: boolean;
  vaccinations: string[];
  is_pregnant: boolean;
  pregnancy_months: string;
  health_history: string;
  price: string;
  city: string;
  state: string;
}

const EMPTY: FormState = {
  title: '', breed_id: '', sex: 'femea', age_months: '', weight_kg: '', purpose: '', milk_production_liters: '', description: '',
  vaccinated: true, vaccinations: [], is_pregnant: false, pregnancy_months: '', health_history: '',
  price: '', city: '', state: '',
};

const fromMedia = (m: Media): DropItem => ({
  key: `m-${m.id}`,
  mediaId: m.id,
  url: m.type === 'photo' ? m.thumb_url ?? m.url : m.url,
  name: m.original_name ?? (m.type === 'photo' ? 'Foto' : m.type === 'video' ? 'Vídeo' : 'Atestado.pdf'),
  size: m.size,
  kind: m.type === 'photo' ? 'image' : m.type === 'video' ? 'video' : m.url.endsWith('.pdf') ? 'pdf' : 'image',
});

export default function CowForm() {
  const { id } = useParams();
  const editing = !!id;
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [photos, setPhotos] = useState<DropItem[]>([]);
  const [video, setVideo] = useState<DropItem[]>([]);
  const [certificates, setCertificates] = useState<DropItem[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [customVaccine, setCustomVaccine] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [original, setOriginal] = useState<CowDetail | null>(null);
  const [maxMb, setMaxMb] = useState(20);

  useEffect(() => {
    publicService.breeds().then(setBreeds).catch(() => toast.error('Não foi possível carregar as raças.'));
    publicService.config().then((c) => setMaxMb(c.upload_max_size_mb)).catch(() => undefined);
  }, [toast]);

  useEffect(() => {
    if (!editing) {
      setForm((f) => ({ ...f, city: user?.city ?? '', state: user?.state ?? '' }));
      return;
    }
    cowService
      .mineShow(id!)
      .then(({ data }) => {
        setOriginal(data);
        setForm({
          title: data.title,
          breed_id: String(data.breed?.id ?? ''),
          sex: data.sex,
          age_months: String(data.age_months),
          weight_kg: String(data.weight_kg),
          purpose: data.purpose,
          milk_production_liters: data.milk_production_liters ? String(data.milk_production_liters) : '',
          description: data.description ?? '',
          vaccinated: data.vaccinated,
          vaccinations: data.vaccinations,
          is_pregnant: data.is_pregnant,
          pregnancy_months: data.pregnancy_months ? String(data.pregnancy_months) : '',
          health_history: data.health_history ?? '',
          price: String(data.price).replace('.', ','),
          city: data.city,
          state: data.state,
        });
        setPhotos(data.photos.map(fromMedia));
        setVideo(data.video ? [fromMedia(data.video)] : []);
        setCertificates(data.certificates.map(fromMedia));
      })
      .catch((err) => {
        toast.error('Não foi possível carregar o anúncio', errorMessage(err));
        navigate('/minhas-vacas');
      })
      .finally(() => setLoading(false));
  }, [editing, id, navigate, toast, user?.city, user?.state]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const removeItem = (setter: (fn: (items: DropItem[]) => DropItem[]) => void) => (item: DropItem) => {
    if (item.mediaId) setRemoved((r) => [...r, item.mediaId!]);
    if (item.file) URL.revokeObjectURL(item.url);
    setter((items) => items.filter((i) => i.key !== item.key));
  };

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (form.title.trim().length < 5) e.title = 'Dê um título com pelo menos 5 caracteres.';
      if (!form.breed_id) e.breed_id = 'Selecione a raça.';
      if (!form.age_months || Number(form.age_months) < 1) e.age_months = 'Informe a idade em meses.';
      if (!form.weight_kg || Number(form.weight_kg) < 20) e.weight_kg = 'Informe o peso em kg.';
      if (!form.purpose) e.purpose = 'Selecione a finalidade.';
    }
    if (s === 1 && form.is_pregnant && form.pregnancy_months && (Number(form.pregnancy_months) < 1 || Number(form.pregnancy_months) > 10)) {
      e.pregnancy_months = 'Informe entre 1 e 10 meses.';
    }
    if (s === 2 && photos.length === 0) e.photos = 'Envie pelo menos uma foto.';
    if (s === 3) {
      if (parseMoney(form.price) < 100) e.price = 'Informe um preço válido (mínimo R$ 100,00).';
      if (!form.city.trim()) e.city = 'Informe a cidade.';
      if (!form.state) e.state = 'Selecione o estado.';
    }
    setErrors(e);
    if (Object.keys(e).length) toast.warning('Confira os campos destacados.', Object.values(e)[0]);
    return Object.keys(e).length === 0;
  };

  const next = () => validateStep(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const addVaccine = (name: string) => {
    const v = name.trim();
    if (v && !form.vaccinations.includes(v)) set('vaccinations', [...form.vaccinations, v]);
    setCustomVaccine('');
  };

  const breedName = useMemo(() => breeds.find((b) => String(b.id) === form.breed_id)?.name ?? '—', [breeds, form.breed_id]);

  const submit = async () => {
    for (let s = 0; s < 4; s++) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    const fd = new FormData();
    const fields: Record<string, string> = {
      title: form.title.trim(),
      breed_id: form.breed_id,
      sex: form.sex,
      age_months: form.age_months,
      weight_kg: form.weight_kg,
      purpose: form.purpose,
      milk_production_liters: form.purpose === 'leite' ? form.milk_production_liters : '',
      description: form.description,
      vaccinated: form.vaccinated ? '1' : '0',
      is_pregnant: form.is_pregnant ? '1' : '0',
      pregnancy_months: form.is_pregnant ? form.pregnancy_months : '',
      health_history: form.health_history,
      price: String(parseMoney(form.price)),
      city: form.city.trim(),
      state: form.state,
    };
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    form.vaccinations.forEach((v) => fd.append('vaccinations[]', v));
    photos.filter((p) => p.file).forEach((p) => fd.append('photos[]', p.file!));
    video.filter((v) => v.file).forEach((v) => fd.append('video', v.file!));
    certificates.filter((c) => c.file).forEach((c) => fd.append('certificates[]', c.file!));
    removed.forEach((r) => fd.append('remove_media_ids[]', String(r)));

    setSaving(true);
    try {
      if (editing) await cowService.update(Number(id), fd);
      else await cowService.create(fd);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const flat = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k.split('.')[0], v[0]]));
        setErrors(flat);
        toast.warning('Confira os campos destacados.', Object.values(flat)[0]);
      } else if (err instanceof ApiError && err.status === 403 && !user?.profile_complete) {
        toast.warning('Complete seu cadastro', err.message);
        navigate('/perfil?completar=1');
      } else {
        toast.error('Não foi possível salvar o anúncio', errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  if (user && !user.profile_complete) {
    return (
      <GlassCard className="mx-auto max-w-xl text-center">
        <TriangleAlert className="mx-auto h-10 w-10 text-trigo-dark" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Complete seu cadastro para anunciar</h1>
        <p className="mt-2 text-sm text-grafite/75">Precisamos do seu CPF/CNPJ, telefone, cidade e estado antes de publicar anúncios.</p>
        <LinkButton to="/perfil?completar=1" className="mt-5">Completar cadastro</LinkButton>
      </GlassCard>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={editing ? 'Editar anúncio' : 'Anunciar nova vaca'}
        description={editing && original?.status === 'active' ? 'Ao salvar, o anúncio volta para análise antes de reaparecer na vitrine.' : 'Preencha as etapas abaixo. Você pode voltar a qualquer momento.'}
      />

      <GlassCard className="mb-6">
        <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      </GlassCard>

      <GlassCard>
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Título do anúncio" value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} placeholder="Ex.: Vaca Girolando 3/4 com alta produção" maxLength={120} required wrapperClassName="sm:col-span-2" />
            <Select label="Raça" value={form.breed_id} onChange={(e) => set('breed_id', e.target.value)} error={errors.breed_id} placeholder="Selecione" options={breeds.map((b) => ({ value: b.id, label: b.name }))} required />
            <Select label="Sexo" value={form.sex} onChange={(e) => set('sex', e.target.value)} options={Object.entries(SEX_LABELS).map(([v, l]) => ({ value: v, label: l }))} required />
            <Input label="Idade (meses)" type="number" min={1} max={300} value={form.age_months} onChange={(e) => set('age_months', e.target.value)} error={errors.age_months} hint={form.age_months ? formatAge(Number(form.age_months)) : undefined} required />
            <Input label="Peso (kg)" type="number" min={20} max={2000} value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} error={errors.weight_kg} required />
            <Select label="Finalidade" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} error={errors.purpose} placeholder="Selecione" options={Object.entries(PURPOSE_LABELS).map(([v, l]) => ({ value: v, label: l }))} required />
            {form.purpose === 'leite' && (
              <Input label="Produção de leite (litros/dia)" type="number" min={0} step="0.1" value={form.milk_production_liters} onChange={(e) => set('milk_production_liters', e.target.value)} error={errors.milk_production_liters} />
            )}
            <Textarea label="Descrição" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Conte sobre a genética, temperamento, manejo…" maxLength={3000} wrapperClassName="sm:col-span-2" />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="divide-y divide-pasto/10 rounded-2xl bg-white/40 px-4">
              <Toggle label="Vacinação em dia" description="Indique se o calendário de vacinas está atualizado." checked={form.vaccinated} onChange={(v) => set('vaccinated', v)} />
              <Toggle label="Está prenha" checked={form.is_pregnant} onChange={(v) => set('is_pregnant', v)} />
            </div>
            {form.is_pregnant && (
              <Input label="Meses de gestação" type="number" min={1} max={10} value={form.pregnancy_months} onChange={(e) => set('pregnancy_months', e.target.value)} error={errors.pregnancy_months} wrapperClassName="sm:w-60" />
            )}
            <div>
              <p className="mb-1.5 text-sm font-medium">Vacinas aplicadas</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_VACCINES.map((v) => {
                  const on = form.vaccinations.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('vaccinations', on ? form.vaccinations.filter((x) => x !== v) : [...form.vaccinations, v])}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${on ? 'bg-folha text-white' : 'bg-white/70 text-grafite/80 hover:bg-white'}`}
                    >
                      {v}
                    </button>
                  );
                })}
                {form.vaccinations.filter((v) => !COMMON_VACCINES.includes(v)).map((v) => (
                  <span key={v} className="inline-flex items-center gap-1 rounded-full bg-folha px-3.5 py-1.5 text-sm font-medium text-white">
                    {v}
                    <button type="button" onClick={() => set('vaccinations', form.vaccinations.filter((x) => x !== v))} aria-label={`Remover ${v}`}><X className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2 sm:w-96">
                <Input aria-label="Outra vacina" placeholder="Outra vacina…" value={customVaccine} onChange={(e) => setCustomVaccine(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVaccine(customVaccine); } }} wrapperClassName="flex-1" />
                <Button variant="outline" onClick={() => addVaccine(customVaccine)} icon={<Plus className="h-4 w-4" />}>Adicionar</Button>
              </div>
            </div>
            <Textarea label="Histórico sanitário" value={form.health_history} onChange={(e) => set('health_history', e.target.value)} placeholder="Exames, tratamentos, vermifugação…" maxLength={3000} />
            <Dropzone
              label="Atestados (PDF ou imagem)"
              hint={`PDF, JPG, PNG ou WEBP · até ${maxMb} MB cada · máximo 5`}
              accept="application/pdf,image/jpeg,image/png,image/webp"
              maxFiles={5}
              maxSizeMb={maxMb}
              icon="pdf"
              items={certificates}
              onAdd={(items) => setCertificates((c) => [...c, ...items])}
              onRemove={removeItem(setCertificates)}
              onReject={(m) => toast.warning(m)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Dropzone
              label="Fotos *"
              hint={`JPG, PNG ou WEBP · até ${maxMb} MB cada · até 10 fotos · a primeira é a capa`}
              accept="image/jpeg,image/png,image/webp"
              maxFiles={10}
              maxSizeMb={maxMb}
              items={photos}
              onAdd={(items) => {
                setPhotos((p) => [...p, ...items]);
                setErrors((e) => ({ ...e, photos: '' }));
              }}
              onRemove={removeItem(setPhotos)}
              onReject={(m) => toast.warning(m)}
            />
            {errors.photos && <p className="-mt-3 text-xs font-medium text-red-600" role="alert">{errors.photos}</p>}
            <Dropzone
              label="Vídeo (opcional)"
              hint={`MP4 · até ${maxMb} MB`}
              accept="video/mp4"
              multiple={false}
              maxFiles={1}
              maxSizeMb={maxMb}
              icon="video"
              items={video}
              onAdd={(items) => setVideo(items.slice(0, 1))}
              onRemove={removeItem(setVideo)}
              onReject={(m) => toast.warning(m)}
            />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]">
            <Input
              label="Preço (R$)"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set('price', e.target.value.replace(/[^\d,.]/g, ''))}
              error={errors.price}
              hint={form.price ? formatCurrency(parseMoney(form.price)) : 'Ex.: 8.500,00'}
              required
              wrapperClassName="sm:col-span-3 sm:w-72"
            />
            <Input label="Cidade" value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} required wrapperClassName="sm:col-span-2" />
            <Select label="Estado" value={form.state} onChange={(e) => set('state', e.target.value)} error={errors.state} placeholder="UF" options={UFS.map((uf) => ({ value: uf, label: uf }))} required />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="h-40 w-full shrink-0 overflow-hidden rounded-2xl bg-palha sm:w-56">
                {photos[0] && <img src={photos[0].url} alt="Capa do anúncio" className="h-full w-full object-cover" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-terra">{breedName}</p>
                <h2 className="text-xl font-semibold">{form.title}</h2>
                <p className="mt-2 text-3xl font-bold text-pasto">{formatCurrency(parseMoney(form.price))}</p>
                <p className="mt-1 text-sm text-grafite/70">{form.city}/{form.state}</p>
              </div>
            </div>
            <dl className="grid gap-3 rounded-2xl bg-white/45 p-4 text-sm sm:grid-cols-3">
              <Review label="Sexo" value={SEX_LABELS[form.sex]} />
              <Review label="Idade" value={formatAge(Number(form.age_months))} />
              <Review label="Peso" value={formatWeight(form.weight_kg)} />
              <Review label="Finalidade" value={PURPOSE_LABELS[form.purpose]} />
              {form.purpose === 'leite' && form.milk_production_liters && <Review label="Produção" value={`${form.milk_production_liters} L/dia`} />}
              <Review label="Vacinação" value={form.vaccinated ? 'Em dia' : 'Não informada'} />
              <Review label="Prenhez" value={form.is_pregnant ? `Sim${form.pregnancy_months ? ` (${form.pregnancy_months} meses)` : ''}` : 'Não'} />
              <Review label="Fotos" value={`${photos.length}`} />
              <Review label="Vídeo" value={video.length ? 'Sim' : 'Não'} />
              <Review label="Atestados" value={`${certificates.length}`} />
            </dl>
            {form.vaccinations.length > 0 && (
              <div className="flex flex-wrap gap-2">{form.vaccinations.map((v) => <Badge key={v} tone="green">{v}</Badge>)}</div>
            )}
            <p className="rounded-2xl bg-trigo/15 p-4 text-sm text-grafite/85">
              Ao publicar, o anúncio fica <strong>Em análise</strong> e aparece na vitrine assim que for aprovado pela nossa equipe.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-pasto/10 pt-5 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={step === 0 ? () => navigate('/minhas-vacas') : back} icon={<ArrowLeft className="h-4 w-4" />}>
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continuar <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button variant="cta" onClick={submit} loading={saving} icon={<Send className="h-4 w-4" />}>
              {editing ? 'Salvar e enviar para análise' : 'Publicar anúncio'}
            </Button>
          )}
        </div>
      </GlassCard>

      <Modal
        open={success}
        onClose={() => navigate('/minhas-vacas')}
        title="Anúncio enviado!"
        size="sm"
        footer={<Button onClick={() => navigate('/minhas-vacas')}>Ver minhas vacas</Button>}
      >
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-folha" aria-hidden />
          <p className="mt-3 text-base font-semibold">Seu anúncio foi enviado e está em análise</p>
          <p className="mt-1 text-sm text-grafite/70">Você recebe uma notificação assim que ele for aprovado.</p>
        </div>
      </Modal>
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-grafite/60">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
