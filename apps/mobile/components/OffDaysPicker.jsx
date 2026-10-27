import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useTheme, palette } from '../lib/theme';
import { WEEK_DAYS, isValidDateText } from '../lib/offDays';
import { Field } from './ui';

// Off days, picked three ways: particular days every week, particular
// single days, or a whole period off. Dates are entered as YYYY-MM-DD.
// Value: { weekly: [], dates: [], periods: [{ from, to }] }
export default function OffDaysPicker({ value, onChange }) {
  const { colors } = useTheme();
  const v = value || { weekly: [], dates: [], periods: [] };
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');

  const toggleDay = (day) => {
    const weekly = v.weekly.includes(day) ? v.weekly.filter((d) => d !== day) : [...v.weekly, day];
    onChange({ ...v, weekly });
  };

  const addDate = () => {
    if (!isValidDateText(date)) { setMsg('Enter the day as YYYY-MM-DD, e.g. 2026-12-25.'); return; }
    const d = date.trim();
    if (v.dates.includes(d)) { setMsg('That day is already added.'); return; }
    setMsg('');
    onChange({ ...v, dates: [...v.dates, d].sort() });
    setDate('');
  };

  const addPeriod = () => {
    if (!isValidDateText(from) || !isValidDateText(to)) { setMsg('Enter both period dates as YYYY-MM-DD.'); return; }
    if (to.trim() < from.trim()) { setMsg('The period must end after it starts.'); return; }
    setMsg('');
    onChange({ ...v, periods: [...v.periods, { from: from.trim(), to: to.trim() }] });
    setFrom('');
    setTo('');
  };

  return (
    <View>
      <Text style={[s.label, { color: colors.textPrimary }]}>Off days — pick them, no typing</Text>
      {msg ? <Text style={s.msg}>{msg}</Text> : null}

      <Text style={[s.sub, { color: colors.textMuted }]}>Particular days every week</Text>
      <View style={s.weekRow}>
        {WEEK_DAYS.map(([day, label]) => {
          const active = v.weekly.includes(day);
          return (
            <TouchableOpacity key={day} onPress={() => toggleDay(day)} accessibilityRole="button" accessibilityState={{ selected: active }}
              style={[s.weekChip, { borderColor: active ? palette.brand : colors.border, backgroundColor: active ? palette.brand : 'transparent' }]}>
              <Text style={{ color: active ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12, textAlign: 'center' }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.sub, { color: colors.textMuted }]}>Particular days</Text>
      <Field label="One day (YYYY-MM-DD)" placeholder="2026-12-25" value={date} onChangeText={setDate} autoCapitalize="none" />
      <TouchableOpacity onPress={addDate} style={[s.addBtn, { borderColor: colors.border }]} accessibilityRole="button">
        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Add day</Text>
      </TouchableOpacity>
      {v.dates.map((d) => (
        <View key={d} style={[s.picked, { backgroundColor: colors.brandSoft }]}>
          <Text style={[s.pickedText, { color: colors.textPrimary }]}>{d}</Text>
          <TouchableOpacity onPress={() => onChange({ ...v, dates: v.dates.filter((x) => x !== d) })} accessibilityRole="button" accessibilityLabel={`Remove ${d}`}>
            <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 15 }}>×</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={[s.sub, { color: colors.textMuted }]}>A period off</Text>
      <Field label="From (YYYY-MM-DD)" placeholder="2026-12-24" value={from} onChangeText={setFrom} autoCapitalize="none" />
      <Field label="To (YYYY-MM-DD)" placeholder="2027-01-02" value={to} onChangeText={setTo} autoCapitalize="none" />
      <TouchableOpacity onPress={addPeriod} style={[s.addBtn, { borderColor: colors.border }]} accessibilityRole="button">
        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>Add period</Text>
      </TouchableOpacity>
      {v.periods.map((p, i) => (
        <View key={`${p.from}-${p.to}-${i}`} style={[s.picked, { backgroundColor: colors.brandSoft }]}>
          <Text style={[s.pickedText, { color: colors.textPrimary }]}>{p.from} – {p.to}</Text>
          <TouchableOpacity onPress={() => onChange({ ...v, periods: v.periods.filter((_, x) => x !== i) })} accessibilityRole="button" accessibilityLabel="Remove period">
            <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 15 }}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  msg: { color: '#DC2626', fontSize: 12.5, fontWeight: '600', marginTop: 4 },
  weekRow: { flexDirection: 'row', gap: 5 },
  weekChip: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  addBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 6 },
  picked: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 },
  pickedText: { fontSize: 13, fontWeight: '600' },
});
