import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, RefreshControl, Alert,
} from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useAuth } from '../../lib/useAuth';
import { vehiclesApi, trackingApi, locationShareApi } from '../../lib/api';
import Constants from 'expo-constants';

const API_WEB_URL =
  Constants.expoConfig?.extra?.webUrl ||
  process.env.EXPO_PUBLIC_WEB_URL ||
  'http://localhost:3000';

const DURATION_OPTIONS = [
  { label: '1 hour',   value: 1 },
  { label: '6 hours',  value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days',   value: 72 },
  { label: '7 days',   value: 168 },
];

function fmtExpiry(dateStr) {
  if (!dateStr) return 'â€”';
  const d = new Date(dateStr);
  const now = new Date();
  if (d < now) return 'Expired';
  const diffMs = d - now;
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function OwnerTracking() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [vehicles, setVehicles]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [location, setLocation]       = useState(null);
  const [shares, setShares]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [locLoading, setLocLoading]   = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [sharing, setSharing]         = useState(false);
  const [durIdx, setDurIdx]           = useState(2); // default 24h
  const intervalRef = useRef(null);

  const loadVehicles = useCallback(async () => {
    try {
      const res = await vehiclesApi.list({ limit: 50 });
      const list = res.data?.data?.vehicles || [];
      setVehicles(list);
      if (list.length && !selected) setSelected(list[0]);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selected]);

  const loadLocation = useCallback(async () => {
    if (!selected) return;
    setLocLoading(true);
    try {
      const res = await trackingApi.getLastLocation(selected.id);
      setLocation(res.data?.data?.lastLocation || null);
    } catch { setLocation(null); } finally { setLocLoading(false); }
  }, [selected]);

  const loadShares = useCallback(async () => {
    try {
      const res = await locationShareApi.list();
      setShares(res.data?.data || []);
    } catch {}
  }, []);

  useEffect(() => { if (user) loadVehicles(); }, [user]);
  useEffect(() => { if (selected) { loadLocation(); loadShares(); } }, [selected]);

  // Auto-refresh location every 30 s
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (selected) {
      intervalRef.current = setInterval(loadLocation, 30_000);
    }
    return () => clearInterval(intervalRef.current);
  }, [selected]);

  const onRefresh = () => { setRefreshing(true); loadVehicles(); loadLocation(); loadShares(); };

  const createAndShare = async () => {
    if (!selected) return;
    setSharing(true);
    try {
      const durationHours = DURATION_OPTIONS[durIdx].value;
      const res = await locationShareApi.create({ vehicleId: selected.id, durationHours });
      const share = res.data.data;
      const shareUrl = `${API_WEB_URL}/track/${share.token}`;

      await Share.share({
        message: `Track ${selected.make} ${selected.model} (${selected.registrationNumber}) live on +Motive:\n${shareUrl}`,
        url: shareUrl,
        title: 'Share live vehicle location',
      });

      loadShares();
    } catch (err) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', err?.response?.data?.message || 'Could not create share link');
      }
    } finally {
      setSharing(false);
    }
  };

  const revokeShare = (shareId) => {
    Alert.alert('Revoke link', 'This will stop anyone using this link from viewing the location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await locationShareApi.revoke(shareId);
            setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, revokedAt: new Date().toISOString() } : s));
          } catch {}
        },
      },
    ]);
  };

  const s = StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.background },
    header:      { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    title:       { fontSize: 22, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
    subtitle:    { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    section:     { paddingHorizontal: 20, marginBottom: 24 },
    label:       { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    card:        { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 },
    vehicleBtn:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8, marginBottom: 6 },
    locationRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    locationKey: { fontSize: 12, color: colors.textMuted },
    locationVal: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, fontFamily: 'monospace' },
    empty:       { alignItems: 'center', paddingVertical: 32 },
    emptyText:   { fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
    durRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    durBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
    durLabel:    { fontSize: 12, fontWeight: '600' },
    shareBtn:    { backgroundColor: '#059669', borderRadius: 40, paddingVertical: 14, alignItems: 'center' },
    shareBtnTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    shareItem:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    shareLabel:  { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    shareExpiry: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    revokeBtn:   { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  });

  const activeShares = shares.filter(
    (sh) => !sh.revokedAt && new Date(sh.expiresAt) > new Date() && sh.vehicleId === selected?.id
  );

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.textPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={s.title}>Tracking</Text>
          <Text style={s.subtitle}>Live location of your vehicles</Text>
        </View>

        {vehicles.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 32 }}>ðŸ—ºï¸</Text>
            <Text style={s.emptyText}>No vehicles found</Text>
          </View>
        ) : (
          <>
            {/* Vehicle selector */}
            {vehicles.length > 1 && (
              <View style={s.section}>
                <Text style={s.label}>Select vehicle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {vehicles.map((v) => {
                    const active = selected?.id === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        style={[s.vehicleBtn, {
                          backgroundColor: active ? colors.textPrimary : 'transparent',
                          borderColor: active ? colors.textPrimary : colors.border,
                        }]}
                        onPress={() => setSelected(v)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: active ? colors.background : colors.textMuted }}>
                          {v.make} {v.model} Â· {v.registrationNumber}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Last location */}
            <View style={s.section}>
              <Text style={s.label}>Last known position</Text>
              <View style={s.card}>
                {locLoading && !location ? (
                  <ActivityIndicator color={colors.textMuted} />
                ) : !location ? (
                  <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 8 }}>
                    No position data yet â€” make sure a tracking device is installed
                  </Text>
                ) : (
                  <>
                    <View style={s.locationRow}>
                      <Text style={s.locationKey}>Latitude</Text>
                      <Text style={s.locationVal}>{parseFloat(location.latitude).toFixed(6)}</Text>
                    </View>
                    <View style={s.locationRow}>
                      <Text style={s.locationKey}>Longitude</Text>
                      <Text style={s.locationVal}>{parseFloat(location.longitude).toFixed(6)}</Text>
                    </View>
                    {location.speed != null && (
                      <View style={s.locationRow}>
                        <Text style={s.locationKey}>Speed</Text>
                        <Text style={s.locationVal}>{parseFloat(location.speed).toFixed(0)} km/h</Text>
                      </View>
                    )}
                    <View style={s.locationRow}>
                      <Text style={s.locationKey}>Status</Text>
                      <Text style={[s.locationVal, { color: location.isMoving ? '#22C55E' : colors.textMuted }]}>
                        {location.isMoving ? 'Moving' : 'Parked'}
                      </Text>
                    </View>
                    <View style={[s.locationRow, { marginBottom: 0 }]}>
                      <Text style={s.locationKey}>Updated</Text>
                      <Text style={s.locationVal}>
                        {location.recordedAt ? new Date(location.recordedAt).toLocaleTimeString() : 'â€”'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Share location */}
            <View style={s.section}>
              <Text style={s.label}>Share live location</Text>
              <View style={s.card}>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
                  Create a temporary link. Anyone with it can see the live position for the set duration.
                </Text>
                {/* Duration picker */}
                <View style={s.durRow}>
                  {DURATION_OPTIONS.map((opt, i) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.durBtn, {
                        backgroundColor: durIdx === i ? colors.textPrimary : 'transparent',
                        borderColor: durIdx === i ? colors.textPrimary : colors.border,
                      }]}
                      onPress={() => setDurIdx(i)}
                    >
                      <Text style={[s.durLabel, { color: durIdx === i ? colors.background : colors.textMuted }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.shareBtn} onPress={createAndShare} disabled={sharing || !location}>
                  {sharing
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={s.shareBtnTxt}>
                        {!location ? 'No location data to share' : `Share Â· ${DURATION_OPTIONS[durIdx].label}`}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* Active share links */}
            {activeShares.length > 0 && (
              <View style={s.section}>
                <Text style={s.label}>Active share links</Text>
                <View style={s.card}>
                  {activeShares.map((sh) => (
                    <View key={sh.id} style={s.shareItem}>
                      <View>
                        <Text style={s.shareLabel}>{sh.label || 'Untitled share'}</Text>
                        <Text style={s.shareExpiry}>{fmtExpiry(sh.expiresAt)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => revokeShare(sh.id)}>
                        <Text style={s.revokeBtn}>Revoke</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

