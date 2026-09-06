import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView} from 'react-native';
import {useTheme} from '../../../shell/providers/ThemeProvider';

// Section header
export function SectionHeader({title, icon}: {title: string; icon?: string}) {
  const {colors} = useTheme();
  return (
    <View style={[styles.sectionHeader, {backgroundColor: colors.background}]}>
      <Text style={[styles.sectionHeaderText, {color: colors.textSecondary}]}>{icon ? `${icon} ${title}` : title}</Text>
    </View>
  );
}

// Single setting row with label and optional subtitle
export function SettingRow({label, subtitle, onPress, rightComponent, danger}: {
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightComponent?: React.ReactNode;
  danger?: boolean;
}) {
  const {colors} = useTheme();
  return (
    <TouchableOpacity style={[styles.settingRow, {backgroundColor: colors.surface, borderBottomColor: colors.border}]} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.6 : 1}>
      <View style={styles.settingRowLeft}>
        <Text style={[styles.settingLabel, {color: danger ? colors.error : colors.text}]}>{label}</Text>
        {subtitle ? <Text style={[styles.settingSubtitle, {color: colors.textSecondary}]}>{subtitle}</Text> : null}
      </View>
      {rightComponent || (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </TouchableOpacity>
  );
}

// Toggle row
export function ToggleRow({label, subtitle, value, onValueChange}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const {colors} = useTheme();
  return (
    <View style={[styles.settingRow, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
      <View style={styles.settingRowLeft}>
        <Text style={[styles.settingLabel, {color: colors.text}]}>{label}</Text>
        {subtitle ? <Text style={[styles.settingSubtitle, {color: colors.textSecondary}]}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{false: '#d1d5db', true: colors.primaryLight}} thumbColor={value ? colors.primary : '#f4f3f4'} />
    </View>
  );
}

// Option picker (radio-style)
export function OptionPicker({label, options, value, onChange}: {
  label: string;
  options: {value: string; label: string}[];
  value: string;
  onChange: (v: string) => void;
}) {
  const {colors} = useTheme();
  return (
    <View style={[styles.optionPickerContainer, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
      <Text style={[styles.optionPickerLabel, {color: colors.text}]}>{label}</Text>
      {options.map(opt => (
        <TouchableOpacity key={opt.value} style={styles.optionRow} onPress={() => onChange(opt.value)}>
          <View style={[styles.radio, {borderColor: value === opt.value ? colors.primary : colors.border}]}>
          {value === opt.value && <View style={[styles.radioDot, {backgroundColor: colors.primary}]} />}
          </View>
          <Text style={[styles.optionLabel, {color: colors.text}]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Info row (non-interactive, displays info)
export function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// Separator
export function Separator() {
  return <View style={styles.separator} />;
}

// Bottom spacer
export function BottomSpacer() {
  return <View style={styles.bottomSpacer} />;
}

const styles = StyleSheet.create({
  sectionHeader: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  settingRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1f2937',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: '#c0c0c0',
    fontWeight: '300',
  },
  optionPickerContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  optionPickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioActive: {
    borderColor: '#00E5D4',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00E5D4',
  },
  optionLabel: {
    fontSize: 15,
    color: '#374151',
  },
  infoValue: {
    fontSize: 15,
    color: '#6b7280',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
