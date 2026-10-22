import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, LogOut, Menu, MessageCircle, Search, Shield, ShoppingBag, Store, User as UserIcon, X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { useUnreadCounts } from '@hooks/useUnreadCounts';
import { useToast } from '@hooks/useToast';
import { Avatar } from '@components/ui/Display';
import { Logo } from './Logo';
import { PastureBackdrop } from './PastureScene';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: 'notifications' | 'messages';
}

interface AppShellProps {
  nav: NavItem[];
  variant: 'user' | 'admin';
  /** Conteúdo extra no rodapé do menu lateral (ex.: atalho "Anunciar nova vaca"). */
  sidebarFooter?: ReactNode;
}

/** Layout das áreas logadas: header em vidro, menu lateral no desktop e drawer no mobile. */
export function AppShell({ nav, variant, sidebarFooter }: AppShellProps) {
  const { user, logout } = useAuth();
  const counts = useUnreadCounts();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawer(false);
    setMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawer(false);
        setMenu(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Você saiu da sua conta.', 'Até a próxima!');
    navigate('/entrar');
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (variant === 'admin') navigate(`/admin/anuncios${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    else navigate(`/anuncios${q ? `?search=${encodeURIComponent(q)}` : ''}`);
  };

  const badgeValue = (item: NavItem) => (item.badge ? counts[item.badge] : 0);
  const notificationsPath = variant === 'admin' ? '/admin/notificacoes' : '/notificacoes';

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label={variant === 'admin' ? 'Menu do administrador' : 'Menu do usuário'}>
      <ul className="space-y-1">
        {nav.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-pasto text-white shadow-sm' : 'text-grafite/80 hover:bg-white/70 hover:text-pasto'
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {badgeValue(item) > 0 && (
                <span className="rounded-full bg-trigo px-2 py-0.5 text-xs font-bold text-grafite">{badgeValue(item)}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      {sidebarFooter && <div className="mt-auto pt-6">{sidebarFooter}</div>}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <PastureBackdrop />
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2">
        Pular para o conteúdo
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
        <div className="glass-strong mx-auto flex h-16 items-center gap-3 rounded-2xl px-3 sm:px-4">
          <button
            type="button"
            className="rounded-xl p-2 text-grafite hover:bg-pasto/10 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Logo to={variant === 'admin' ? '/admin' : '/painel'} />
          {variant === 'admin' && <span className="hidden rounded-lg bg-terra/15 px-2 py-0.5 text-xs font-semibold text-terra sm:inline">Admin</span>}

          <form onSubmit={onSearch} className="ml-2 hidden max-w-md flex-1 md:block" role="search">
            <label htmlFor="global-search" className="sr-only">Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grafite/45" aria-hidden />
              <input
                id="global-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={variant === 'admin' ? 'Buscar anúncios…' : 'Buscar vacas por raça, cidade…'}
                className="h-10 w-full rounded-xl border border-pasto/10 bg-white/60 pl-9 pr-3 text-sm focus:border-folha focus:bg-white focus:outline-none focus:ring-2 focus:ring-folha/25"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {user?.role === 'admin' && variant === 'user' && (
              <Link to="/admin" className="inline-flex h-10 items-center gap-2 rounded-xl bg-terra px-3 text-sm font-semibold text-white transition hover:bg-terra/90 sm:px-4">
                <Shield className="h-4 w-4" /> <span className="hidden sm:inline">Painel Admin</span>
              </Link>
            )}
            {variant === 'admin' && (
              <Link to="/painel" className="hidden h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-pasto transition hover:bg-pasto/10 sm:inline-flex">
                <Store className="h-4 w-4" /> Área do usuário
              </Link>
            )}
            {variant === 'user' && (
              <Link to="/mensagens" className="relative rounded-xl p-2.5 text-grafite transition hover:bg-pasto/10" aria-label={`Mensagens${counts.messages ? `, ${counts.messages} não lidas` : ''}`}>
                <MessageCircle className="h-5 w-5" />
                {counts.messages > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-trigo ring-2 ring-white" />}
              </Link>
            )}
            <Link to={notificationsPath} className="relative rounded-xl p-2.5 text-grafite transition hover:bg-pasto/10" aria-label={`Notificações${counts.notifications ? `, ${counts.notifications} não lidas` : ''}`}>
              <Bell className="h-5 w-5" />
              {counts.notifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">
                  {counts.notifications > 99 ? '99+' : counts.notifications}
                </span>
              )}
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-pasto/10"
                aria-haspopup="menu"
                aria-expanded={menu}
                aria-label="Menu da conta"
              >
                <Avatar name={user?.name} src={user?.avatar_url} size="sm" />
                <span className="hidden max-w-32 truncate text-sm font-medium text-grafite lg:inline">{user?.name.split(' ')[0]}</span>
                <ChevronDown className="hidden h-4 w-4 text-grafite/60 sm:block" />
              </button>
              {menu && (
                <div role="menu" className="glass-strong absolute right-0 mt-2 w-60 animate-fade-up rounded-2xl p-2">
                  <div className="border-b border-pasto/10 px-3 pb-2 pt-1">
                    <p className="truncate text-sm font-semibold text-grafite">{user?.name}</p>
                    <p className="truncate text-xs text-grafite/60">{user?.email}</p>
                  </div>
                  <MenuLink to="/perfil" icon={UserIcon} label="Perfil" />
                  <MenuLink to="/minhas-vacas" icon={Store} label="Minhas vacas" />
                  <MenuLink to="/minhas-compras" icon={ShoppingBag} label="Minhas compras" />
                  {user?.role === 'admin' && <MenuLink to="/admin" icon={Shield} label="Painel Admin" />}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex gap-6 px-3 py-6 sm:px-4">
        {/* Menu lateral (desktop) */}
        <aside className={`${variant === 'admin' ? 'glass-strong' : 'glass'} sticky top-24 hidden h-[calc(100vh-7.5rem)] w-64 shrink-0 overflow-y-auto rounded-3xl p-4 lg:block`}>
          {variant === 'admin' && (
            <p className="mb-3 flex items-center gap-2 px-3 text-xs font-bold uppercase tracking-wider text-terra">
              <Shield className="h-4 w-4" aria-hidden /> Administração
            </p>
          )}
          {sidebar}</aside>

        <main id="conteudo" className="min-w-0 flex-1 pb-10">
          <Outlet />
        </main>
      </div>

      {/* Drawer (mobile) */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-grafite/40 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="glass-strong absolute inset-y-0 left-0 flex w-80 max-w-[85vw] animate-fade-up flex-col p-4" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="mb-5 flex items-center justify-between">
              <Logo to={variant === 'admin' ? '/admin' : '/painel'} />
              <button type="button" onClick={() => setDrawer(false)} className="rounded-xl p-2 hover:bg-pasto/10" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onSearch} className="mb-4 md:hidden" role="search">
              <label htmlFor="drawer-search" className="sr-only">Buscar</label>
              <input
                id="drawer-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="h-10 w-full rounded-xl border border-pasto/10 bg-white/70 px-3 text-sm focus:border-folha focus:outline-none focus:ring-2 focus:ring-folha/25"
              />
            </form>
            <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
          </aside>
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} role="menuitem" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-grafite transition hover:bg-pasto/10">
      <Icon className="h-4 w-4 text-pasto" /> {label}
    </Link>
  );
}
