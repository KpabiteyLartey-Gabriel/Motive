import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import ChatView from '../../components/ChatView';
import { useTheme, palette } from '../../lib/theme';

export default function OwnerMessages() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TouchableOpacity onPress={() => router.push('/(owner)/contracts')} style={{ margin: 14, marginBottom: 0, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.brandSoft, borderRadius: 14, padding: 13 }}>
        <Text style={{ color: colors.brandText, fontWeight: '700', fontSize: 13 }}>Contracts &amp; driver access codes →</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Create a contract (agreed in person or for an approved driver) and share it here in chat by username.</Text>
      </TouchableOpacity>
      <ChatView isOwner />
    </View>
  );
}
