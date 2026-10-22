import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogIn, Menu, Shield, X } from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { Logo } from './Logo';

const NAV = [
  { href: '/#como-funciona', label: 'Como funciona' },
  { href: '/anuncios', label: 'Anúncios' },
  { href: '/#vantagens', label: 'Vantagens' },
  { href: '/#contato', label: 'Contato' },
];

/** Header fixo em vidro da área pública. */
export function PublicHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const onLanding = location.pathname === '/';
  const light = onLanding && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const linkClass = `rounded-lg px-3 py-2 text-sm font-medium transition ${light ? 'text-white/90 hover:bg-white/15 hover:text-white' : 'text-grafite/80 hover:bg-pasto/10 hover:text-pasto'}`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
      <div className={`mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl px-4 transition-all duration-300 sm:px-5 ${light ? 'glass-dark' : 'glass-strong'}`}>
        <Logo light={light} />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Menu principal">
          {NAV.map((item) =>
            item.href.startsWith('/#') ? (
              <a key={item.href} href={item.href} className={linkClass}>
                {item.label}
              </a>
            ) : (
              <Link key={item.href} to={item.href} className={linkClass}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" className="hidden h-10 items-center gap-2 rounded-xl bg-terra px-4 text-sm font-semibold text-white transition hover:bg-terra/90 sm:inline-flex">
                  <Shield className="h-4 w-4" /> Painel Admin
                </Link>
              )}
              <Link to="/painel" className="inline-flex h-10 items-center gap-2 rounded-xl bg-trigo px-4 text-sm font-semibold text-grafite transition hover:bg-trigo-dark hover:text-white">
                <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Meu painel</span>
              </Link>
            </>
          ) : (
            <Link to="/entrar" className="inline-flex h-10 items-center gap-2 rounded-xl bg-trigo px-5 text-sm font-semibold text-grafite shadow-sm transition hover:bg-trigo-dark hover:text-white">
              <LogIn className="h-4 w-4" /> Entrar
            </Link>
          )}
          <button
            type="button"
            className={`rounded-xl p-2 lg:hidden ${light ? 'text-white hover:bg-white/15' : 'text-grafite hover:bg-pasto/10'}`}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 -z-10 bg-grafite/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
          <nav className="glass-strong mx-auto mt-2 max-w-7xl animate-fade-up rounded-2xl p-2 lg:hidden" aria-label="Menu móvel">
            {NAV.map((item) =>
              item.href.startsWith('/#') ? (
                <a key={item.href} href={item.href} className="block rounded-xl px-4 py-3 font-medium text-grafite hover:bg-pasto/10">
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} to={item.href} className="block rounded-xl px-4 py-3 font-medium text-grafite hover:bg-pasto/10">
                  {item.label}
                </Link>
              ),
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className="block rounded-xl px-4 py-3 font-semibold text-terra hover:bg-terra/10">
                Painel Admin
              </Link>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
