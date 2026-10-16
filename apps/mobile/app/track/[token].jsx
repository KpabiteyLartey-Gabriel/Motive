import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking,
} from 'react-native';
import { useEffect, useState, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { locationShareApi } from '../../lib/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function SharedTrackView() {
  const { token } = useLocalSearchParams();
  const { colors } = useTheme();

  const [data, setData]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await locationShareApi.resolve(token);
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'This link is invalid, expired, or has been revoked.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const openMaps = () => {
    const loc = data?.lastLocation;
    if (!loc) return;
    const lat = parseFloat(loc.latitude);
    const lng = parseFloat(loc.longitude);
    const v   = data?.vehicle;
    const label = encodeURIComponent(`${v?.make || ''} ${v?.model || ''} ${v?.registrationNumber || ''}`);
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}&label=${label}`);
  };

  const s = StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.background },
    centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    header:      { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
    brand:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    brandDot:    { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center' },
    brandLabel:  { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    live:        { fontSize: 11, color: colors.textMuted },
    card:        { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginHorizontal: 20, marginBottom: 16, padding: 16 },
    vehicleName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 },
    vehicleSub:  { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: 'monospace' },
    noteText:    { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginTop: 8 },
    row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    key:         { fontSize: 12, color: colors.textMuted },
    val:         { fontSize: 13, fontWeight: '600', color: colors.textPrimary, fontFamily: 'monospace' },
    mapsBtn:     { backgroundColor: '#059669', borderRadius: 40, paddingVertical: 14, alignItems: 'center', marginHorizontal: 20, marginBottom: 16 },
    mapsBtnTxt:  { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    errorTitle:  { fontSize: 15, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
    errorMsg:    { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
    expiry:      { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginHorizontal: 20, marginBottom: 24 },
    moving:      { color: '#22C55E' },
    parked:      { color: colors.textMuted },
  });

  const loc = data?.lastLocation;
  const v   = data?.vehicle;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator color={colors.textPrimary} />
          <Text style={[s.key, { marginTop: 12 }]}>Loading location…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={{ fontSize: 36, marginBottom: 16 }}>⛔</Text>
          <Text style={s.errorTitle}>Link unavailable</Text>
          <Text style={s.errorMsg}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.brand}>
            <View style={s.brandDot}>
              <Text style={{ color: colors.background, fontSize: 9, fontWeight: '800' }}>+</Text>
            </View>
            <Text style={s.brandLabel}>+Motive</Text>
            <Text style={s.live}>· Live Location</Text>
          </View>
        </View>

        {/* Vehicle info */}
        <View style={s.card}>
          <Text style={s.vehicleName}>
            {v?.make} {v?.model}
            {v?.year ? ` (${v.year})` : ''}
          </Text>
          {v?.registrationNumber && (
            <Text style={s.vehicleSub}>{v.registrationNumber}</Text>
          )}
          {data?.label && <Text style={s.noteText}>"{data.label}"</Text>}
        </View>

        {/* Location details */}
        {!loc ? (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
            <Text style={s.key}>No position data yet</Text>
            <Text style={[s.key, { marginTop: 4, fontSize: 11 }]}>Auto-refreshes every 30 s</Text>
          </View>
        ) : (
          <>
            <View style={s.card}>
              <View style={s.row}>
                <Text style={s.key}>Latitude</Text>
                <Text style={s.val}>{parseFloat(loc.latitude).toFixed(6)}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.key}>Longitude</Text>
                <Text style={s.val}>{parseFloat(loc.longitude).toFixed(6)}</Text>
              </View>
              {loc.speed != null && (
                <View style={s.row}>
                  <Text style={s.key}>Speed</Text>
                  <Text style={s.val}>{parseFloat(loc.speed).toFixed(0)} km/h</Text>
                </View>
              )}
              <View style={s.row}>
                <Text style={s.key}>Status</Text>
                <Text style={[s.val, loc.isMoving ? s.moving : s.parked]}>
                  {loc.isMoving ? 'Moving' : 'Parked'}
                </Text>
              </View>
              <View style={[s.row, { marginBottom: 0 }]}>
                <Text style={s.key}>Updated</Text>
                <Text style={s.val}>{fmtDate(loc.recordedAt)}</Text>
              </View>
            </View>

            <TouchableOpacity style={s.mapsBtn} onPress={openMaps}>
              <Text style={s.mapsBtnTxt}>📍  Open in Google Maps</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={s.expiry}>
          Link valid until {fmtDate(data?.expiresAt)} · refreshes every 30 s
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
