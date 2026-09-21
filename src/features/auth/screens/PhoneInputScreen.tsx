import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../../../shell/navigation/types';
import {validatePhoneNumber} from '../../../core/utils/validation';
import {useTheme} from '../../../shell/providers/ThemeProvider';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'PhoneInput'>;
};

export function PhoneInputScreen({navigation}: Props) {
  const {colors} = useTheme();
  const [phoneNumber, setPhoneNumber] = useState('+93');
  const [error, setError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
      setError(validation.error || 'Invalid phone number');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`${require('../../../core/constants/config').Config.API.BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Failed to send code');
        return;
      }
      navigation.navigate('OtpVerification', {
        phoneNumber,
        sessionId: json.data.sessionId,
      });
    } catch (e: any) {
      setError('خطا در ارسال کد. اتصال را بررسی کنید');
    } finally {
      setSending(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>گفتگو</Text>
            <Text style={styles.subtitle}>Goftegoo</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Enter your phone number</Text>
            <Text style={styles.hint}>
              We'll send you a verification code
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+93 7XX XXX XXX"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                autoFocus
                maxLength={15}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, sending && { opacity: 0.6 }]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={sending}>
              <Text style={styles.buttonText}>{sending ? 'در حال ارسال...' : 'Continue'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            By continuing, you agree to our Terms of Service
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 48,
    },
    logo: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.primary,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 4,
    },
    form: {
      gap: 12,
    },
    label: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    hint: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    inputContainer: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
    },
    input: {
      height: 52,
      fontSize: 18,
      color: colors.text,
    },
    error: {
      fontSize: 13,
      color: colors.error,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    footer: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 32,
    },
  });
}
