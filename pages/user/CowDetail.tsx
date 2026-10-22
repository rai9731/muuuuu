import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, Baby, Calendar, Droplets, Eye, FileText, Heart, MapPin, MessageCircle, Pencil, Scale,
  ShieldCheck, ShoppingCart, Syringe, Target, Timer,
} from 'lucide-react';
import { cowService } from '@services/cowService';
import { messageService } from '@services/messageService';
import { errorMessage } from '@services/api';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { Button, LinkButton } from '@components/ui/Button';
import { Avatar, Badge, ErrorState, GlassCard, Skeleton, StatusBadge } from '@components/ui/Display';
import { Textarea } from '@components/ui/Field';
import { Modal } from '@components/ui/Modal';
import { RatingStars } from '@components/ui/RatingStars';
import { CowCard } from '@components/cow/CowCard';
import { CowGallery } from '@components/cow/CowGallery';
import { COW_STATUS, PURPOSE_LABELS, SEX_LABELS } from '@utils/constants';
import { formatAge, formatCurrency, formatDate, formatMemberSince, formatNumber, formatWeight } from '@utils/format';

export default function CowDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => cowService.show(id!), [id]);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const cow = data?.data;

  const requireLogin = (action: string) => {
    toast.info('Entre para continuar', `Faça login ou crie sua conta gratuita para ${action}.`);
    navigate('/entrar', { state: { from: `/anuncios/${id}` } });
  };

  const onBuy = () => {
    if (!user) return requireLogin('comprar');
    navigate(`/checkout/${cow!.id}`);
  };

  const onMessage = () => {
    if (!user) return requireLogin('enviar mensagens');
    setMessage(`Olá! Tenho interesse na vaca "${cow!.title}". Ela ainda está disponível?`);
    setMessageOpen(true);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const conversation = await messageService.start(cow!.id, message.trim());
      toast.success('Mensagem enviada ao vendedor!');
      navigate(`/mensagens/${conversation.id}`);
    } catch (err) {
      toast.error('Não foi possível enviar a mensagem', errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const toggleFavorite = async () => {
    if (!user) return requireLogin('favoritar');
    try {
      const res = await cowService.toggleFavorite(cow!.id);
      setData((prev) => ({ ...prev!, data: { ...prev!.data, is_favorite: res.favorite } }));
      toast.success(res.favorite ? 'Adicionada aos favoritos' : 'Removida dos favoritos');
    } catch (err) {
      toast.error('Não foi possível atualizar os favoritos', errorMessage(err));
    }
  };

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;

  if (loading || !cow) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]" aria-busy="true">
        <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const facts = [
    { icon: Target, label: 'Raça', value: cow.breed?.name ?? '—' },
    { icon: Timer, label: 'Idade', value: formatAge(cow.age_months) },
    { icon: Scale, label: 'Peso', value: formatWeight(cow.weight_kg) },
    { icon: Target, label: 'Finalidade', value: PURPOSE_LABELS[cow.purpose] },
    { icon: Baby, label: 'Sexo', value: SEX_LABELS[cow.sex] },
    ...(cow.milk_production_liters ? [{ icon: Droplets, label: 'Produção de leite', value: `${formatNumber(cow.milk_production_liters)} L/dia` }] : []),
    { icon: Syringe, label: 'Vacinação', value: cow.vaccinated ? 'Em dia' : 'Não informada' },
    { icon: Baby, label: 'Prenhez', value: cow.is_pregnant ? `Prenha${cow.pregnancy_months ? ` (${cow.pregnancy_months} meses)` : ''}` : 'Não' },
    { icon: MapPin, label: 'Localização', value: `${cow.city}/${cow.state}` },
  ];

  const available = cow.status === 'active';

  return (
    <div>
      <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-grafite/70 hover:text-pasto">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-6">
          <CowGallery title={cow.title} photos={cow.photos} video={cow.video} />

          <GlassCard>
            <h2 className="text-lg font-semibold">Informações</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-folha/12 text-folha"><f.icon className="h-4 w-4" aria-hidden /></span>
                  <div>
                    <dt className="text-xs text-grafite/60">{f.label}</dt>
                    <dd className="text-sm font-semibold">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {cow.vaccinations.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">Vacinas aplicadas</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cow.vaccinations.map((v) => <Badge key={v} tone="green"><ShieldCheck className="h-3 w-3" /> {v}</Badge>)}
                </div>
              </div>
            )}

            {cow.description && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">Descrição</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-grafite/85">{cow.description}</p>
              </div>
            )}

            {cow.health_history && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">Histórico sanitário</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-grafite/85">{cow.health_history}</p>
              </div>
            )}

            {cow.certificates.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">Atestados</h3>
                <ul className="mt-2 space-y-2">
                  {cow.certificates.map((c) => (
                    <li key={c.id}>
                      <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-pasto hover:underline">
                        <FileText className="h-4 w-4" /> {c.original_name ?? 'Atestado'}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard className="lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-terra">{cow.breed?.name}</p>
                <h1 className="mt-1 text-2xl font-bold leading-tight">{cow.title}</h1>
              </div>
              <button type="button" onClick={toggleFavorite} className="glass rounded-full p-2.5 transition hover:scale-110" aria-label={cow.is_favorite ? 'Remover dos favoritos' : 'Favoritar'} aria-pressed={!!cow.is_favorite}>
                <Heart className={`h-5 w-5 ${cow.is_favorite ? 'fill-red-500 text-red-500' : ''}`} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-grafite/65">
              {cow.verified && <Badge tone="green"><BadgeCheck className="h-3 w-3" /> Verificado</Badge>}
              {!available && <StatusBadge map={COW_STATUS} value={cow.status} />}
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatNumber(cow.views_count)} visualizações</span>
              {cow.published_at && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(cow.published_at)}</span>}
            </div>

            <p className="mt-5 text-4xl font-bold text-pasto">{formatCurrency(cow.price)}</p>

            <div className="mt-5 space-y-2">
              {cow.is_owner ? (
                <LinkButton to={`/minhas-vacas/${cow.id}/editar`} block size="lg" icon={<Pencil className="h-5 w-5" />}>Editar anúncio</LinkButton>
              ) : (
                <>
                  <Button block size="lg" variant="cta" icon={<ShoppingCart className="h-5 w-5" />} onClick={onBuy} disabled={!available}>
                    {available ? 'Comprar agora' : 'Indisponível no momento'}
                  </Button>
                  <Button block size="lg" variant="outline" icon={<MessageCircle className="h-5 w-5" />} onClick={onMessage}>
                    Enviar mensagem
                  </Button>
                </>
              )}
            </div>

            {cow.seller && (
              <div className="mt-6 border-t border-pasto/10 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-grafite/55">Vendedor</p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={cow.seller.name} src={cow.seller.avatar_url} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{cow.seller.name}</p>
                    {cow.seller.farm_name && <p className="truncate text-xs text-grafite/65">{cow.seller.farm_name}</p>}
                    <p className="text-xs text-grafite/65">{cow.seller.city}/{cow.seller.state}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {cow.seller.rating ? (
                    <>
                      <RatingStars value={cow.seller.rating} />
                      <span className="font-semibold">{cow.seller.rating.toFixed(1).replace('.', ',')}</span>
                      <span className="text-grafite/60">({cow.seller.reviews_count} avaliações)</span>
                    </>
                  ) : (
                    <span className="text-grafite/60">Ainda sem avaliações</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-grafite/60">{formatMemberSince(cow.seller.member_since)}</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {!!data?.similar.length && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Vacas semelhantes</h2>
            <Link to={`/anuncios?breed_id=${cow.breed?.id ?? ''}`} className="text-sm font-semibold text-pasto hover:text-folha">Ver mais</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.similar.map((c) => <CowCard key={c.id} cow={c} />)}
          </div>
        </section>
      )}

      <Modal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        title="Enviar mensagem ao vendedor"
        description={cow.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMessageOpen(false)}>Cancelar</Button>
            <Button onClick={sendMessage} loading={sending} disabled={!message.trim()}>Enviar</Button>
          </>
        }
      >
        <Textarea label="Mensagem" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} />
      </Modal>
    </div>
  );
}
