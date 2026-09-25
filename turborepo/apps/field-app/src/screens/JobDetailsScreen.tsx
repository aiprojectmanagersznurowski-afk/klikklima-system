import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getCurrentSession } from '../auth/supabase';
import { FieldApiClient } from '../api/client';
import { colors } from '../theme';
import type { FieldJob } from '../types';

interface JobDetailsScreenProps {
  jobId: string;
  onBack: () => void;
  onMissingConsents: (missing: string[]) => void;
}

export const JobDetailsScreen: React.FC<JobDetailsScreenProps> = ({
  jobId,
  onBack,
  onMissingConsents,
}) => {
  const [job, setJob] = useState<FieldJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = getCurrentSession();

  useEffect(() => {
    if (!session || !session.token) return;

    const client = new FieldApiClient({ getToken: () => session.token });
    client
      .getOwnJobDetail(jobId)
      .then((res) => {
        if (res.success && res.job) {
          setJob(res.job);
        } else {
          setError(res.error || 'Nie znaleziono zlecenia lub brak dostępu');
        }
      })
      .catch(() => {
        setError('Błąd połączenia z serwerem');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jobId, session]);

  const handleStartJob = async () => {
    if (!session || !session.token) return;
    setStarting(true);

    try {
      const client = new FieldApiClient({ getToken: () => session.token });
      const res = await client.startJob(jobId);

      if (!res.success) {
        if (res.missingDocuments && res.missingDocuments.length > 0) {
          onMissingConsents(res.missingDocuments);
        } else {
          Alert.alert('Błąd', res.error || 'Nie udało się rozpocząć zlecenia');
        }
        return;
      }

      Alert.alert('Sukces', 'Zlecenie zostało pomyślnie rozpoczęte!');
      // Aktualizacja lokalnego statusu
      if (job) {
        setJob({ ...job, status: 'IN_PROGRESS' });
      }
    } catch {
      Alert.alert('Błąd', 'Błąd komunikacji z serwerem');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.sky600} />
        <Text style={styles.loadingText}>Ładowanie szczegółów zlecenia...</Text>
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Zlecenie niedostępne'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Wróć do listy</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backHeaderBtn} onPress={onBack}>
        <Text style={styles.backHeaderBtnText}>← Wróć</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.jobId}>
            {job.projectNumber || job.installationNumber || 'Szczegóły zlecenia'}
          </Text>
          <Text style={styles.statusBadge}>{job.status}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>DANE KONTAKTOWE KLIENTA (CRM-KLI-AC2):</Text>
        <Text style={styles.clientName}>{job.client.imieINazwisko}</Text>
        <Text style={styles.infoRow}>Telefon: {job.client.telefon}</Text>
        <Text style={styles.infoRow}>Adres: {job.address.ulicaMiasto}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>GEOLOKACJA & GEOFENCING:</Text>
        <Text style={styles.infoRow}>
          Współrzędne: {job.address.latitude ? `${job.address.latitude}, ${job.address.longitude}` : 'Brak GPS'}
        </Text>
        <Text style={styles.hintText}>Promień odblokowania: 50 m (SLA.GEOFENCE_UNLOCK_RADIUS)</Text>
      </View>

      <TouchableOpacity
        style={[styles.startButton, starting && styles.startButtonDisabled]}
        onPress={handleStartJob}
        disabled={starting}
      >
        {starting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.startButtonText}>Rozpocznij zlecenie</Text>
        )}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate50,
    padding: 24,
  },
  backHeaderBtn: {
    marginBottom: 16,
  },
  backHeaderBtnText: {
    color: colors.sky600,
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.slate900,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    color: colors.slate700,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate400,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.slate800,
    marginBottom: 6,
  },
  infoRow: {
    fontSize: 15,
    color: colors.slate600,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  startButton: {
    backgroundColor: colors.sky600,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: colors.slate400,
  },
  startButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.slate200,
    borderRadius: 6,
  },
  backButtonText: {
    color: colors.slate700,
    fontWeight: '600',
  },
  errorText: {
    color: colors.red500,
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 12,
  },
  loadingText: {
    marginTop: 12,
    color: colors.slate500,
  },
});
