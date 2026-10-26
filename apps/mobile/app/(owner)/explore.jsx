import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useTheme, palette } from '../../lib/theme';
import { useAuth, fmtGHS } from '../../lib/useAuth';
import { marketplaceApi, resolveVehiclePhoto } from '../../lib/api';

const MODEL_LABEL = { WORK_AND_PAY: 'Work & Pay', DRIVING_ON: 'DriveOn', RENTAL: 'Rental' };

export default function OwnerExplore() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await marketplaceApi.explore();
      setVehicles(res.data?.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={palette.brand} /></View>;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={vehicles}
      keyExtractor={(v) => v.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      ListHeaderComponent={<Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>This is Explore exactly as drivers see it: verified, published vehicles still open for interest. Your published vehicles appear here until you approve a driver.</Text>}
      ListEmptyComponent={<Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>Nothing is on Explore right now. Publish a verified vehicle and it will show here for drivers.</Text>}
      renderItem={({ item: v }) => (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {v.imageUrls?.[0] ? <Image source={{ uri: resolveVehiclePhoto(v.imageUrls[0]) }} style={s.photo} /> : <View style={[s.photo, { backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.textMuted, fontSize: 12 }}>No photo yet</Text></View>}
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: palette.brand }]}><Text style={s.badgeText}>{MODEL_LABEL[v.operatingModel] || 'Available'}</Text></View>
            <View style={[s.badge, { backgroundColor: '#00000088' }]}><Text style={s.badgeText}>{v.interestCount} interested</Text></View>
          </View>
          <View style={{ padding: 14 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>{v.make} {v.model} · {v.year}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{v.registrationNumber} · {v.color || ''} · {(v.type || '').replace(/_/g, ' ')} · {(v.fuelType || '').replace(/_/g, ' ')}</Text>
            {v.estimatedValue != null && <View style={s.row}><Text style={{ color: colors.textMuted, fontSize: 12 }}>Vehicle value</Text><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{fmtGHS(v.estimatedValue)}</Text></View>}
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>Listed by {v.managingCompany?.name || (v.owner?.user ? `${v.owner.user.firstName || ''} ${v.owner.user.lastName || ''}`.trim() : 'Owner')}</Text>
          </View>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  photo: { width: '100%', height: 170 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -34, paddingHorizontal: 10 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
