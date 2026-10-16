import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, ScrollView, Platform } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
// react-native-maps has no web implementation — load it only on native so
// the web runtime does not crash at import time.
let MapView = null;
let Marker = null;
let Circle = null;
let PROVIDER_DEFAULT = undefined;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Circle = maps.Circle;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
}
import { useTheme, palette } from '../../lib/theme';
import { useAuth } from '../../lib/useAuth';
import { vehiclesApi, trackingApi } from '../../lib/api';

const GHANA_REGION = {
  latitude:      5.6037,
  longitude:    -0.1870,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
};

function fmtTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function DriverTracking() {
  const { colors, isDark } = useTheme();
  const { user, loading }  = useAuth();

  const [vehicle,    setVehicle]    = useState(null);
  const [position,   setPosition]   = useState(null); // { lat, lng, speed, heading, updatedAt }
  const [fetching,   setFetching]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true); else setFetching(true);
    setError('');
    try {
      // Get assigned vehicle
      const vRes = await vehiclesApi.list({ assignedToMe: true, limit: 1 }).catch(() => null);
      const v = vRes?.data?.data?.vehicles?.[0] || null;
      setVehicle(v);

      if (v?.id) {
        // Fetch last known position for this vehicle
        const pRes = await trackingApi.getLastLocation(v.id).catch(() => null);
        const pos  = pRes?.data?.data;
        if (pos?.latitude) {
          setPosition({
            lat:       parseFloat(pos.latitude),
            lng:       parseFloat(pos.longitude),
            speed:     pos.speed ?? null,
            heading:   pos.heading ?? null,
            updatedAt: pos.updatedAt || pos.timestamp,
          });
        } else {
          setPosition(null);
        }
      }
    } catch {
      setError('Could not load tracking data. Please try again.');
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const styles = makeStyles(colors);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading || fetching) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.textPrimary} />
        <Text style={styles.loadingText}>Loading tracking…</Text>
      </SafeAreaView>
    );
  }

  // ─── No vehicle ─────────────────────────────────────────────────────────────
  if (!vehicle) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.icon]}>📍</Text>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No vehicle assigned</Text>
        <Text style={[styles.emptyDesc,  { color: colors.textSecondary }]}>
          Your vehicle tracking will appear here once a vehicle is assigned to you.
        </Text>
        <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: palette.solarYellow }]} onPress={() => load()}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Refresh</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const region = position
    ? { latitude: position.lat, longitude: position.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : GHANA_REGION;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.textPrimary} />}
      >
        {/* Map */}
        <View style={styles.mapContainer}>
          {MapView ? (
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={region}
            region={region}
            showsUserLocation={false}
            showsMyLocationButton={false}
            mapType={isDark ? 'mutedStandard' : 'standard'}
          >
            {position && (
              <>
                <Marker
                  coordinate={{ latitude: position.lat, longitude: position.lng }}
                  title={vehicle.registrationNumber || 'Your vehicle'}
                  description={`Last updated: ${fmtTime(position.updatedAt)}`}
                  pinColor={isDark ? '#FFFFFF' : '#000000'}
                />
                <Circle
                  center={{ latitude: position.lat, longitude: position.lng }}
                  radius={80}
                  fillColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                  strokeColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
                  strokeWidth={1}
                />
              </>
            )}
          </MapView>
          ) : (
            <View style={[styles.map, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, paddingHorizontal: 24, textAlign: 'center' }}>
                Live map is available in the +Motive mobile app. Your vehicle position details are shown below.
              </Text>
            </View>
          )}

          {!position && (
            <View style={styles.noSignalOverlay}>
              <Text style={styles.noSignalText}>No live position available</Text>
            </View>
          )}
        </View>

        {/* Vehicle info card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.regNo, { color: colors.textPrimary }]}>
            {vehicle.registrationNumber}
          </Text>
          <Text style={[styles.vehicleDesc, { color: colors.textSecondary }]}>
            {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
          </Text>
        </View>

        {/* Position details */}
        {position ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Last Known Position</Text>
            <View style={styles.row}>
              <Detail label="Latitude"  value={position.lat.toFixed(6)}    colors={colors} />
              <Detail label="Longitude" value={position.lng.toFixed(6)}    colors={colors} />
            </View>
            <View style={styles.row}>
              <Detail label="Speed"     value={position.speed != null ? `${position.speed} km/h` : '—'} colors={colors} />
              <Detail label="Heading"   value={position.heading != null ? `${position.heading}°` : '—'} colors={colors} />
            </View>
            <View style={[styles.updatedRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.updatedLabel, { color: colors.textMuted }]}>Updated</Text>
              <Text style={[styles.updatedValue, { color: colors.textSecondary }]}>{fmtTime(position.updatedAt)}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.noPositionText, { color: colors.textSecondary }]}>
              No GPS position has been reported for this vehicle yet. Position data is updated automatically by the tracking device.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value, colors }) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{value}</Text>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: colors.textMuted,
    },
    icon: {
      fontSize: 40,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyDesc: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    refreshBtn: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    mapContainer: {
      height: 320,
      position: 'relative',
      backgroundColor: colors.elevated,
    },
    map: {
      flex: 1,
    },
    noSignalOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    noSignalText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    card: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
    },
    regNo: {
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 2,
    },
    vehicleDesc: {
      fontSize: 13,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    updatedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 12,
      marginTop: 4,
      borderTopWidth: 1,
    },
    updatedLabel: {
      fontSize: 12,
    },
    updatedValue: {
      fontSize: 12,
    },
    noPositionText: {
      fontSize: 13,
      lineHeight: 20,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 16,
    },
  });
}
