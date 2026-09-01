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
import {validateDisplayName, validateUsername} from '../../../core/utils/validation';
import {useTheme} from '../../../shell/providers/ThemeProvider';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ProfileSetup'>;
};

export function ProfileSetupScreen(_props: Props) {
  const {colors} = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handleComplete = () => {
    const nameValidation = validateDisplayName(displayName);
    const usernameValidation = validateUsername(username);

    setDisplayNameError(nameValidation.valid ? null : nameValidation.error || null);
    setUsernameError(usernameValidation.valid ? null : usernameValidation.error || null);

    if (!nameValidation.valid || !usernameValidation.valid) {
      return;
    }

    // TODO: Complete registration with API
    // TODO: Save user profile
    // TODO: Navigate to main app
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Set Up Your Profile</Text>
            <Text style={styles.subtitle}>Tell us how others should know you</Text>
          </View>

          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {displayName ? displayName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={[styles.input, displayNameError ? styles.inputError : null]}
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setDisplayNameError(null);
                }}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                maxLength={50}
                autoFocus
              />
              {displayNameError && (
                <Text style={styles.error}>{displayNameError}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.input, usernameError ? styles.inputError : null]}
                value={username}
                onChangeText={(text) => {
                  setUsername(text.replace(/[^a-zA-Z0-9_]/g, ''));
                  setUsernameError(null);
                }}
                placeholder="username"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
              />
              {usernameError && (
                <Text style={styles.error}>{usernameError}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleComplete}
              activeOpacity={0.8}>
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
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
    },
    avatarPlaceholder: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 32,
    },
    avatarText: {
      fontSize: 36,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    form: {
      gap: 16,
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    input: {
      height: 48,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      fontSize: 16,
      color: colors.text,
    },
    inputError: {
      borderColor: colors.error,
    },
    error: {
      fontSize: 12,
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
  });
}
