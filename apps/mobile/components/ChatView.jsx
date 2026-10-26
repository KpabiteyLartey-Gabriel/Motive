import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, Linking, Image, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { useTheme, palette } from '../lib/theme';
import { useAuth } from '../lib/useAuth';
import { marketplaceApi, resolveVehiclePhoto } from '../lib/api';

const MODEL_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };

function fmtRoleWord(role) {
  return String(role || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Avatar({ person, size = 40, colors }) {
  const name = person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  if (person?.profilePhotoUrl) {
    return <Image source={{ uri: resolveVehiclePhoto(person.profilePhotoUrl) }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={name || 'Profile photo'} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors?.brandSoft || '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: palette.brand, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export function AccountChips({ accounts, colors }) {
  if (!accounts?.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {accounts.map((a, i) => (
        <View key={`${a.type}-${a.label}-${i}`} style={{ borderWidth: 1, borderColor: colors?.border, backgroundColor: colors?.card, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ color: colors?.textSecondary, fontSize: 10, fontWeight: '600' }}>
            {a.type === 'COMPANY' ? `${a.label}${a.role ? ` · ${fmtRoleWord(a.role)}` : ''}` : a.label}
            {a.detail && a.type === 'SERVICE_PROVIDER' ? ` · ${fmtRoleWord(a.detail)}` : ''}
            {a.verified ? ' · identity verified' : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function fmtDur(ms) {
  const total = Math.floor((ms || 0) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function isAudioAttachment(name, url) {
  const hay = `${name || ''} ${url || ''}`;
  return (name || '').startsWith('voice-note') || /\.(mp3|wav|m4a|aac|ogg|opus|webm)(\?|$)/i.test(hay);
}

/** Inline voice-note player — plays right inside the message bubble. */
function VoiceNotePlayer({ url, mine, colors, label }) {
  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || 0;
  const progress = duration > 0 ? Math.min(1, (status.currentTime || 0) / duration) : 0;

  const toggle = () => {
    try {
      if (status.playing) { player.pause(); return; }
      if (status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.05)) player.seekTo(0);
      player.play();
    } catch {}
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4, minWidth: 190 }}>
      <TouchableOpacity onPress={toggle} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: mine ? '#ffffff33' : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color={mine ? '#fff' : palette.brand} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: mine ? '#ffffff44' : colors.border, overflow: 'hidden' }}>
          <View style={{ height: 4, width: `${Math.round(progress * 100)}%`, backgroundColor: mine ? '#fff' : palette.brand }} />
        </View>
        <Text style={{ color: mine ? '#D1FAE5' : colors.textMuted, fontSize: 11, marginTop: 4 }}>
          {label} · {fmtDur((status.currentTime || 0) * 1000)}{duration > 0 ? ` / ${fmtDur(duration * 1000)}` : ''}
        </Text>
      </View>
    </View>
  );
}

export default function ChatView({ isOwner }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  // Chat username: undefined = still checking, '' = not created yet.
  const [chatName, setChatName] = useState(undefined);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [peopleBusy, setPeopleBusy] = useState(false);
  const [peopleMsg, setPeopleMsg] = useState('');
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  // Android (Expo Go, edge-to-edge): KeyboardAvoidingView's height mode does
  // not reliably lift the composer, so measure the keyboard ourselves and
  // pad the conversation by exactly that height. iOS keeps the KAV padding.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'ios') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates?.height || 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const res = await marketplaceApi.threads();
      const list = res.data?.data || [];
      setThreads(list);
      if (params.thread) {
        const t = list.find((x) => x.id === params.thread);
        if (t) setActive((prev) => prev || t);
      }
    } catch {}
  }, [params.thread]);

  const loadMessages = useCallback(async () => {
    if (!active) return;
    try {
      const res = await marketplaceApi.messages(active.id);
      setMessages(res.data?.data?.messages || []);
    } catch {}
  }, [active]);

  useEffect(() => { if (user) loadThreads(); }, [user, loadThreads]);

  useEffect(() => {
    if (!user) return;
    marketplaceApi.chatUsername()
      .then((r) => setChatName(r.data?.data?.chatUsername || ''))
      .catch(() => setChatName(''));
  }, [user]);

  const createUsername = async () => {
    const value = usernameInput.trim().replace(/^@+/, '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9._]{2,19}$/.test(value)) {
      Alert.alert('Choose a username', 'Use 3-20 characters: lowercase letters, numbers, dots or underscores.');
      return;
    }
    setUsernameBusy(true);
    try {
      const r = await marketplaceApi.setChatUsername(value);
      setChatName(r.data?.data?.chatUsername || value);
      loadThreads();
    } catch (e) {
      const m = e.response?.data?.message;
      Alert.alert('Could not create username', Array.isArray(m) ? m.join(' ') : m || 'Try another username.');
    }
    setUsernameBusy(false);
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
    }
    setPeopleBusy(false);
  };

  const startChat = async (person) => {
    setPeopleBusy(true);
    try {
      const r = await marketplaceApi.startDirectThread(person.chatUsername);
      const thread = r.data?.data?.thread;
      await loadThreads();
      if (thread?.id) setActive({ ...thread, otherParty: person, vehicle: thread.vehicle || null });
      setPeople([]);
      setPeopleQuery('');
    } catch (e) {
      Alert.alert('Could not open chat', e.response?.data?.message || 'Please try again.');
    }
    setPeopleBusy(false);
  };
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => {
    const t = setInterval(() => { loadThreads(); loadMessages(); }, 10000);
    return () => clearInterval(t);
  }, [loadThreads, loadMessages]);

  const send = async (extra = {}) => {
    const body = (extra.body ?? draft).trim();
    if (!active || (!body && !extra.attachmentUrl)) return;
    setBusy(true);
    try {
      await marketplaceApi.sendMessage(active.id, { body: body || undefined, attachmentUrl: extra.attachmentUrl, attachmentName: extra.attachmentName });
      setDraft('');
      loadMessages();
      loadThreads();
    } catch (e) {
      Alert.alert('Message failed', e.response?.data?.message || 'Please try again.');
    }
    setBusy(false);
  };

  const sendFile = async (uri, name, type) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', { uri, name: name || 'file', type: type || 'application/octet-stream' });
      const up = await marketplaceApi.uploadAttachment(active.id, form);
      const d = up.data?.data || {};
      await marketplaceApi.sendMessage(active.id, { attachmentUrl: d.url, attachmentName: d.name || name || 'File' });
      loadMessages();
      loadThreads();
    } catch (e) {
      Alert.alert('Upload failed', e.response?.data?.message || 'Could not send that file. Audio, images and PDF up to 10MB are supported.');
    }
    setBusy(false);
  };

  const attachPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to send documents.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    sendFile(asset.uri, asset.fileName || 'document.jpg', asset.mimeType || 'image/jpeg');
  };

  const attachFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) { Alert.alert('File too large', 'Attachments can be up to 10MB.'); return; }
      sendFile(asset.uri, asset.name || 'audio', asset.mimeType || 'audio/mpeg');
    } catch (e) {
      Alert.alert('Could not open files', 'Please try again.');
    }
  };

  const attach = () => {
    Alert.alert('Send attachment', 'Choose what to send in this chat', [
      { text: 'Photo or image', onPress: attachPhoto },
      { text: 'Audio or PDF file', onPress: attachFile },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Voice notes (WhatsApp-style record & send) ──────────────
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(audioRecorder);

  const startRecording = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Microphone needed', 'Allow microphone access to record a voice note.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e) {
      Alert.alert('Could not start recording', 'Voice recording is not available right now.');
    }
  };

  const stopRecording = async (sendIt) => {
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = audioRecorder.uri;
      if (sendIt && uri) {
        await sendFile(uri, 'voice-note.m4a', 'audio/m4a');
      }
    } catch (e) {
      Alert.alert('Recording failed', 'That voice note could not be saved.');
    }
  };

  const act = async (action) => {
    if (!active?.interest?.id) return;
    try {
      if (action === 'approve') await marketplaceApi.approveInterest(active.interest.id);
      if (action === 'decline') await marketplaceApi.declineInterest(active.interest.id);
      if (action === 'release') await marketplaceApi.releaseInterest(active.interest.id);
      loadThreads();
      setActive((prev) => prev ? { ...prev, interest: { ...prev.interest, status: action === 'approve' ? 'APPROVED' : action === 'decline' ? 'DECLINED' : 'RELEASED' } } : prev);
    } catch (e) {
      Alert.alert('Action failed', e.response?.data?.message || 'Please try again.');
    }
  };

  if (chatName === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={palette.brand} />
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }}>Loading chat…</Text>
      </View>
    );
  }

  if (!chatName) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20 }}>
        <View style={[s.cardBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>Create your chat username</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 8 }}>
            This is your first visit to Chat. Choose one unique username — people will find and message you with it,
            and owners use it to share contracts with drivers. For example @kwame.drives or @lartey.owner.
            It shows only your name and username — never your phone, email or ID number.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>@</Text>
            <TextInput
              style={[s.usernameInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="kwame.drives"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={usernameInput}
              onChangeText={setUsernameInput}
              onSubmitEditing={createUsername}
            />
          </View>
          <TouchableOpacity onPress={createUsername} disabled={usernameBusy} style={[s.actionBtnLarge, { backgroundColor: palette.brand, opacity: usernameBusy ? 0.5 : 1 }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{usernameBusy ? 'Creating…' : 'Create username and open Chat'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!active) {
    return (
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16 }}
        data={threads}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={(
          <View style={[s.cardBox, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 14 }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Find a person</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>You are <Text style={{ color: palette.brand, fontWeight: '700' }}>@{chatName}</Text> — search by username to message a driver or an owner.</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TextInput
                style={[s.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder="Find by @username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={peopleQuery}
                onChangeText={setPeopleQuery}
                onSubmitEditing={searchPeople}
              />
              <TouchableOpacity onPress={searchPeople} disabled={peopleBusy} style={[s.actionBtnLarge, { backgroundColor: palette.brand, marginTop: 0, paddingHorizontal: 18, opacity: peopleBusy ? 0.5 : 1 }]}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Find</Text>
              </TouchableOpacity>
            </View>
            {!!peopleMsg && <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>{peopleMsg}</Text>}
            {people.map((p) => (
              <View key={p.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12, paddingTop: 12 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Avatar person={p} size={44} colors={colors} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{`${p.firstName || ''} ${p.lastName || ''}`.trim() || 'User'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>@{p.chatUsername}</Text>
                    <AccountChips accounts={p.accounts} colors={colors} />
                  </View>
                </View>
                <TouchableOpacity onPress={() => startChat(p)} disabled={peopleBusy} style={[s.actionBtnLarge, { backgroundColor: palette.brand }]}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Message @{p.chatUsername}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>No conversations yet. Search for a person by their @username above, or wait for a driver to show interest in a vehicle.</Text>}
        renderItem={({ item }) => {
          const name = item.otherParty ? `${item.otherParty.firstName || ''} ${item.otherParty.lastName || ''}`.trim() : 'User';
          return (
            <TouchableOpacity onPress={() => setActive(item)} activeOpacity={0.8} style={[s.thread, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Avatar person={item.otherParty} size={42} colors={colors} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.otherParty?.chatUsername ? `@${item.otherParty.chatUsername} · ` : ''}{item.vehicle ? `${item.vehicle.make} ${item.vehicle.model} · ${item.vehicle.registrationNumber} · ${MODEL_LABEL[item.vehicle.operatingModel] || ''}` : 'Direct chat'}</Text>
                <AccountChips accounts={item.otherParty?.accounts} colors={colors} />
                <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.lastMessage?.body || (item.lastMessage?.attachmentName ? (item.lastMessage.attachmentName.startsWith('voice-note') ? 'Voice note' : `${/\.(mp3|wav|m4a|aac|ogg|webm)(\?|$)/i.test(item.lastMessage.attachmentName) ? 'Audio' : 'Document'}: ${item.lastMessage.attachmentName}`) : 'Say hello')}</Text>
              </View>
              {item.unreadCount > 0 && <View style={[s.unread, { backgroundColor: palette.brand }]}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{item.unreadCount}</Text></View>}
            </TouchableOpacity>
          );
        }}
      />
    );
  }


  const otherName = active.otherParty ? `${active.otherParty.firstName || ''} ${active.otherParty.lastName || ''}`.trim() : 'Conversation';
  const status = active.interest?.status;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: Platform.OS === 'android' ? kbHeight : 0 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setActive(null)}><Text style={{ color: palette.brand, fontWeight: '700', fontSize: 14 }}>‹ Chats</Text></TouchableOpacity>
        <View style={{ marginLeft: 10 }}><Avatar person={active.otherParty} size={38} colors={colors} /></View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{otherName}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{active.otherParty?.chatUsername ? `@${active.otherParty.chatUsername} · ` : ''}{active.vehicle ? `${active.vehicle.make} ${active.vehicle.model} (${active.vehicle.registrationNumber})` : 'Direct chat'}{status ? ` · ${status}` : ''}</Text>
          <AccountChips accounts={active.otherParty?.accounts} colors={colors} />
        </View>
      </View>

      {isOwner && status === 'PENDING' && (
        <View style={[s.actions, { backgroundColor: colors.brandSoft }]}>
          <Text style={{ color: colors.brandText, fontSize: 12, flex: 1 }}>This driver wants your vehicle. Approving removes it from Explore.</Text>
          <TouchableOpacity onPress={() => act('approve')} style={[s.actionBtn, { backgroundColor: palette.brand }]}><Text style={s.actionText}>Approve</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => act('decline')} style={[s.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}><Text style={[s.actionText, { color: colors.textPrimary }]}>Decline</Text></TouchableOpacity>
        </View>
      )}
      {isOwner && status === 'APPROVED' && (
        <View style={[s.actions, { backgroundColor: colors.brandSoft }]}>
          <Text style={{ color: colors.brandText, fontSize: 12, flex: 1 }}>Approved for this vehicle. Create the contract under Contracts, generate their code and share it here.</Text>
          <TouchableOpacity onPress={() => act('release')} style={[s.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}><Text style={[s.actionText, { color: colors.textPrimary }]}>Release</Text></TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14 }}
        keyboardShouldPersistTaps="handled"
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.senderUserId === user?.id;
          const isImage = item.attachmentUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(item.attachmentUrl);
          const isAudio = item.attachmentUrl && isAudioAttachment(item.attachmentName, item.attachmentUrl);
          return (
            <View style={[s.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              <View style={[s.bubble, mine ? { backgroundColor: palette.brand, borderBottomRightRadius: 4 } : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 }]}>
                {item.attachmentUrl && (isAudio
                  ? <VoiceNotePlayer url={resolveVehiclePhoto(item.attachmentUrl)} mine={mine} colors={colors} label={item.attachmentName?.startsWith('voice-note') ? 'Voice note' : (item.attachmentName || 'Audio message')} />
                  : isImage
                  ? <TouchableOpacity onPress={() => Linking.openURL(resolveVehiclePhoto(item.attachmentUrl))}><Image source={{ uri: resolveVehiclePhoto(item.attachmentUrl) }} style={{ width: 170, height: 110, borderRadius: 8, marginBottom: 4 }} /></TouchableOpacity>
                  : <Text onPress={() => Linking.openURL(resolveVehiclePhoto(item.attachmentUrl))} style={{ color: mine ? '#D1FAE5' : palette.brand, textDecorationLine: 'underline', fontSize: 13, marginBottom: 4 }}>{item.attachmentName || 'Document'}</Text>)}
                {(item.kind === 'CONTRACT' || item.contractId) && (
                  <View style={{ borderRadius: 10, padding: 10, marginBottom: 6, backgroundColor: mine ? '#ffffff26' : colors.brandSoft }}>
                    <Text style={{ color: mine ? '#fff' : colors.brandText, fontWeight: '800', fontSize: 12 }}>Contract shared in this chat</Text>
                    {!!item.contractId && (
                      <TouchableOpacity onPress={() => router.push(isOwner ? { pathname: '/(owner)/contracts' } : { pathname: '/(driver)/contract', params: { contract: item.contractId } })}>
                        <Text style={{ color: mine ? '#D1FAE5' : palette.brand, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline', marginTop: 3 }}>Open the contract</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {!!item.body && <Text style={{ color: mine ? '#fff' : colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{item.body}</Text>}
                <Text style={{ color: mine ? '#A7F3D0' : colors.textMuted, fontSize: 10, marginTop: 4 }}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[s.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {recState.isRecording ? (
          <>
            <TouchableOpacity onPress={() => stopRecording(false)} style={s.iconBtn} accessibilityLabel="Delete recording">
              <Ionicons name="trash-outline" size={22} color="#DC2626" />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#DC2626', opacity: 0.9 }} />
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{fmtDur(recState.durationMillis)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Recording…</Text>
            </View>
            <TouchableOpacity onPress={() => stopRecording(true)} style={[s.circleBtn, { backgroundColor: palette.brand }]} accessibilityLabel="Send voice note">
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={attach} disabled={busy} style={s.iconBtn} accessibilityLabel="Attach a photo, document or audio file">
              <Ionicons name="attach" size={23} color={colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder="Write a message…"
              placeholderTextColor={colors.textMuted}
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            {draft.trim() ? (
              <TouchableOpacity onPress={() => send()} disabled={busy} style={[s.circleBtn, { backgroundColor: palette.brand, opacity: busy ? 0.45 : 1 }]} accessibilityLabel="Send message">
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startRecording} disabled={busy} style={s.iconBtn} accessibilityLabel="Record a voice note">
                <Ionicons name="mic" size={23} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  thread: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  actionBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1 },
  attachBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, maxHeight: 90 },
  cardBox: { borderWidth: 1, borderRadius: 16, padding: 16 },
  usernameInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  searchInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  actionBtnLarge: { borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  sendBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
});
