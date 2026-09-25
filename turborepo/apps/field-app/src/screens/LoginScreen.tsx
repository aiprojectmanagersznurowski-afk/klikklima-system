import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { getSupabaseClient, setCurrentSession } from '../auth/supabase';
import { colors } from '../theme';
import type { FieldRole } from '../types';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Wpisz e-mail i hasło');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.session || !data.user) {
        setError(authError?.message || 'Niepoprawne dane logowania');
        setLoading(false);
        return;
      }

      // Symulacja mapowania roli (pobranej z profilu w backendzie)
      const role: FieldRole = email.includes('monter') ? 'monter' : 'audytor';

      setCurrentSession({
        token: data.session.access_token,
        email: data.user.email ?? email,
        role,
        entityId: data.user.id,
      });

      onLoginSuccess();
    } catch {
      setError('Błąd połączenia z serwerem logowania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>KlikKlima Teren</Text>
      <Text style={styles.subtitle}>Logowanie pracownika terenowego</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Adres e-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Hasło"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Zaloguj się</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: colors.slate50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.slate900,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.slate500,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.sky600,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: colors.red500,
    marginBottom: 16,
    textAlign: 'center',
  },
});
