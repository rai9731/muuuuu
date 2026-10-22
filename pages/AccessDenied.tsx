import { ShieldX } from 'lucide-react';
import { LinkButton } from '@components/ui/Button';
import { GlassCard } from '@components/ui/Display';

export default function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <GlassCard className="max-w-md text-center">
        <ShieldX className="mx-auto h-12 w-12 text-red-600" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Acesso negado</h1>
        <p className="mt-2 text-sm text-grafite/75">Esta área é exclusiva para administradores da plataforma.</p>
        <LinkButton to="/painel" className="mt-6">Ir para o meu painel</LinkButton>
      </GlassCard>
    </div>
  );
}
