import { LinkButton } from '@components/ui/Button';
import { GlassCard, PageHeader } from '@components/ui/Display';

export default function ComingSoon() {
  return (
    <GlassCard>
      <PageHeader title="Em breve" description="Esta área ainda está em desenvolvimento." />
      <LinkButton to="/painel" variant="cta">Voltar ao painel</LinkButton>
    </GlassCard>
  );
}
