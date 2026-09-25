import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getCurrentSession, signOut } from '../auth/supabase';
import { colors } from '../theme';

interface ProfileScreenProps {
  onBack: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onLogout }) => {
  const session = getCurrentSession();

  const handleLogout = async () => {
    Alert.alert('Wylogowanie', 'Czy na pewno chcesz się wylogować?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyloguj',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          onLogout();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>← Wróć do zleceń</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Profil Pracownika Terenowego</Text>

      <View style={styles.card}>
        <Text style={styles.label}>ADRES E-MAIL</Text>
        <Text style={styles.value}>{session?.email || 'Brak danych'}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>ROLA OPERACYJNA (RBAC)</Text>
        <Text style={styles.value}>
          {session?.role === 'audytor' ? 'Audytor Terenowy' : 'Monter / Ekipa Montażowa'}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.label}>IDENTYFIKATOR PRACOWNIKA</Text>
        <Text style={styles.idValue}>{session?.entityId || 'N/A'}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>D12: Standard Aplikacji Terenowej</Text>
        <Text style={styles.infoBody}>
          Układ zoptymalizowany pod kątem telefonów komórkowych i pracy w terenie. Dostęp do danych
          klientów ograniczony wyłącznie do imienia, telefonu i adresu (CRM-KLI-AC2).
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Wyloguj się</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
    padding: 16,
    paddingTop: 48,
  },
  backBtn: {
    marginBottom: 16,
  },
  backBtnText: {
    color: colors.sky600,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.slate900,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate400,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate800,
  },
  idValue: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: colors.slate500,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: 14,
  },
  infoCard: {
    backgroundColor: colors.sky100,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.sky200,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.sky700,
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 13,
    color: colors.sky900,
    lineHeight: 18,
  },
  logoutButton: {
    backgroundColor: colors.red500,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
