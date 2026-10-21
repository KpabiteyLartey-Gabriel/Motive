'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { marketplaceApi, resolveVehiclePhoto } from '@/lib/api';

const MODEL_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };
const INTEREST_BADGE = {
  PENDING: 'text-amber-600 dark:text-amber-400',
  APPROVED: 'text-green-600 dark:text-green-400',
  DECLINED: 'text-red-500',
  RELEASED: 'text-neutral-500',
};

export default function ChatWorkspace({ user }) {
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  const loadThreads = useCallback(async (keepActive = true) => {
    try {
      const res = await marketplaceApi.threads();
      const list = res.data?.data || [];
      setThreads(list);
      if (!keepActive || !activeId) {
        const fromQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('thread') : null;
        const wanted = fromQuery && list.some((t) => t.id === fromQuery) ? fromQuery : list[0]?.id;
        if (wanted) setActiveId(wanted);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (user) loadThreads(false); }, [user, loadThreads]);

  const loadMessages = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await marketplaceApi.messages(activeId);
      setMessages(res.data?.data?.messages || []);
    } catch {}
  }, [activeId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => {
    const t = setInterval(() => { loadThreads(); loadMessages(); }, 9000);
    return () => clearInterval(t);
  }, [loadThreads, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const active = threads.find((t) => t.id === activeId) || null;

  const send = async (extra = {}) => {
    const body = (extra.body ?? draft).trim();
    if (!activeId || (!body && !extra.attachmentUrl)) return;
    setBusy(true);
    setError('');
    try {
      await marketplaceApi.sendMessage(activeId, { body: body || undefined, attachmentUrl: extra.attachmentUrl, attachmentName: extra.attachmentName });
      setDraft('');
      await loadMessages();
      loadThreads();
    } catch (e) {
      setError(e.response?.data?.message || 'Message failed to send.');
    } finally {
      setBusy(false);
    }
  };

  const attach = async (file) => {
    if (!file || !activeId) return;
    setBusy(true);
    setError('');
    try {
      const up = await marketplaceApi.uploadAttachment(activeId, file);
      const d = up.data?.data || {};
      await marketplaceApi.sendMessage(activeId, { attachmentUrl: d.url, attachmentName: d.name || file.name });
      await loadMessages();
      loadThreads();
    } catch (e) {
      setError(e.response?.data?.message || 'Document upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden bg-white dark:bg-dark-surface" style={{ height: '68vh' }}>
      {/* Thread list */}
      <div className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-col border-r border-neutral-200 dark:border-dark-border`}>
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-dark-border text-sm font-semibold text-neutral-800 dark:text-neutral-100">Conversations</div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 && <p className="px-4 py-6 text-sm text-neutral-500">No conversations yet. When a driver shows interest in a vehicle, your chat with them appears here.</p>}
          {threads.map((t) => {
            const other = t.otherParty;
            const name = other ? `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'User' : 'User';
            return (
              <button key={t.id} onClick={() => setActiveId(t.id)} className={`w-full text-left px-4 py-3 border-b border-neutral-100 dark:border-dark-border hover:bg-neutral-50 dark:hover:bg-dark-card ${t.id === activeId ? 'bg-brand-50 dark:bg-dark-card' : ''}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{name}</span>
                  {t.unreadCount > 0 && <span className="text-[11px] bg-brand-600 text-white rounded-full px-2 py-0.5">{t.unreadCount}</span>}
                </span>
                <span className="block text-xs text-neutral-500 truncate">{t.vehicle?.make} {t.vehicle?.model} · {t.vehicle?.registrationNumber} · {MODEL_LABEL[t.vehicle?.operatingModel] || ''}</span>
                <span className="block text-xs text-neutral-400 truncate">{t.lastMessage?.body || (t.lastMessage?.attachmentName ? `Document: ${t.lastMessage.attachmentName}` : 'Say hello')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation */}
      <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {active ? (
          <>
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-dark-border flex items-center gap-3">
              <button className="md:hidden text-sm text-neutral-500" onClick={() => setActiveId(null)}>← Back</button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                  {active.otherParty ? `${active.otherParty.firstName || ''} ${active.otherParty.lastName || ''}`.trim() : 'Conversation'}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {active.vehicle?.make} {active.vehicle?.model} ({active.vehicle?.registrationNumber}) · {MODEL_LABEL[active.vehicle?.operatingModel] || ''}
                  {active.interest?.status && <span className={`ml-2 font-medium ${INTEREST_BADGE[active.interest.status] || ''}`}>{active.interest.status}</span>}
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-neutral-50 dark:bg-dark-bg">
              {messages.map((m) => {
                const mine = m.senderUserId === user?.id;
                const isImage = m.attachmentUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(m.attachmentUrl);
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm ${mine ? 'bg-brand-600 text-white rounded-br-md' : 'bg-white dark:bg-dark-card text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-dark-border rounded-bl-md'}`}>
                      {m.attachmentUrl && (
                        isImage
                          ? <a href={resolveVehiclePhoto(m.attachmentUrl)} target="_blank" rel="noreferrer"><img src={resolveVehiclePhoto(m.attachmentUrl)} alt="" className="rounded-lg mb-1 max-h-44 object-cover" /></a>
                          : <a href={resolveVehiclePhoto(m.attachmentUrl)} target="_blank" rel="noreferrer" className={`block underline mb-1 ${mine ? 'text-white' : 'text-brand-700 dark:text-brand-300'}`}>{m.attachmentName || 'Document'}</a>
                      )}
                      {m.body && <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                      <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-neutral-400'}`}>{new Date(m.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {error && <p className="px-4 py-2 text-xs text-red-500">{error}</p>}
            <div className="px-3 py-3 border-t border-neutral-200 dark:border-dark-border flex items-end gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-graphite text-xs disabled:opacity-40" title="Send a document (contract, ID, etc.)">Attach</button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
              <textarea
                className="input flex-1"
                rows={1}
                placeholder="Write a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <button onClick={() => send()} disabled={busy || !draft.trim()} className="btn-primary text-sm disabled:opacity-40">{busy ? 'Sending…' : 'Send'}</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 px-6 text-center">Select a conversation to read and reply.</div>
        )}
      </div>
    </div>
  );
}
