import { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { vehiclesApi, resolveVehiclePhoto } from '../lib/api';
import { useTheme } from '../lib/theme';

// Servicing renewal tracker — insurance & roadworthiness expiry for every
// vehicle linked to the signed-in person. The owner edits the dates — and
// so does the driver on a Work & Pay contract for that vehicle.

const STATUS_COLORS = { EXPIRED: '#dc2626', DUE_SOON: '#b45309', VALID: '#059669', NOT_SET: '#737373' };

function fmtDate(d) {
  if (!d) return 'Not set';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusText(r) {
  if (r.status === 'EXPIRED') return `Expired ${Math.abs(r.daysLeft)}d ago — renew now`;
  if (r.status === 'DUE_SOON') return r.daysLeft === 0 ? 'Expires today' : `${r.daysLeft} days left`;
  if (r.status === 'VALID') return `${r.daysLeft} days left`;
  return 'No date set';
}

export default function RenewalsPanel() {
  const { colors } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState('');

  useEffect(() => {
    vehiclesApi.myRenewals()
      .then((r) => setData(r.data?.data || r.data))
      .catch((e) => setError(e?.response?.data?.message || 'Could not load renewal dates.'));
  }, []);

  const save = async (vehicleId, key, field) => {
    const draftKey = `${vehicleId}:${key}`;
    setSaving(draftKey);
    try {
      const value = (drafts[draftKey] || '').trim();
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        setError('Enter the date as YYYY-MM-DD, e.g. 2027-03-31.');
        return;
      }
      const res = await vehiclesApi.updateRenewals(vehicleId, { [field]: value || null });
      const updated = res.data?.data || res.data;
      setData((prev) => prev && ({ ...prev, vehicles: prev.vehicles.map((v) => (v.vehicle.id === vehicleId ? updated : v)) }));
      setDrafts((prev) => { const next = { ...prev }; delete next[draftKey]; return next; });
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not save the date.');
    } finally { setSaving(''); }
  };

  return (
    <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Renewals — insurance & roadworthiness</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        The dates everyone forgets. Tracked for every vehicle linked to you — the owner is notified in-app and by email before each one runs out.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!data && !error && <Text style={[styles.muted, { color: colors.textMuted }]}>Loading renewals…</Text>}
      {data && data.vehicles.length === 0 && (
        <Text style={[styles.muted, { color: colors.textMuted }]}>
          No vehicles are linked to you yet. Renewals appear here for vehicles you own, drive, or hold an active contract on.
        </Text>
      )}
      {data?.vehicles.map(({ vehicle, renewals, canEdit }) => (
        <View key={vehicle.id} style={[styles.card, { borderColor: colors.border }]}>
          <View style={[styles.cardHead, { borderBottomColor: colors.border }]}>
            {vehicle.imageUrl
              ? <Image source={{ uri: resolveVehiclePhoto(vehicle.imageUrl) }} style={styles.photo} />
              : <View style={[styles.photo, styles.photoEmpty, { backgroundColor: colors.elevated }]}><Text>🚗</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={[styles.vehicleName, { color: colors.textPrimary }]}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>{vehicle.registrationNumber} · {vehicle.type}</Text>
            </View>
          </View>
          {!canEdit && (
            <Text style={[styles.readonly, { color: colors.textMuted }]}>Read-only — dates are set by the owner, or by the driver on a Work & Pay contract.</Text>
          )}
          {renewals.map((r) => {
            const draftKey = `${vehicle.id}:${r.key}`;
            const current = r.expiryDate ? String(r.expiryDate).slice(0, 10) : '';
            const draft = drafts[draftKey] ?? current;
            return (
              <View key={r.key} style={[styles.row, { borderTopColor: colors.separator }]}>
                <View style={styles.rowTop}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>{r.label}</Text>
                  <Text style={[styles.badge, { color: STATUS_COLORS[r.status] }]}>{statusText(r)}</Text>
                </View>
                <Text style={[styles.muted, { color: colors.textMuted }]}>Expires {fmtDate(r.expiryDate)}</Text>
                {canEdit && (
                  <View style={styles.editRow}>
                    <TextInput
                      value={draft}
                      onChangeText={(t) => setDrafts((prev) => ({ ...prev, [draftKey]: t }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                    />
                    {draft !== current && (
                      <TouchableOpacity style={styles.saveBtn} onPress={() => save(vehicle.id, r.key, r.field)} disabled={saving === draftKey}>
                        <Text style={styles.saveText}>{saving === draftKey ? 'Saving…' : 'Save'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  title: { fontWeight: '700', fontSize: 15 },
  sub: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  error: { color: '#dc2626', fontSize: 12, marginTop: 8 },
  muted: { fontSize: 12, marginTop: 6 },
  readonly: { fontSize: 11, paddingHorizontal: 10, paddingTop: 8 },
  card: { borderWidth: 1, borderRadius: 12, marginTop: 12, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1 },
  photo: { width: 52, height: 40, borderRadius: 8 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  vehicleName: { fontWeight: '600' },
  row: { padding: 10, borderTopWidth: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
  badge: { fontSize: 11, fontWeight: '600' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  saveBtn: { backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
