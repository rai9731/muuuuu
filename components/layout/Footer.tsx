import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import type { LandingTexts } from '@services/types';
import { Logo } from './Logo';

export function Footer({ texts }: { texts?: Partial<LandingTexts> }) {
  const year = new Date().getFullYear();
  return (
    <footer id="contato" className="bg-pasto-dark text-white/85">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-white/70">
            O jeito simples e seguro de comprar e vender gado leiteiro e de corte em todo o Brasil.
          </p>
          <div className="mt-5 flex gap-2">
            {texts?.instagram && (
              <a href={texts.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="rounded-xl bg-white/10 p-2.5 transition hover:bg-trigo hover:text-grafite">
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {texts?.facebook && (
              <a href={texts.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="rounded-xl bg-white/10 p-2.5 transition hover:bg-trigo hover:text-grafite">
                <Facebook className="h-4 w-4" />
              </a>
            )}
            {texts?.youtube && (
              <a href={texts.youtube} target="_blank" rel="noreferrer" aria-label="YouTube" className="rounded-xl bg-white/10 p-2.5 transition hover:bg-trigo hover:text-grafite">
                <Youtube className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-trigo">Plataforma</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><a href="/#como-funciona" className="hover:text-trigo">Como funciona</a></li>
            <li><Link to="/anuncios" className="hover:text-trigo">Ver anúncios</Link></li>
            <li><Link to="/cadastro" className="hover:text-trigo">Anunciar minha vaca</Link></li>
            <li><a href="/#vantagens" className="hover:text-trigo">Vantagens</a></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-trigo">Conta</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/entrar" className="hover:text-trigo">Entrar</Link></li>
            <li><Link to="/cadastro" className="hover:text-trigo">Criar conta</Link></li>
            <li><Link to="/esqueci-senha" className="hover:text-trigo">Esqueci minha senha</Link></li>
            <li><Link to="/termos" className="hover:text-trigo">Termos e privacidade (LGPD)</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-trigo">Contato</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {texts?.contact_email && (
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-trigo" aria-hidden /> {texts.contact_email}</li>
            )}
            {texts?.contact_phone && (
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-trigo" aria-hidden /> {texts.contact_phone}</li>
            )}
            {texts?.contact_address && (
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-trigo" aria-hidden /> {texts.contact_address}</li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-white/55 sm:px-6">
          © {year} Boi na Rede. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
