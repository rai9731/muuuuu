import { lazy, Suspense, useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  BarChart3, Bell, CreditCard, Heart, LayoutDashboard, Megaphone, MessageCircle, Plus, Settings, ShoppingBag,
  Store, Tractor, User as UserIcon, Users, Wallet,
} from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { AppShell, type NavItem } from '@components/layout/AppShell';
import { FullScreenLoader, GuestOnly, RequireAdmin, RequireAuth } from '@components/layout/Guards';
import { PublicHeader } from '@components/layout/PublicHeader';
import { Footer } from '@components/layout/Footer';
import { LinkButton } from '@components/ui/Button';

// Fora do fluxo principal (ainda não implementados)
const ComingSoon = lazy(() => import('@pages/ComingSoon'));

// Público
const Landing = lazy(() => import('@pages/Landing'));
const Login = lazy(() => import('@pages/auth/Login'));
const Register = lazy(() => import('@pages/auth/Register'));
const ForgotPassword = lazy(() => import('@pages/auth/ForgotPassword'));
const GoogleCallback = lazy(() => import('@pages/auth/GoogleCallback'));
const ChangePassword = lazy(() => import('@pages/auth/ChangePassword'));
const Terms = lazy(() => import('@pages/Terms'));
const NotFound = lazy(() => import('@pages/NotFound'));
const AccessDenied = lazy(() => import('@pages/AccessDenied'));
const Marketplace = lazy(() => import('@pages/user/Marketplace'));
const CowDetail = lazy(() => import('@pages/user/CowDetail'));

// Usuário
const Dashboard = lazy(() => import('@pages/user/Dashboard'));
const Favorites = lazy(() => import('@pages/user/Favorites'));
const MyCows = lazy(() => import('@pages/user/MyCows'));
const CowForm = lazy(() => import('@pages/user/CowForm'));
const Checkout = lazy(() => import('@pages/user/Checkout'));
const MyPurchases = lazy(() => import('@pages/user/MyPurchases'));
const PurchaseDetail = lazy(() => import('@pages/user/PurchaseDetail'));
const MySales = lazy(() => import('@pages/user/MySales'));
const Messages = ComingSoon;
const Notifications = ComingSoon;
const Profile = lazy(() => import('@pages/user/Profile'));

// Admin
const AdminDashboard = lazy(() => import('@pages/admin/AdminDashboard'));
const AdminNotifications = ComingSoon;
const AdminListings = lazy(() => import('@pages/admin/AdminListings'));
const AdminUsers = lazy(() => import('@pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('@pages/admin/AdminUserDetail'));
const AdminSales = lazy(() => import('@pages/admin/AdminSales'));
const AdminSaleDetail = lazy(() => import('@pages/admin/AdminSaleDetail'));
const AdminPayments = lazy(() => import('@pages/admin/AdminPayments'));
const AdminReports = lazy(() => import('@pages/admin/AdminReports'));
const AdminSettings = lazy(() => import('@pages/admin/AdminSettings'));

const USER_NAV: NavItem[] = [
  { to: '/painel', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/anuncios', label: 'Marketplace', icon: Store },
  { to: '/minhas-vacas', label: 'Minhas vacas', icon: Tractor },
  { to: '/minhas-compras', label: 'Minhas compras', icon: ShoppingBag },
  { to: '/minhas-vendas', label: 'Minhas vendas', icon: Wallet },
  { to: '/favoritos', label: 'Favoritos', icon: Heart },
  { to: '/mensagens', label: 'Mensagens', icon: MessageCircle, badge: 'messages' },
  { to: '/notificacoes', label: 'Notificações', icon: Bell, badge: 'notifications' },
  { to: '/perfil', label: 'Perfil', icon: UserIcon },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/notificacoes', label: 'Notificações', icon: Bell, badge: 'notifications' },
  { to: '/admin/anuncios', label: 'Anúncios', icon: Megaphone },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
  { to: '/admin/vendas', label: 'Vendas', icon: ShoppingBag },
  { to: '/admin/pagamentos', label: 'Pagamentos', icon: CreditCard },
  { to: '/admin/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

const newCowShortcut = (
  <LinkButton to="/minhas-vacas/nova" variant="cta" block icon={<Plus className="h-4 w-4" />}>
    Anunciar nova vaca
  </LinkButton>
);

function UserLayout() {
  return (
    <RequireAuth>
      <AppShell nav={USER_NAV} variant="user" sidebarFooter={newCowShortcut} />
    </RequireAuth>
  );
}

function AdminLayout() {
  return (
    <RequireAdmin>
      <AppShell nav={ADMIN_NAV} variant="admin" />
    </RequireAdmin>
  );
}

function PublicLayout() {
  return (
    <div className="bg-rural min-h-screen">
      <PublicHeader />
      <main id="conteudo" className="mx-auto max-w-7xl px-3 pb-16 pt-24 sm:px-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/** Vitrine: visitantes veem o layout público; usuários logados, o layout da área do usuário. */
function AdaptiveLayout() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user && !user.must_change_password) return <AppShell nav={USER_NAV} variant="user" sidebarFooter={newCowShortcut} />;
  return <PublicLayout />;
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/cadastro" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/esqueci-senha" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
        <Route path="/entrar/google" element={<GoogleCallback />} />
        <Route path="/trocar-senha" element={<RequireAuth><ChangePassword /></RequireAuth>} />

        <Route element={<AdaptiveLayout />}>
          <Route path="/anuncios" element={<Marketplace />} />
          <Route path="/anuncios/:id" element={<CowDetail />} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="/termos" element={<Terms />} />
          <Route path="/acesso-negado" element={<AccessDenied />} />
        </Route>

        <Route element={<UserLayout />}>
          <Route path="/painel" element={<Dashboard />} />
          <Route path="/favoritos" element={<Favorites />} />
          <Route path="/minhas-vacas" element={<MyCows />} />
          <Route path="/minhas-vacas/nova" element={<CowForm />} />
          <Route path="/minhas-vacas/:id/editar" element={<CowForm />} />
          <Route path="/checkout/:cowId" element={<Checkout />} />
          <Route path="/minhas-compras" element={<MyPurchases />} />
          <Route path="/minhas-compras/:id" element={<PurchaseDetail />} />
          <Route path="/minhas-vendas" element={<MySales />} />
          <Route path="/mensagens" element={<Messages />} />
          <Route path="/mensagens/:id" element={<Messages />} />
          <Route path="/notificacoes" element={<Notifications />} />
          <Route path="/perfil" element={<Profile />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="notificacoes" element={<AdminNotifications />} />
          <Route path="anuncios" element={<AdminListings />} />
          <Route path="usuarios" element={<AdminUsers />} />
          <Route path="usuarios/:id" element={<AdminUserDetail />} />
          <Route path="vendas" element={<AdminSales />} />
          <Route path="vendas/:id" element={<AdminSaleDetail />} />
          <Route path="pagamentos" element={<AdminPayments />} />
          <Route path="relatorios" element={<AdminReports />} />
          <Route path="configuracoes" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
