import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '@services/notificationService';
import type { AppNotification } from '@services/types';
import { useAuth } from './useAuth';
import { useInterval } from './useInterval';
import { useToast } from './useToast';

interface UnreadContextValue {
  notifications: number;
  messages: number;
  refresh: () => void;
}

const UnreadContext = createContext<UnreadContextValue>({ notifications: 0, messages: 0, refresh: () => undefined });

const POLL_MS = 15000;

/**
 * Contadores do sino e das mensagens. Para o administrador, novas notificações
 * (ex.: nova vaca cadastrada) também aparecem como aviso flutuante em tempo real.
 */
export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });
  const lastId = useRef<number | null>(null);

  const announce = useCallback(
    (items: AppNotification[]) => {
      items.slice(0, 3).forEach((n) => {
        toast.show(
          'info',
          {
            title: n.title,
            description: n.body ?? undefined,
            image: n.image_url,
            action: { label: 'Ver', onClick: () => navigate(user?.role === 'admin' ? '/admin/notificacoes' : '/notificacoes') },
          },
          8000,
        );
      });
    },
    [toast, navigate, user?.role],
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notificationService.unreadCounts();
      setCounts({ notifications: data.notifications, messages: data.messages });
      const latest = data.latest_notification_id;
      if (lastId.current !== null && latest !== null && latest > lastId.current) {
        const fresh = await notificationService.since(lastId.current);
        announce(fresh);
      }
      if (latest !== null) lastId.current = latest;
      else if (lastId.current === null) lastId.current = 0;
    } catch {
      /* silencioso: o próximo ciclo tenta de novo */
    }
  }, [user, announce]);

  useEffect(() => {
    lastId.current = null;
    if (user) refresh();
    else setCounts({ notifications: 0, messages: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useInterval(refresh, user ? POLL_MS : null);

  return (
    <UnreadContext.Provider value={{ ...counts, refresh }}>{children}</UnreadContext.Provider>
  );
}

export const useUnreadCounts = () => useContext(UnreadContext);
