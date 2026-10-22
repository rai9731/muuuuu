import { api } from './api';
import type { Conversation, Message } from './types';

export const messageService = {
  conversations: () => api.get<{ data: Conversation[] }>('/conversations').then((r) => r.data),

  start: (cowId: number, body: string) =>
    api.post<{ data: Conversation }>('/conversations', { cow_id: cowId, body }).then((r) => r.data),

  messages: (conversationId: number) =>
    api.get<{ data: Message[]; conversation: Conversation }>(`/conversations/${conversationId}`),

  send: (conversationId: number, body: string) =>
    api.post<{ data: Message }>(`/conversations/${conversationId}/messages`, { body }).then((r) => r.data),
};
