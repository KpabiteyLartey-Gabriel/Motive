import { View, Text, StyleSheet, ScrollView, Image, Dimensions } from 'react-native';
import { resolveVehiclePhoto } from '../lib/api';

const WIDTH = Dimensions.get('window').width - 40;

export default function VehiclePhotos({ vehicle, colors }) {
  const photos = vehicle?.imageUrls || [];
  if (!photos.length) {
    return (
      <View style={[s.empty, { borderColor: colors.border }]}>
        <Text style={[s.emptyText, { color: colors.textMuted }]}>No photos of this vehicle yet</Text>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 20 }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {photos.map((p, i) => (
          <Image key={p + i} source={{ uri: resolveVehiclePhoto(p) }} style={s.photo} resizeMode="cover" />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <Text style={[s.count, { color: colors.textMuted }]}>{photos.length} photos — swipe to view</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  photo: { width: WIDTH, height: 210, borderRadius: 16, marginRight: 8, backgroundColor: '#222' },
  count: { fontSize: 12, marginTop: 8 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  emptyText: { fontSize: 13 },
});
