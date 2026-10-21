import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert, Linking, Image } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, palette } from '../lib/theme';
import { useAuth } from '../lib/useAuth';
import { marketplaceApi, resolveVehiclePhoto } from '../lib/api';

const MODEL_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };

export default function ChatView({ isOwner }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

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

  const attach = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to send documents.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: asset.fileName || 'document.jpg', type: asset.mimeType || 'image/jpeg' });
      const up = await marketplaceApi.uploadAttachment(active.id, form);
      const d = up.data?.data || {};
      await marketplaceApi.sendMessage(active.id, { attachmentUrl: d.url, attachmentName: d.name || 'Document' });
      loadMessages();
      loadThreads();
    } catch (e) {
      Alert.alert('Upload failed', e.response?.data?.message || 'Could not send that document.');
    }
    setBusy(false);
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

  if (!active) {
    return (
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16 }}
        data={threads}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>No conversations yet. When a driver shows interest in a vehicle, your chat with them appears here.</Text>}
        renderItem={({ item }) => {
          const name = item.otherParty ? `${item.otherParty.firstName || ''} ${item.otherParty.lastName || ''}`.trim() : 'User';
          return (
            <TouchableOpacity onPress={() => setActive(item)} activeOpacity={0.8} style={[s.thread, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.vehicle?.make} {item.vehicle?.model} · {item.vehicle?.registrationNumber} · {MODEL_LABEL[item.vehicle?.operatingModel] || ''}</Text>
                <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.lastMessage?.body || (item.lastMessage?.attachmentName ? `Document: ${item.lastMessage.attachmentName}` : 'Say hello')}</Text>
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setActive(null)}><Text style={{ color: palette.brand, fontWeight: '700', fontSize: 14 }}>‹ Chats</Text></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{otherName}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{active.vehicle?.make} {active.vehicle?.model} ({active.vehicle?.registrationNumber}){status ? ` · ${status}` : ''}</Text>
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
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.senderUserId === user?.id;
          const isImage = item.attachmentUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(item.attachmentUrl);
          return (
            <View style={[s.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              <View style={[s.bubble, mine ? { backgroundColor: palette.brand, borderBottomRightRadius: 4 } : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 }]}>
                {item.attachmentUrl && (isImage
                  ? <TouchableOpacity onPress={() => Linking.openURL(resolveVehiclePhoto(item.attachmentUrl))}><Image source={{ uri: resolveVehiclePhoto(item.attachmentUrl) }} style={{ width: 170, height: 110, borderRadius: 8, marginBottom: 4 }} /></TouchableOpacity>
                  : <Text onPress={() => Linking.openURL(resolveVehiclePhoto(item.attachmentUrl))} style={{ color: mine ? '#D1FAE5' : palette.brand, textDecorationLine: 'underline', fontSize: 13, marginBottom: 4 }}>{item.attachmentName || 'Document'}</Text>)}
                {!!item.body && <Text style={{ color: mine ? '#fff' : colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{item.body}</Text>}
                <Text style={{ color: mine ? '#A7F3D0' : colors.textMuted, fontSize: 10, marginTop: 4 }}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[s.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={attach} disabled={busy} style={[s.attachBtn, { borderColor: colors.border }]}><Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>Attach</Text></TouchableOpacity>
        <TextInput
          style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
          placeholder="Write a message…"
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity onPress={() => send()} disabled={busy || !draft.trim()} style={[s.sendBtn, { backgroundColor: palette.brand, opacity: busy || !draft.trim() ? 0.45 : 1 }]}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Send</Text>}
        </TouchableOpacity>
      </View>
    </View>
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
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, maxHeight: 90 },
  sendBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
});
