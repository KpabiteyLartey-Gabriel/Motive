import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, TextInput, StyleSheet, ScrollView } from 'react-native';
import { servicesApi, vehiclesApi } from '../lib/api';
import { useTheme } from '../lib/theme';

// Services published by Service Providers — detailing, oil change, tyre
// sales, towing and the rest. Anyone can request one for a vehicle; the
// provider accepts or declines, and both sides track it here.

const CATEGORY_LABELS = {
  DETAILING: 'Detailing', CAR_WASH: 'Car wash', OIL_CHANGE: 'Oil change', TYRE_SALES: 'Tyre sales',
  WHEEL_ALIGNMENT: 'Wheel alignment', BRAKES: 'Brakes', BATTERY: 'Battery', AC_SERVICE: 'AC service',
  DIAGNOSTICS: 'Diagnostics', GENERAL_SERVICING: 'General servicing', TOWING: 'Towing & recovery', OTHER: 'Other',
};

const STATUS_COLORS = { REQUESTED: '#b45309', ACCEPTED: '#059669', DECLINED: '#dc2626', COMPLETED: '#737373', CANCELLED: '#737373' };

function fmtPrice(s) {
  if (s.priceGhs === null || s.priceGhs === undefined) return 'Ask for price';
  const base = `GHS ${Number(s.priceGhs).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
  if (!s.priceNote) return base;
  return s.priceNote === 'from' ? `From ${base}` : `${base} ${s.priceNote}`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ServicesCatalog() {
  const { colors } = useTheme();
  const [services, setServices] = useState(null);
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [formFor, setFormFor] = useState(null);
  const [form, setForm] = useState({ vehicleId: '', vehicleLabel: '', preferredDate: '', contactPhone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [incoming, setIncoming] = useState(null);
  const [providerNotes, setProviderNotes] = useState({});

  const loadRequests = () => {
    servicesApi.myRequests().then((r) => setMyRequests(r.data?.data?.requests || [])).catch(() => {});
    servicesApi.incomingRequests().then((r) => setIncoming(r.data?.data?.requests || [])).catch(() => setIncoming(null));
  };

  useEffect(() => {
    servicesApi.list(category ? { category } : undefined)
      .then((r) => setServices(r.data?.data?.services || r.data?.services || []))
      .catch((e) => setError(e?.response?.data?.message || 'Could not load services.'));
  }, [category]);

  useEffect(() => {
    vehiclesApi.myRenewals().then((r) => setVehicles((r.data?.data?.vehicles || []).map((v) => v.vehicle))).catch(() => {});
    loadRequests();
  }, []);

  const openForm = (s) => {
    setNotice('');
    setFormFor(s.id);
    setForm({ vehicleId: vehicles[0]?.id || '', vehicleLabel: '', preferredDate: '', contactPhone: '', notes: '' });
  };

  const submitRequest = async (s) => {
    if (form.preferredDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.preferredDate.trim())) {
      setError('Preferred date must be YYYY-MM-DD.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await servicesApi.request(s.id, {
        vehicleId: form.vehicleId || undefined,
        vehicleLabel: form.vehicleId ? undefined : form.vehicleLabel.trim() || undefined,
        preferredDate: form.preferredDate.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setFormFor(null);
      setNotice(`Request sent to ${s.provider.businessName}. Watch "My service requests" below.`);
      loadRequests();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not send the request.');
    } finally { setSubmitting(false); }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }];

  return (
    <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Services for your vehicle</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        Published by service providers — the work that keeps a vehicle neat, in good shape and safe. Pick one and send a request.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {['', ...Object.keys(CATEGORY_LABELS)].map((c) => (
            <TouchableOpacity key={c || 'ALL'} onPress={() => setCategory(c)} style={[styles.chip, { borderColor: colors.inputBorder }, category === c && styles.chipActive]}>
              <Text style={[styles.chipText, { color: category === c ? '#fff' : colors.textSecondary }]}>{c ? CATEGORY_LABELS[c] : 'All'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!services && !error && <Text style={[styles.muted, { color: colors.textMuted }]}>Loading services…</Text>}
      {services && services.length === 0 && <Text style={[styles.muted, { color: colors.textMuted }]}>No services published yet{category ? ' in this category' : ''}.</Text>}

      {services?.map((s) => (
        <View key={s.id} style={[styles.card, { borderColor: colors.border }]}>
          <View style={styles.cardTop}>
            <Text style={styles.badge}>{CATEGORY_LABELS[s.category] || s.category}</Text>
            <Text style={[styles.price, { color: colors.textPrimary }]}>{fmtPrice(s)}</Text>
          </View>
          <Text style={[styles.serviceTitle, { color: colors.textPrimary }]}>{s.title}</Text>
          {!!s.description && <Text style={[styles.muted, { color: colors.textMuted }]}>{s.description}</Text>}
          <Text style={[styles.provider, { color: colors.textSecondary }]}>{s.provider.businessName}</Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {[s.provider.city, s.provider.region].filter(Boolean).join(', ') || 'Ghana'}{s.durationMins ? ` · about ${s.durationMins} mins` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity style={styles.callBtn} onPress={() => (formFor === s.id ? setFormFor(null) : openForm(s))}>
              <Text style={styles.callText}>{formFor === s.id ? 'Close' : 'Request this service'}</Text>
            </TouchableOpacity>
            {!!s.provider.phone && (
              <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.elevated }]} onPress={() => Linking.openURL(`tel:${s.provider.phone.replace(/\s/g, '')}`)}>
                <Text style={[styles.callText, { color: colors.textPrimary }]}>Call provider</Text>
              </TouchableOpacity>
            )}
          </View>

          {formFor === s.id && (
            <View style={{ marginTop: 10, gap: 8 }}>
              {vehicles.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {vehicles.map((v) => (
                    <TouchableOpacity key={v.id} onPress={() => setForm({ ...form, vehicleId: v.id })} style={[styles.chip, { borderColor: colors.inputBorder }, form.vehicleId === v.id && styles.chipActive]}>
                      <Text style={[styles.chipText, { color: form.vehicleId === v.id ? '#fff' : colors.textSecondary }]}>{v.make} {v.model} · {v.registrationNumber}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => setForm({ ...form, vehicleId: '' })} style={[styles.chip, { borderColor: colors.inputBorder }, !form.vehicleId && styles.chipActive]}>
                    <Text style={[styles.chipText, { color: !form.vehicleId ? '#fff' : colors.textSecondary }]}>Other vehicle</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!form.vehicleId && (
                <TextInput value={form.vehicleLabel} onChangeText={(t) => setForm({ ...form, vehicleLabel: t })} placeholder="Describe your vehicle, e.g. My 2018 Toyota Corolla, GE-2477-24" placeholderTextColor={colors.textMuted} style={inputStyle} />
              )}
              <TextInput value={form.preferredDate} onChangeText={(t) => setForm({ ...form, preferredDate: t })} placeholder="Preferred date YYYY-MM-DD (optional)" placeholderTextColor={colors.textMuted} style={inputStyle} />
              <TextInput value={form.contactPhone} onChangeText={(t) => setForm({ ...form, contactPhone: t })} placeholder="Your phone (optional)" placeholderTextColor={colors.textMuted} style={inputStyle} />
              <TextInput value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} placeholder="Anything the provider should know? (optional)" placeholderTextColor={colors.textMuted} style={inputStyle} multiline />
              <TouchableOpacity style={styles.callBtn} onPress={() => submitRequest(s)} disabled={submitting}>
                <Text style={styles.callText}>{submitting ? 'Sending…' : 'Send request'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      {myRequests.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.serviceTitle, { color: colors.textPrimary }]}>My service requests</Text>
          {myRequests.map((r) => (
            <View key={r.id} style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <Text style={[styles.serviceTitle, { color: colors.textPrimary, flex: 1 }]}>{r.service.title}</Text>
                <Text style={{ color: STATUS_COLORS[r.status], fontSize: 11, fontWeight: '700' }}>{r.status}</Text>
              </View>
              <Text style={[styles.muted, { color: colors.textMuted }]}>{r.provider.businessName} · {r.vehicleLabel}{r.preferredDate ? ` · preferred ${fmtDate(r.preferredDate)}` : ''}</Text>
              {!!r.providerNote && <Text style={[styles.muted, { color: colors.textSecondary }]}>Provider: {r.providerNote}</Text>}
              {r.status === 'REQUESTED' && (
                <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.elevated, alignSelf: 'flex-start' }]} onPress={async () => { await servicesApi.updateRequestStatus(r.id, { status: 'CANCELLED' }).catch(() => {}); loadRequests(); }}>
                  <Text style={[styles.callText, { color: colors.textPrimary }]}>Cancel request</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {incoming && incoming.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.serviceTitle, { color: colors.textPrimary }]}>Requests for my services</Text>
          {incoming.map((r) => (
            <View key={r.id} style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <Text style={[styles.serviceTitle, { color: colors.textPrimary, flex: 1 }]}>{r.service.title}</Text>
                <Text style={{ color: STATUS_COLORS[r.status], fontSize: 11, fontWeight: '700' }}>{r.status}</Text>
              </View>
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                {r.requester?.name || 'A +Motive user'}{r.requester?.chatUsername ? ` · @${r.requester.chatUsername}` : ''}{r.contactPhone ? ` · ${r.contactPhone}` : ''}
              </Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>{r.vehicleLabel}{r.preferredDate ? ` · preferred ${fmtDate(r.preferredDate)}` : ''}</Text>
              {!!r.notes && <Text style={[styles.muted, { color: colors.textSecondary }]}>“{r.notes}”</Text>}
              {(r.status === 'REQUESTED' || r.status === 'ACCEPTED') && (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <TextInput value={providerNotes[r.id] || ''} onChangeText={(t) => setProviderNotes({ ...providerNotes, [r.id]: t })} placeholder="Reply note, e.g. Saturday 9am works" placeholderTextColor={colors.textMuted} style={inputStyle} />
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {r.status === 'REQUESTED' && <>
                      <TouchableOpacity style={styles.callBtn} onPress={async () => { await servicesApi.updateRequestStatus(r.id, { status: 'ACCEPTED', providerNote: providerNotes[r.id] || undefined }).catch(() => {}); loadRequests(); }}>
                        <Text style={styles.callText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#dc2626' }]} onPress={async () => { await servicesApi.updateRequestStatus(r.id, { status: 'DECLINED', providerNote: providerNotes[r.id] || undefined }).catch(() => {}); loadRequests(); }}>
                        <Text style={styles.callText}>Decline</Text>
                      </TouchableOpacity>
                    </>}
                    {r.status === 'ACCEPTED' && (
                      <TouchableOpacity style={styles.callBtn} onPress={async () => { await servicesApi.updateRequestStatus(r.id, { status: 'COMPLETED', providerNote: providerNotes[r.id] || undefined }).catch(() => {}); loadRequests(); }}>
                        <Text style={styles.callText}>Mark completed</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  title: { fontWeight: '700', fontSize: 15 },
  sub: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 8 },
  notice: { color: '#059669', fontSize: 12, marginTop: 8 },
  muted: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  chipText: { fontSize: 11, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: 11, fontWeight: '700', color: '#059669' },
  price: { fontSize: 13, fontWeight: '700' },
  serviceTitle: { fontWeight: '600', marginTop: 6 },
  provider: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  callBtn: { backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  callText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
