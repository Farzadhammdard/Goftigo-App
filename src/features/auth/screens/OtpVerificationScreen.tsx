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
import type {RouteProp} from '@react-navigation/native';
import type {AuthStackParamList} from '../../../shell/navigation/types';
import {useTheme} from '../../../shell/providers/ThemeProvider';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'OtpVerification'>;
  route: RouteProp<AuthStackParamList, 'OtpVerification'>;
};

export function OtpVerificationScreen({navigation, route}: Props) {
  const {colors} = useTheme();
  const {phoneNumber} = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, _setError] = useState<string | null>(null);

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) {
      text = text.slice(-1);
    }
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      // Auto-focus next input
    }

    if (newCode.every((c) => c.length === 1)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleVerify = (otpCode: string) => {
    // TODO: Verify OTP with API
    if (otpCode.length === 6) {
      navigation.navigate('ProfileSetup');
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Verification Code</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.phone}>{phoneNumber}</Text>
            </Text>
          </View>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={index === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={styles.resendButton}
            onPress={() => {
              // TODO: Resend OTP
            }}>
            <Text style={styles.resendText}>Resend Code</Text>
          </TouchableOpacity>
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
      paddingTop: 16,
    },
    back: {
      fontSize: 16,
      color: colors.primary,
      marginBottom: 24,
    },
    header: {
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    phone: {
      fontWeight: '600',
      color: colors.text,
    },
    codeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    codeInput: {
      width: 48,
      height: 56,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
    },
    codeInputFilled: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    error: {
      fontSize: 13,
      color: colors.error,
      marginTop: 12,
    },
    resendButton: {
      marginTop: 24,
      alignItems: 'center',
    },
    resendText: {
      fontSize: 15,
      color: colors.primary,
      fontWeight: '500',
    },
  });
}
