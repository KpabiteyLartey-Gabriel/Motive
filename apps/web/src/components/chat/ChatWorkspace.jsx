'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { marketplaceApi, resolveVehiclePhoto } from '@/lib/api';

function fmtRec(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ClipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.4 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.2-9.19a4 4 0 015.65 5.66l-9.2 9.19a2 2 0 01-2.82-2.83l8.49-8.48" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0014 0M12 19v3" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.4 20.4l17.8-7.5c.8-.35.8-1.45 0-1.8L3.4 3.6c-.66-.29-1.39.2-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .72.73 1.2 1.39.91z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  );
}

const MODEL_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };

function fmtRoleWord(role) {
  return String(role || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function Avatar({ person, size = 'w-10 h-10 text-sm' }) {
  const name = person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  if (person?.profilePhotoUrl) {
    return <img src={resolveVehiclePhoto(person.profilePhotoUrl)} alt={name || 'Profile photo'} className={`${size} rounded-full object-cover shrink-0`} />;
  }
  return <span className={`${size} rounded-full bg-brand-100 dark:bg-dark-card text-brand-800 dark:text-brand-300 font-semibold flex items-center justify-center shrink-0`}>{initials}</span>;
}

function AccountChips({ accounts }) {
  if (!accounts?.length) return null;
  return (
    <span className="flex flex-wrap gap-1 mt-1">
      {accounts.map((a, i) => (
        <span key={`${a.type}-${a.label}-${i}`} className="text-[10px] font-medium rounded-full bg-neutral-100 dark:bg-dark-card border border-neutral-200 dark:border-dark-border text-neutral-700 dark:text-neutral-200 px-2 py-0.5">
          {a.type === 'COMPANY' ? `${a.label}${a.role ? ` · ${fmtRoleWord(a.role)}` : ''}` : a.label}
          {a.detail && a.type === 'SERVICE_PROVIDER' ? ` · ${fmtRoleWord(a.detail)}` : ''}
          {a.verified ? ' · identity verified' : ''}
        </span>
      ))}
    </span>
  );
}
const INTEREST_BADGE = {
  PENDING: 'text-amber-600 dark:text-amber-400',
  APPROVED: 'text-green-600 dark:text-green-400',
  DECLINED: 'text-red-500',
  RELEASED: 'text-neutral-500',
};

export default function ChatWorkspace({ user, emptyText = 'No conversations yet. When a driver shows interest in a vehicle, your chat with them appears here.' }) {
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Chat username: undefined = still checking, '' = not created yet.
  const [chatName, setChatName] = useState(undefined);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [peopleBusy, setPeopleBusy] = useState(false);
  const [peopleMsg, setPeopleMsg] = useState('');
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

  useEffect(() => {
    if (!user) return;
    marketplaceApi.chatUsername()
      .then((r) => setChatName(r.data?.data?.chatUsername || ''))
      .catch(() => setChatName(''));
  }, [user]);

  const createUsername = async () => {
    const value = usernameInput.trim().replace(/^@+/, '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9._]{2,19}$/.test(value)) {
      setUsernameError('Use 3-20 characters: lowercase letters, numbers, dots or underscores.');
      return;
    }
    setUsernameBusy(true);
    setUsernameError('');
    try {
      const r = await marketplaceApi.setChatUsername(value);
      setChatName(r.data?.data?.chatUsername || value);
      loadThreads(false);
    } catch (e) {
      const m = e.response?.data?.message;
      setUsernameError(Array.isArray(m) ? m.join(' ') : m || 'Could not create that username. Try another.');
    } finally { setUsernameBusy(false); }
  };

  const searchPeople = async () => {
    const q = peopleQuery.trim().replace(/^@+/, '');
    if (q.length < 2) { setPeopleMsg('Type at least 2 letters of their username.'); setPeople([]); return; }
    setPeopleBusy(true);
    setPeopleMsg('');
    try {
      const r = await marketplaceApi.searchChatUsers(q);
      const list = r.data?.data || [];
      setPeople(list);
      if (!list.length) setPeopleMsg('No one found with that username. Check the spelling.');
    } catch (e) {
      setPeopleMsg(e.response?.data?.message || 'Search failed. Try again.');
    } finally { setPeopleBusy(false); }
  };

  const startChat = async (person) => {
    setPeopleBusy(true);
    setPeopleMsg('');
    try {
      const r = await marketplaceApi.startDirectThread(person.chatUsername);
      const threadId = r.data?.data?.thread?.id;
      await loadThreads(false);
      if (threadId) setActiveId(threadId);
      setPeople([]);
      setPeopleQuery('');
    } catch (e) {
      setPeopleMsg(e.response?.data?.message || 'Could not open that chat.');
    } finally { setPeopleBusy(false); }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Voice notes (WhatsApp-style record & send) ──────────────
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const discardRef = useRef(false);
  const startedRef = useRef(0);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSec(Math.floor((Date.now() - startedRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [recording]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setError('Voice recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      discardRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stopStream();
        setRecording(false);
        if (discardRef.current) return;
        const type = recorder.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type });
        if (!blob.size) return;
        const file = new File([blob], `voice-note.${ext}`, { type });
        await attach(file);
      };
      recorderRef.current = recorder;
      startedRef.current = Date.now();
      setRecSec(0);
      recorder.start();
      setRecording(true);
    } catch {
      setError('Microphone access was denied. Allow microphone permission to send a voice note.');
    }
  };

  const stopRecording = (sendIt) => {
    discardRef.current = !sendIt;
    try { recorderRef.current?.stop(); } catch { setRecording(false); stopStream(); }
  };

  // Cancel any in-progress recording when switching conversations/unmounting.
  useEffect(() => {
    return () => { discardRef.current = true; try { recorderRef.current?.stop(); } catch {} stopStream(); };
  }, [activeId]);

  if (chatName === undefined) {
    return <div className="border border-neutral-200 dark:border-dark-border rounded-card bg-white dark:bg-dark-surface px-6 py-10 text-center text-sm text-neutral-500">Loading chat…</div>;
  }

  if (!chatName) {
    return (
      <div className="border border-neutral-200 dark:border-dark-border rounded-card bg-white dark:bg-dark-surface px-6 py-8 max-w-lg">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">Create your chat username</h2>
        <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
          This is your first visit to Chat. Choose one unique username — people will find and message you with it,
          and owners use it to share contracts with drivers. For example <b>@kwame.drives</b> or <b>@lartey.owner</b>.
          It shows only your name and username — never your phone, email or ID number.
        </p>
        <label className="block text-xs text-neutral-500 mt-5">Your unique username
          <span className="flex items-center gap-2 mt-1.5">
            <span className="text-sm text-neutral-400">@</span>
            <input
              className="input flex-1"
              placeholder="kwame.drives"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createUsername(); }}
              autoFocus
            />
          </span>
        </label>
        {usernameError && <p className="text-xs text-red-500 mt-2">{usernameError}</p>}
        <button onClick={createUsername} disabled={usernameBusy} className="btn-primary text-sm mt-4 disabled:opacity-40">
          {usernameBusy ? 'Creating…' : 'Create username and open Chat'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex border border-neutral-200 dark:border-dark-border rounded-card overflow-hidden bg-white dark:bg-dark-surface" style={{ height: '68vh' }}>
      {/* Thread list */}
      <div className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-col border-r border-neutral-200 dark:border-dark-border`}>
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-dark-border">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Conversations</p>
          <p className="text-xs text-neutral-400 mt-0.5">You are <span className="font-medium text-brand-700 dark:text-brand-300">@{chatName}</span></p>
          <div className="flex gap-1.5 mt-3">
            <input
              className="input flex-1 !py-1.5 text-xs"
              placeholder="Find a person by @username"
              value={peopleQuery}
              onChange={(e) => setPeopleQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') searchPeople(); }}
            />
            <button onClick={searchPeople} disabled={peopleBusy} className="btn-primary text-xs disabled:opacity-40">Find</button>
          </div>
          {peopleMsg && <p className="text-[11px] text-neutral-500 mt-1.5">{peopleMsg}</p>}
          {people.map((p) => (
            <div key={p.id} className="mt-2 border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <Avatar person={p} size="w-11 h-11 text-sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-neutral-800 dark:text-neutral-100 truncate">{`${p.firstName || ''} ${p.lastName || ''}`.trim() || 'User'}</span>
                  <span className="block text-[11px] text-neutral-400 truncate">@{p.chatUsername}</span>
                  <AccountChips accounts={p.accounts} />
                </span>
              </div>
              <button onClick={() => startChat(p)} disabled={peopleBusy} className="btn-primary w-full justify-center text-[11px] mt-2.5 disabled:opacity-40">Message @{p.chatUsername}</button>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 && <p className="px-4 py-6 text-sm text-neutral-500">{emptyText}</p>}
          {threads.map((t) => {
            const other = t.otherParty;
            const name = other ? `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'User' : 'User';
            return (
              <button key={t.id} onClick={() => setActiveId(t.id)} className={`w-full text-left px-4 py-3 border-b border-neutral-100 dark:border-dark-border hover:bg-neutral-50 dark:hover:bg-dark-card ${t.id === activeId ? 'bg-brand-50 dark:bg-dark-card' : ''}`}>
                <span className="flex items-center gap-2.5">
                  <Avatar person={other} size="w-9 h-9 text-xs" />
                  <span className="flex-1 text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{name}</span>
                  {t.unreadCount > 0 && <span className="text-[11px] bg-brand-600 text-white rounded-full px-2 py-0.5">{t.unreadCount}</span>}
                </span>
                <span className="block text-xs text-neutral-500 truncate">{other?.chatUsername ? `@${other.chatUsername} · ` : ''}{t.vehicle ? `${t.vehicle.make} ${t.vehicle.model} · ${t.vehicle.registrationNumber} · ${MODEL_LABEL[t.vehicle.operatingModel] || ''}` : 'Direct chat'}</span>
                <span className="block text-xs text-neutral-400 truncate">{t.lastMessage?.body || (t.lastMessage?.attachmentName ? (t.lastMessage.attachmentName.startsWith('voice-note') ? 'Voice note' : `${/\.(mp3|wav|m4a|aac|ogg|webm)(\?|$)/i.test(t.lastMessage.attachmentName) ? 'Audio' : 'Document'}: ${t.lastMessage.attachmentName}`) : 'Say hello')}</span>
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
              <Avatar person={active.otherParty} size="w-10 h-10 text-sm" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                  {active.otherParty ? `${active.otherParty.firstName || ''} ${active.otherParty.lastName || ''}`.trim() : 'Conversation'}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {active.otherParty?.chatUsername ? `@${active.otherParty.chatUsername} · ` : ''}
                  {active.vehicle ? `${active.vehicle.make} ${active.vehicle.model} (${active.vehicle.registrationNumber}) · ${MODEL_LABEL[active.vehicle.operatingModel] || ''}` : 'Direct chat'}
                  {active.interest?.status && <span className={`ml-2 font-medium ${INTEREST_BADGE[active.interest.status] || ''}`}>{active.interest.status}</span>}
                </p>
                <AccountChips accounts={active.otherParty?.accounts} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-neutral-50 dark:bg-dark-bg">
              {messages.map((m) => {
                const mine = m.senderUserId === user?.id;
                const isImage = m.attachmentUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(m.attachmentUrl);
                const isAudio = m.attachmentUrl && (m.attachmentName?.startsWith('voice-note') || /\.(mp3|wav|m4a|aac|ogg|opus|webm)(\?|$)/i.test(`${m.attachmentName || ''} ${m.attachmentUrl}`));
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm ${mine ? 'bg-brand-600 text-white rounded-br-md' : 'bg-white dark:bg-dark-card text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-dark-border rounded-bl-md'}`}>
                      {m.attachmentUrl && (
                        isAudio
                          ? <span className="block mb-1"><span className={`block text-xs mb-1 ${mine ? 'text-white/80' : 'text-neutral-500'}`}>{m.attachmentName?.startsWith('voice-note') ? 'Voice note' : (m.attachmentName || 'Audio message')}</span><audio controls preload="metadata" src={resolveVehiclePhoto(m.attachmentUrl)} className="w-56 max-w-full h-9" /></span>
                          : isImage
                          ? <a href={resolveVehiclePhoto(m.attachmentUrl)} target="_blank" rel="noreferrer"><img src={resolveVehiclePhoto(m.attachmentUrl)} alt="" className="rounded-lg mb-1 max-h-44 object-cover" /></a>
                          : <a href={resolveVehiclePhoto(m.attachmentUrl)} target="_blank" rel="noreferrer" className={`block underline mb-1 ${mine ? 'text-white' : 'text-brand-700 dark:text-brand-300'}`}>{m.attachmentName || 'Document'}</a>
                      )}
                      {(m.kind === 'CONTRACT' || m.contractId) && (
                        <span className={`block rounded-lg px-3 py-2 mb-2 text-xs font-semibold ${mine ? 'bg-white/15 text-white' : 'bg-brand-50 dark:bg-dark-bg text-brand-800 dark:text-brand-300'}`}>
                          Contract shared in this chat
                          {m.contractId && (
                            <a href={user?.primaryRole === 'DRIVER' ? `/driver/contracts?contract=${m.contractId}` : '/owner/contracts'} className="block mt-1 underline font-medium">Open the contract</a>
                          )}
                        </span>
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
            <div className="px-3 py-3 border-t border-neutral-200 dark:border-dark-border flex items-end gap-1.5">
              <input ref={fileRef} type="file" accept="image/*,application/pdf,audio/*" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ''; }} />
              {recording ? (
                <div className="flex items-center gap-3 flex-1 px-1">
                  <button type="button" onClick={() => stopRecording(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-dark-card" title="Delete recording" aria-label="Delete recording"><TrashIcon /></button>
                  <span className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-medium tabular-nums">{fmtRec(recSec)}</span>
                    <span className="text-neutral-400">Recording…</span>
                  </span>
                  <span className="flex-1" />
                  <button type="button" onClick={() => stopRecording(true)} className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700" title="Send voice note" aria-label="Send voice note"><SendIcon /></button>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-dark-card disabled:opacity-40" title="Attach a photo, document or audio file" aria-label="Attach a photo, document or audio file"><ClipIcon /></button>
                  <textarea
                    className="input flex-1 !rounded-full !px-4"
                    rows={1}
                    placeholder="Write a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                  {draft.trim() ? (
                    <button onClick={() => send()} disabled={busy} className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-40" title="Send message" aria-label="Send message"><SendIcon /></button>
                  ) : (
                    <button type="button" onClick={startRecording} disabled={busy} className="w-10 h-10 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-dark-card disabled:opacity-40" title="Record a voice note" aria-label="Record a voice note"><MicIcon /></button>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 px-6 text-center">Select a conversation to read and reply.</div>
        )}
      </div>
    </div>
  );
}
