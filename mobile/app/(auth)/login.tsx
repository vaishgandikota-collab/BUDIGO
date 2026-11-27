import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { api } from '../../services/api';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleLogin = async () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = 'Please enter your email';
    if (!password) errs.password = 'Please enter your password';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setGeneralError(null);
    try {
      setLoading(true);
      await api.login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err.message || 'Invalid email or password.';
      setGeneralError(msg);
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoName: string, demoEmail: string) => {
    try {
      setLoading(true);
      await api.login(demoEmail, 'password123');
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>BUDIGO</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to rejoin your group travel adventures</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email Address"
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={errors.email}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
          />

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {generalError && (
            <View style={{ backgroundColor: '#FDF2F2', borderWidth: 1, borderColor: '#F5C6CB', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: '#9E3339', fontSize: 13, fontWeight: '600' }}>{generalError}</Text>
            </View>
          )}

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={styles.loginBtn}
          />

          {/* Quick Demo Travelers - Isolated strictly to Development builds */}
          {__DEV__ && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue as test user (dev only)</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.demoRow}>
                <Button
                  title="Aarav (Host)"
                  variant="outline"
                  size="sm"
                  onPress={() => handleDemoLogin('Aarav Sharma', 'aarav@budigo.app')}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Bhavna"
                  variant="outline"
                  size="sm"
                  onPress={() => handleDemoLogin('Bhavna Patel', 'bhavna@budigo.app')}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.signupText}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 32,
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.mutedText,
    marginTop: 6,
  },
  form: {
    marginBottom: 32,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  loginBtn: {
    width: '100%',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: Colors.mutedText,
    fontWeight: '500',
  },
  demoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.mutedText,
  },
  signupText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});

