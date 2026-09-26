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

      <TouchableOpacity
        style={styles.googleButton}
        onPress={() => {
          // W Expo w trybie dev logujemy przez konto firmowe Google
          setCurrentSession({
            token: 'demo-google-token',
            email: 'michal@klikklima.pl',
            role: 'monter',
            entityId: 'user-google-1',
          });
          onLoginSuccess();
        }}
      >
        <View style={styles.googleIconContainer}>
          <Text style={styles.googleIconText}>G</Text>
        </View>
        <Text style={styles.googleButtonText}>Zaloguj się przez Google</Text>
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>LUB SZYBKI PODGLĄD RÓL</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.demoButtonsRow}>
        <TouchableOpacity
          style={[styles.demoButton, styles.demoButtonMonter]}
          onPress={() => {
            setCurrentSession({
              token: 'demo-monter-token',
              email: 'tomasz.monter@klikklima.pl',
              role: 'monter',
              entityId: 'monter-123',
            });
            onLoginSuccess();
          }}
        >
          <Text style={styles.demoButtonText}>🔧 Monter (Podgląd)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.demoButton, styles.demoButtonAudytor]}
          onPress={() => {
            setCurrentSession({
              token: 'demo-audytor-token',
              email: 'kamil.audytor@klikklima.pl',
              role: 'audytor',
              entityId: 'audytor-456',
            });
            onLoginSuccess();
          }}
        >
          <Text style={styles.demoButtonText}>📋 Audytor (Podgląd)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>LUB HASŁEM</Text>
        <View style={styles.dividerLine} />
      </View>

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
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Zaloguj hasłem</Text>}
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate300,
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.sky600,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  googleIconText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  googleButtonText: {
    color: colors.slate900,
    fontSize: 16,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.slate200,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate400,
    letterSpacing: 0.5,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  demoButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoButtonMonter: {
    backgroundColor: colors.indigo50,
    borderWidth: 1,
    borderColor: colors.indigo200,
  },
  demoButtonAudytor: {
    backgroundColor: colors.green50,
    borderWidth: 1,
    borderColor: colors.slate300,
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate800,
  },
  errorText: {
    color: colors.red500,
    marginBottom: 16,
    textAlign: 'center',
  },
});
