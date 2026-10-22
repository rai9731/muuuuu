import { Home } from 'lucide-react';
import { LinkButton } from '@components/ui/Button';
import { EmptyState } from '@components/ui/Display';

export default function NotFound() {
  return (
    <div className="bg-rural flex min-h-screen items-center justify-center p-4">
      <div className="glass w-full max-w-lg rounded-3xl">
        <EmptyState
          illustration="search"
          title="Página não encontrada"
          description="Parece que esta porteira não leva a lugar nenhum. Confira o endereço ou volte para o início."
          action={<LinkButton to="/" icon={<Home className="h-4 w-4" />}>Voltar ao início</LinkButton>}
        />
      </div>
    </div>
  );
}
