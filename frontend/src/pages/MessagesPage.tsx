import { MessageCircle, Plus, Send } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { useAsync } from '../features/common/useAsync';
import { AppHeader } from '../features/layout/AppHeader';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { ConversationMessage, ConversationSummary } from '../types';

function formatMessageDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const { data: conversationData, loading, error } = useAsync(() => api.getConversations(), []);
  const { data: contactData, error: contactsError } = useAsync(() => api.getMessageContacts(), []);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [thread, setThread] = useState<ConversationMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [sending, setSending] = useState(false);
  const selected = useMemo(() => conversations.find((item) => item.id === selectedId), [conversations, selectedId]);
  const { data: threadData, loading: threadLoading, error: threadError } = useAsync(
    () => selectedId ? api.getConversationMessages(selectedId) : Promise.resolve([]),
    [selectedId],
  );

  useEffect(() => {
    if (conversationData) {
      setConversations(conversationData);
      setSelectedId((current) => current || conversationData[0]?.id || '');
    }
  }, [conversationData]);

  useEffect(() => {
    if (threadData) setThread(threadData);
  }, [threadData]);

  useEffect(() => {
    if (!selected || selected.unreadCount === 0) return;
    api.markConversationRead(selected.id)
      .then(() => setConversations((current) => current.map((item) => item.id === selected.id ? { ...item, unreadCount: 0 } : item)))
      .catch((reason: unknown) => setActionError(reason instanceof Error ? reason.message : 'Không thể đánh dấu đã đọc.'));
  }, [selected]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = messageText.trim();
    if (!selected || !body) return;
    setSending(true);
    setActionError('');
    try {
      const sent = await api.sendMessage(selected.id, body);
      setThread((current) => [...current, sent]);
      setConversations((current) => current.map((item) => item.id === selected.id
        ? { ...item, lastMessage: sent.body, lastMessageAt: sent.sentAt }
        : item));
      setMessageText('');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isVi ? 'Không thể gửi tin nhắn.' : 'Unable to send message.'));
    } finally {
      setSending(false);
    }
  };

  const startConversation = async (event: FormEvent) => {
    event.preventDefault();
    const message = newMessageText.trim();
    if (!recipientId || !message) return;
    setSending(true);
    setActionError('');
    try {
      const conversation = await api.createConversation({ recipientId, message });
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
      setSelectedId(conversation.id);
      setNewOpen(false);
      setRecipientId('');
      setNewMessageText('');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isVi ? 'Không thể tạo cuộc trò chuyện.' : 'Unable to start conversation.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <AppHeader />
      <main className="container messages-page">
        <div className="messages-page-heading">
          <div><span className="profile-kicker">G4LMS</span><h1>{isVi ? 'Hộp thư' : 'Inbox'}</h1></div>
          <button type="button" className="btn btn-primary" onClick={() => setNewOpen((open) => !open)}>
            <Plus size={14} />{isVi ? 'Tin nhắn mới' : 'New message'}
          </button>
        </div>
        {(error || contactsError || threadError) && <p className="form-error" role="alert">{error?.message ?? contactsError?.message ?? threadError?.message}</p>}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}

        {newOpen && (
          <form className="new-conversation-card" onSubmit={startConversation}>
            <h2>{isVi ? 'Bắt đầu cuộc trò chuyện' : 'Start a conversation'}</h2>
            <label>{isVi ? 'Người nhận' : 'Recipient'}
              <select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>
                <option value="">{isVi ? 'Chọn người nhận' : 'Select a recipient'}</option>
                {(contactData ?? []).map((contact) => (
                  <option value={contact.id} key={contact.id}>{contact.name}{contact.courseCode ? ` · ${contact.courseCode}` : ''}</option>
                ))}
              </select>
            </label>
            <label>{isVi ? 'Tin nhắn đầu tiên' : 'First message'}
              <textarea required maxLength={4000} rows={3} value={newMessageText} onChange={(event) => setNewMessageText(event.target.value)} />
            </label>
            <div className="message-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setNewOpen(false)}>{isVi ? 'Hủy' : 'Cancel'}</button>
              <button type="submit" className="btn btn-primary" disabled={sending || !recipientId || !newMessageText.trim()}>
                <Send size={14} />{isVi ? 'Gửi tin nhắn' : 'Send message'}
              </button>
            </div>
          </form>
        )}

        <section className="messages-workspace">
          <aside className="conversation-list" aria-label={isVi ? 'Danh sách cuộc trò chuyện' : 'Conversation list'}>
            <div className="conversation-list-heading"><MessageCircle size={16} /><strong>{isVi ? 'Cuộc trò chuyện' : 'Conversations'}</strong></div>
            {loading && <p className="muted">{isVi ? 'Đang tải hộp thư...' : 'Loading inbox...'}</p>}
            {conversations.map((conversation) => (
              <button type="button" key={conversation.id} className={`conversation-list-item${selectedId === conversation.id ? ' active' : ''}`}
                onClick={() => setSelectedId(conversation.id)}>
                <span className="conversation-avatar">{conversation.initials}</span>
                <span className="conversation-list-copy">
                  <strong>{conversation.participantName}</strong>
                  <span>{conversation.courseCode ?? (isVi ? 'Trao đổi' : 'Message')}</span>
                  <small>{conversation.lastMessage}</small>
                </span>
                {conversation.unreadCount > 0 && <span className="conversation-unread">{conversation.unreadCount}</span>}
              </button>
            ))}
            {!loading && !conversations.length && <p className="muted conversation-empty">{isVi ? 'Chưa có cuộc trò chuyện.' : 'No conversations yet.'}</p>}
          </aside>

          <section className="conversation-thread">
            {selected ? (
              <>
                <header className="conversation-thread-heading">
                  <span className="conversation-avatar">{selected.initials}</span>
                  <div><strong>{selected.participantName}</strong><span>{selected.courseCode ?? (isVi ? 'Tin nhắn trực tiếp' : 'Direct message')}</span></div>
                </header>
                <div className="conversation-messages" aria-live="polite">
                  {threadLoading && <p className="muted">{isVi ? 'Đang tải tin nhắn...' : 'Loading messages...'}</p>}
                  {thread.map((message) => {
                    const mine = message.senderId === user?.id;
                    return (
                      <article key={message.id} className={`conversation-message${mine ? ' mine' : ''}`}>
                        <div className="conversation-message-meta"><strong>{mine ? user?.name : message.senderName}</strong><time>{formatMessageDate(message.sentAt, language)}</time></div>
                        <p>{message.body}</p>
                      </article>
                    );
                  })}
                  {!threadLoading && !thread.length && <p className="muted conversation-empty">{isVi ? 'Chưa có tin nhắn. Hãy gửi lời chào đầu tiên.' : 'No messages yet. Send the first message.'}</p>}
                </div>
                <form className="conversation-reply" onSubmit={send}>
                  <label htmlFor="conversation-reply">{isVi ? 'Nội dung tin nhắn' : 'Message'}</label>
                  <textarea id="conversation-reply" rows={2} maxLength={4000} value={messageText}
                    onChange={(event) => setMessageText(event.target.value)} placeholder={isVi ? 'Nhập tin nhắn...' : 'Write a message...'} />
                  <button type="submit" className="btn btn-primary" disabled={sending || !messageText.trim()}>
                    <Send size={14} />{isVi ? 'Gửi' : 'Send'}
                  </button>
                </form>
              </>
            ) : (
              <div className="conversation-no-selection"><MessageCircle size={28} /><p>{isVi ? 'Chọn một cuộc trò chuyện để xem tin nhắn.' : 'Select a conversation to view messages.'}</p></div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
