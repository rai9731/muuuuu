import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Handshake, Lock, Megaphone, MessageCircle, Quote, ShieldCheck,
  Store, Truck, UserPlus, Users,
} from 'lucide-react';
import { publicService } from '@services/publicService';
import { useAsync } from '@hooks/useAsync';
import { PublicHeader } from '@components/layout/PublicHeader';
import { PastureScene } from '@components/layout/PastureScene';
import { Footer } from '@components/layout/Footer';
import { LinkButton } from '@components/ui/Button';
import { Skeleton } from '@components/ui/Display';
import { CowCard } from '@components/cow/CowCard';
import { formatNumber } from '@utils/format';

const STEPS = [
  { icon: UserPlus, title: 'Cadastre-se', text: 'Crie sua conta gratuita em menos de 2 minutos, com e-mail ou Google.' },
  { icon: Megaphone, title: 'Anuncie sua vaca', text: 'Envie fotos, vídeo, dados de saúde e preço. Nossa equipe revisa e publica.' },
  { icon: Handshake, title: 'Feche negócio', text: 'Converse com compradores, receba por Pix, cartão ou boleto e combine a entrega.' },
];

const ADVANTAGES = [
  { icon: ShieldCheck, title: 'Pagamento protegido', text: 'O valor fica com a plataforma até a confirmação, e o repasse vai direto para o vendedor.' },
  { icon: BadgeCheck, title: 'Anúncios revisados', text: 'Todo anúncio é analisado antes de ir para a vitrine, com atestados sanitários anexados.' },
  { icon: MessageCircle, title: 'Negociação no chat', text: 'Tire dúvidas com o vendedor sem sair da plataforma e sem expor seu telefone.' },
  { icon: Truck, title: 'Frete ou retirada', text: 'Escolha receber com frete ou retirar na propriedade, com acompanhamento do pedido.' },
];

/** Destaca as duas últimas palavras do título em degradê dourado. */
function HeroTitle({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return <>{text}</>;
  return (
    <>
      {words.slice(0, -2).join(' ')}{' '}
      <span className="whitespace-nowrap bg-gradient-to-r from-[#ffe08a] via-trigo to-[#f0a957] bg-clip-text text-transparent [text-shadow:none]">
        {words.slice(-2).join(' ')}
      </span>
    </>
  );
}

export default function Landing() {
  const { data, loading } = useAsync(() => publicService.landing(), []);
  const carousel = useRef<HTMLDivElement>(null);
  const texts = data?.texts;

  const scroll = (dir: number) => {
    const el = carousel.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className="bg-creme">
      <PublicHeader />

      {/* Hero */}
      <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden px-4 pb-20 pt-32 sm:px-6">
        <PastureScene />
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-5xl animate-fade-up">
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white">
              <Lock className="h-4 w-4 text-trigo" aria-hidden /> Pagamento seguro via Pix, cartão e boleto
            </span>
            <h1 className="mt-6 text-balance text-5xl font-extrabold leading-[0.98] tracking-tighter text-white [text-shadow:0_4px_32px_rgb(0_0_0/0.35)] sm:text-7xl lg:text-8xl">
              <HeroTitle text={texts?.hero_title ?? 'Compre e venda gado com segurança e praticidade'} />
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-medium text-white [text-shadow:0_2px_16px_rgb(0_0_0/0.55)] sm:text-xl">
              {texts?.hero_subtitle ?? 'O marketplace que conecta produtores de todo o Brasil. Anuncie suas vacas e encontre os melhores animais de leite e de corte.'}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton to="/cadastro" variant="cta" size="lg" icon={<Megaphone className="h-5 w-5" />}>
                Anunciar minha vaca
              </LinkButton>
              <LinkButton to="/anuncios" variant="glass" size="lg" icon={<Store className="h-5 w-5" />}>
                Ver anúncios
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="Simples assim" title="Como funciona" />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="glass hover-lift relative rounded-3xl p-7">
                <span className="absolute right-6 top-5 text-5xl font-bold text-pasto/10">{i + 1}</span>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pasto text-white shadow-sm">
                  <step.icon className="h-7 w-7" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-grafite/75">{step.text}</p>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="absolute -right-5 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-trigo md:block" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Anúncios em destaque */}
      <section id="anuncios" className="scroll-mt-24 bg-gradient-to-b from-palha/40 to-creme px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle eyebrow="Vitrine" title="Anúncios em destaque" align="left" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => scroll(-1)} className="glass rounded-full p-2.5 transition hover:bg-white" aria-label="Anúncios anteriores">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => scroll(1)} className="glass rounded-full p-2.5 transition hover:bg-white" aria-label="Próximos anúncios">
                <ChevronRight className="h-5 w-5" />
              </button>
              <Link to="/anuncios" className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-pasto hover:text-folha">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div ref={carousel} className="scrollbar-thin mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass w-72 shrink-0 rounded-3xl p-3">
                    <Skeleton className="aspect-[4/3] w-full" />
                    <Skeleton className="mt-3 h-4 w-2/3" />
                    <Skeleton className="mt-3 h-6 w-1/3" />
                  </div>
                ))
              : data?.featured.map((cow) => (
                  <div key={cow.id} className="w-72 shrink-0 snap-start">
                    <CowCard cow={cow} />
                  </div>
                ))}
            {!loading && !data?.featured.length && (
              <p className="py-10 text-sm text-grafite/70">Os primeiros anúncios aparecem aqui assim que forem aprovados.</p>
            )}
          </div>
        </div>
      </section>

      {/* Vantagens + números */}
      <section id="vantagens" className="scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="Por que o Boi na Rede" title="Vantagens para quem cria e para quem compra" />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ADVANTAGES.map((a) => (
              <div key={a.title} className="glass hover-lift rounded-3xl p-6">
                <a.icon className="h-8 w-8 text-folha" aria-hidden />
                <h3 className="mt-4 font-semibold">{a.title}</h3>
                <p className="mt-1.5 text-sm text-grafite/75">{a.text}</p>
              </div>
            ))}
          </div>

          <div className="relative isolate mt-14 overflow-hidden rounded-[2rem] bg-pasto px-6 py-12 text-white sm:px-12">
            <div className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-folha/50 blur-3xl" aria-hidden />
            <div className="absolute -bottom-24 -left-10 -z-10 h-72 w-72 rounded-full bg-trigo/30 blur-3xl" aria-hidden />
            <dl className="grid gap-8 text-center sm:grid-cols-3">
              <Stat icon={<Megaphone className="h-6 w-6" />} value={data?.stats.cows} label="vacas anunciadas" loading={loading} />
              <Stat icon={<Handshake className="h-6 w-6" />} value={data?.stats.sales} label="vendas realizadas" loading={loading} />
              <Stat icon={<Users className="h-6 w-6" />} value={data?.stats.users} label="usuários ativos" loading={loading} />
            </dl>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      {!!data?.testimonials.length && (
        <section className="bg-gradient-to-b from-creme to-palha/40 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <SectionTitle eyebrow="Quem usa, recomenda" title="Depoimentos de produtores" />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {data.testimonials.map((t) => (
                <figure key={t.name} className="glass flex flex-col rounded-3xl p-7">
                  <Quote className="h-8 w-8 text-trigo" aria-hidden />
                  <blockquote className="mt-4 flex-1 text-grafite/85">“{t.text}”</blockquote>
                  <figcaption className="mt-6 border-t border-pasto/10 pt-4">
                    <p className="font-semibold text-grafite">{t.name}</p>
                    <p className="text-sm text-grafite/65">{t.role} · {t.city}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="px-4 py-20 sm:px-6">
        <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12">
          <PastureScene />
          <h2 className="text-3xl font-bold text-white sm:text-4xl">{texts?.cta_title ?? 'Comece a vender hoje'}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            {texts?.cta_subtitle ?? 'Cadastre-se gratuitamente e publique seu primeiro anúncio em poucos minutos.'}
          </p>
          <LinkButton to="/cadastro" variant="cta" size="lg" className="mt-8" icon={<UserPlus className="h-5 w-5" />}>
            Criar minha conta grátis
          </LinkButton>
        </div>
      </section>

      <Footer texts={texts} />
    </div>
  );
}

function SectionTitle({ eyebrow, title, align = 'center' }: { eyebrow: string; title: string; align?: 'center' | 'left' }) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <p className="text-sm font-semibold uppercase tracking-wider text-terra">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold text-grafite sm:text-4xl">{title}</h2>
    </div>
  );
}

function Stat({ icon, value, label, loading }: { icon: ReactNode; value?: number; label: string; loading: boolean }) {
  return (
    <div>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-trigo">{icon}</span>
      <dd className="mt-3 text-4xl font-bold">{loading ? '—' : formatNumber(value ?? 0)}</dd>
      <dt className="mt-1 text-sm text-white/80">{label}</dt>
    </div>
  );
}
