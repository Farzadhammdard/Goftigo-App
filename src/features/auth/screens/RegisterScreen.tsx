import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';

export function RegisterScreen({navigation}: any) {
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+93');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !phoneNumber.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    if (username.trim().length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    if (password.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${Config.API.BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: username.trim(),
          phoneNumber: phoneNumber.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        useAuthStore.getState().login(data.data.user, {
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
          expiresAt: Date.now() + 15 * 60 * 1000,
        });
      } else {
        Alert.alert('Registration Failed', data.error?.message || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <Text style={styles.title}>گفتگو</Text>
          <Text style={styles.subtitle}>Create Your Account</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username (3-20 characters)"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#999"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Register</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.link}>Already have an account? Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  scrollContent: {flexGrow: 1},
  inner: {flex: 1, justifyContent: 'center', padding: 24},
  title: {fontSize: 42, fontWeight: 'bold', textAlign: 'center', color: '#00E5D4'},
  subtitle: {fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 40},
  form: {gap: 12},
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#00E5D4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  link: {textAlign: 'center', color: '#00B8AA', marginTop: 16, fontSize: 14},
});
