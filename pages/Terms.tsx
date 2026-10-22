import { GlassCard, PageHeader } from '@components/ui/Display';

const SECTIONS = [
  {
    title: '1. Sobre a plataforma',
    body: 'O Boi na Rede aproxima produtores que querem vender e comprar gado. A plataforma intermedia o pagamento pelo gateway Asaas e repassa o valor ao vendedor, descontada a comissão informada no checkout.',
  },
  {
    title: '2. Anúncios',
    body: 'Todo anúncio novo ou editado passa por análise antes de aparecer na vitrine. O anunciante é responsável pela veracidade das informações, fotos, atestados sanitários e pela entrega do animal.',
  },
  {
    title: '3. Dados pessoais que coletamos (LGPD)',
    body: 'Coletamos apenas o necessário para operar a plataforma: nome, e-mail, CPF/CNPJ, telefone, cidade e estado (cadastro e emissão de cobranças), nome da fazenda (opcional) e dados de recebimento (chave Pix ou conta bancária) para os repasses. Base legal: execução de contrato e cumprimento de obrigação legal (Lei 13.709/2018, art. 7º, II e V).',
  },
  {
    title: '4. Como protegemos seus dados',
    body: 'Senhas são armazenadas com hash; CPF/CNPJ e dados bancários são criptografados no banco de dados. Dados de cartão de crédito nunca passam pelos nossos servidores — são digitados diretamente no ambiente seguro do Asaas. Registramos acessos e alterações em dados pessoais para fins de auditoria.',
  },
  {
    title: '5. Compartilhamento',
    body: 'Compartilhamos dados somente com o gateway de pagamento (Asaas), para gerar cobranças e repasses, e com a outra parte de uma negociação (nome, cidade e contato), após a compra. Não vendemos nem cedemos dados a terceiros.',
  },
  {
    title: '6. Seus direitos',
    body: 'Você pode, a qualquer momento, consultar e corrigir seus dados em "Perfil", baixar uma cópia completa deles e solicitar a exclusão da sua conta. Ao excluir a conta, seus dados pessoais são anonimizados; registros financeiros são mantidos pelo prazo exigido em lei.',
  },
  {
    title: '7. Comunicação',
    body: 'Toda comunicação acontece dentro da plataforma, por notificações internas e mensagens. Não enviamos e-mails nem notificações push.',
  },
];

export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Termos de uso e privacidade" description="Atualizado em 22/10/2026" />
      <GlassCard className="space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-pasto">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-grafite/85">{s.body}</p>
          </section>
        ))}
      </GlassCard>
    </div>
  );
}
