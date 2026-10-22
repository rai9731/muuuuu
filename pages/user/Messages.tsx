import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { messageService } from '@services/messageService';
import { errorMessage } from '@services/api';
import type { Conversation, Message } from '@services/types';
import { useAsync } from '@hooks/useAsync';
import { useInterval } from '@hooks/useInterval';
import { useToast } from '@hooks/useToast';
import { useUnreadCounts } from '@hooks/useUnreadCounts';
import { Button } from '@components/ui/Button';
import { Avatar, EmptyState, ErrorState, GlassCard, ListSkeleton, PageHeader } from '@components/ui/Display';
import { formatCurrency, formatRelative, formatTime } from '@utils/format';

function ConversationList({ items, activeId }: { items: Conversation[]; activeId?: number }) {
  return (
    <ul className="divide-y divide-pasto/10">
      {items.map((c) => (
        <li key={c.id}>
          <Link to={`/mensagens/${c.id}`} className={`flex gap-3 p-3 transition hover:bg-white/60 ${c.id === activeId ? 'bg-white/70' : ''}`}>
            <Avatar name={c.other.name} src={c.other.avatar_url} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-semibold">{c.other.name}</p>
                <span className="shrink-0 text-xs text-grafite/55">{formatRelative(c.updated_at)}</span>
              </div>
              <p className="truncate text-xs text-grafite/60">{c.cow.title} · {c.role === 'buyer' ? 'você compra' : 'você vende'}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-grafite/75">{c.last_message ? `${c.last_message.mine ? 'Você: ' : ''}${c.last_message.body}` : 'Sem mensagens'}</p>
                {c.unread_count > 0 && <span className="rounded-full bg-trigo px-2 py-0.5 text-xs font-bold">{c.unread_count}</span>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Thread({ id, onChanged }: { id: number; onChanged: () => void }) {
  const toast = useToast();
  const { refresh } = useUnreadCounts();
  const { data, loading, error, reload, setData } = useAsync(() => messageService.messages(id), [id]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) {
      refresh();
      onChanged();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!data]);
  useEffect(() => bottom.current?.scrollIntoView({ block: 'end' }), [data?.data.length]);

  // Atualiza a conversa aberta sem piscar a tela
  useInterval(() => {
    messageService.messages(id).then((res) => setData(res)).catch(() => undefined);
  }, 8000);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const msg: Message = await messageService.send(id, body);
      setData((prev) => (prev ? { ...prev, data: [...prev.data, msg] } : prev!));
      setText('');
      onChanged();
    } catch (err) {
      toast.error('Não foi possível enviar', errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <ListSkeleton rows={4} />;
  const conv = data!.conversation;

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex items-center gap-3 border-b border-pasto/10 p-3">
        <Link to="/mensagens" className="md:hidden" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
        <Avatar name={conv.other.name} src={conv.other.avatar_url} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{conv.other.name}</p>
          <Link to={`/anuncios/${conv.cow.id}`} className="truncate text-xs text-pasto hover:underline">{conv.cow.title} · {formatCurrency(conv.cow.price)}</Link>
        </div>
      </div>
      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-4">
        {data!.data.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? 'bg-pasto text-white' : 'bg-white text-grafite shadow-sm'}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-right text-[10px] ${m.mine ? 'text-white/70' : 'text-grafite/50'}`}>{formatTime(m.created_at)}</p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-pasto/10 p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Escreva uma mensagem…" aria-label="Mensagem"
          className="h-11 flex-1 rounded-xl border border-pasto/15 bg-white/70 px-3.5 text-sm focus:border-folha focus:outline-none focus:ring-2 focus:ring-folha/25" />
        <Button type="submit" loading={sending} disabled={!text.trim()} icon={<Send className="h-4 w-4" />}>Enviar</Button>
      </form>
    </div>
  );
}

export default function Messages() {
  const { id } = useParams();
  const navigate = useNavigate();
  const activeId = id ? Number(id) : undefined;
  const { data, loading, error, reload } = useAsync(() => messageService.conversations(), []);
  const [silent, setSilent] = useState<Conversation[] | null>(null);
  const items = silent ?? data ?? [];

  const refreshList = () => messageService.conversations().then(setSilent).catch(() => undefined);
  useInterval(refreshList, 15000);

  useEffect(() => {
    if (activeId && data && !data.some((c) => c.id === activeId)) refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (error) return <GlassCard><ErrorState message={error} onRetry={reload} /></GlassCard>;

  return (
    <div>
      <PageHeader title="Mensagens" description="Converse com compradores e vendedores sobre os anúncios." />
      {loading ? <GlassCard><ListSkeleton rows={4} /></GlassCard> : !items.length ? (
        <GlassCard>
          <EmptyState title="Nenhuma conversa ainda" description="Abra um anúncio e envie uma mensagem ao vendedor." action={<Button onClick={() => navigate('/anuncios')}>Ver anúncios</Button>} />
        </GlassCard>
      ) : (
        <GlassCard padded={false} className="grid overflow-hidden md:grid-cols-[320px_1fr]">
          <div className={`${activeId ? 'hidden md:block' : ''} max-h-[70vh] overflow-y-auto border-pasto/10 md:border-r`}>
            <ConversationList items={items} activeId={activeId} />
          </div>
          <div className={activeId ? '' : 'hidden md:block'}>
            {activeId ? <Thread key={activeId} id={activeId} onChanged={refreshList} /> : (
              <div className="flex h-full min-h-64 items-center justify-center p-6 text-sm text-grafite/60">Selecione uma conversa.</div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
