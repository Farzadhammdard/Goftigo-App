import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '../../../shell/navigation/types';
import { useTheme } from '../../../shell/providers/ThemeProvider';
import { Config } from '../../../core/constants/config';
import { useAuthStore } from '../../../store/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OtpVerification'>;
  route: RouteProp<AuthStackParamList, 'OtpVerification'>;
};

export function OtpVerificationScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { phoneNumber, sessionId: initialSessionId } = route.params;
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const inputsRef = useRef<(TextInput | null)[]>([]);
  const login = useAuthStore(s => s.login);

  useEffect(() => {
    const id = setInterval(() => setResendIn(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    // Paste handling: if multiple digits pasted
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length > 1) {
      const newCode = [...code];
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        newCode[index + i] = digits[i];
      }
      setCode(newCode);
      const next = Math.min(index + digits.length, 5);
      inputsRef.current[next]?.focus();
      setFocusedIndex(next);
      if (newCode.every(c => c.length === 1)) {
        handleVerify(newCode.join(''));
      }
      return;
    }

    const digit = digits.slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
    if (digit && newCode.every(c => c.length === 1)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      inputsRef.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  const handleVerify = async (otpCode: string) => {
    if (otpCode.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code: otpCode, sessionId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'کد نادرست است');
        setCode(['', '', '', '', '', '']);
        inputsRef.current[0]?.focus();
        setFocusedIndex(0);
        return;
      }
      const { user, accessToken, refreshToken } = json.data;
      // اگر شماره قبلا اکانت داشت همین اکانت باز می‌شود، اگر نبود تازه ساخته شده — هر دو همین login است
      login(
        {
          id: user.id,
          public_user_id: user.publicUserId,
          phone_number: user.phoneNumber,
          username: user.username,
          display_name: user.displayName,
          avatar_url: user.avatarUrl,
          bio: user.bio,
          is_online: 1,
          last_seen_at: Date.now(),
          created_at: Date.now(),
          updated_at: Date.now(),
        } as any,
        { accessToken, refreshToken } as any,
      );
      if (json.data.user?.needsProfileSetup) {
        navigation.navigate('ProfileSetup' as never);
      }
      // در غیر این صورت RootNavigator خودکار به Main می‌رود (isAuthenticated=true)
    } catch (err: any) {
      setError('خطا در ارتباط. دوباره تلاش کنید');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError(null);
    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const json = await res.json();
      if (json.success && json.data?.sessionId) {
        setSessionId(json.data.sessionId);
        setCode(['', '', '', '', '', '']);
        setResendIn(60);
        inputsRef.current[0]?.focus();
      } else {
        setError(json.error?.message || 'ارسال مجدد ناموفق');
      }
    } catch {
      setError('خطا در ارسال مجدد');
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← بازگشت</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>کد تایید</Text>
            <Text style={styles.subtitle}>
              کد ۶ رقمی به شماره{'\n'}
              <Text style={styles.phone} dir="ltr">{phoneNumber}</Text> ارسال شد
            </Text>
            <Text style={styles.hint}>کد را در ادمین بخش OTP هم می‌بینید</Text>
          </View>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={el => { inputsRef.current[index] = el; }}
                style={[
                  styles.codeInput,
                  focusedIndex === index ? styles.codeInputFocused : null,
                  digit ? styles.codeInputFilled : null,
                  error ? styles.codeInputError : null,
                ]}
                value={digit}
                onChangeText={text => handleCodeChange(text, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex(null)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                returnKeyType="next"
                autoFocus={index === 0}
              />
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {verifying && <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />}

          <TouchableOpacity
            style={[styles.resendButton, resendIn > 0 && styles.resendDisabled]}
            onPress={handleResend}
            disabled={resendIn > 0}
          >
            <Text style={[styles.resendText, resendIn > 0 && styles.resendTextDisabled]}>
              {resendIn > 0 ? `ارسال مجدد تا ${resendIn} ثانیه` : 'ارسال مجدد کد'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    keyboardView: { flex: 1 },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
    back: { fontSize: 15, color: colors.primary, marginBottom: 20, fontWeight: '500' },
    header: { marginBottom: 28 },
    title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, textAlign: 'center' },
    phone: { fontWeight: '700', color: colors.text },
    hint: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: 6 },
    codeContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, direction: 'ltr' as any },
    codeInput: {
      width: 48,
      height: 56,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    codeInputFocused: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 2 },
    codeInputFilled: { borderColor: colors.primary, backgroundColor: colors.surface },
    codeInputError: { borderColor: colors.error },
    error: { fontSize: 13, color: colors.error, marginTop: 14, textAlign: 'center' },
    resendButton: { marginTop: 28, alignItems: 'center', paddingVertical: 10 },
    resendDisabled: { opacity: 0.5 },
    resendText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
    resendTextDisabled: { color: colors.textTertiary },
  });
}
