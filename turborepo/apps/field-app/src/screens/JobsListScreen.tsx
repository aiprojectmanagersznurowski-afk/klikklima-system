import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { getCurrentSession } from '../auth/supabase';
import { FieldApiClient } from '../api/client';
import { colors } from '../theme';
import type { FieldJob } from '../types';

interface JobsListScreenProps {
  onSelectJob: (jobId: string) => void;
  onOpenProfile: () => void;
  onOpenConsents: () => void;
  hasMissingConsents?: boolean;
}

export const JobsListScreen: React.FC<JobsListScreenProps> = ({
  onSelectJob,
  onOpenProfile,
  onOpenConsents,
  hasMissingConsents,
}) => {
  const [jobs, setJobs] = useState<FieldJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const session = getCurrentSession();

  // Fail-closed guard: brak ważnego tokenu natychmiast blokuje dostęp i nie renderuje listy zleceń
  if (!session || !session.token) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Brak autoryzacji sesji. Zaloguj się ponownie.</Text>
      </View>
    );
  }

  useEffect(() => {
    let isMounted = true;
    const client = new FieldApiClient({ getToken: () => session.token });

    client
      .getOwnJobs()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.jobs) {
          setJobs(res.jobs);
        } else {
          setError(res.error || 'Nie udało się pobrać listy zleceń');
        }
      })
      .catch(() => {
        if (isMounted) setError('Błąd komunikacji z serwerem');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session.token]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.sky600} />
        <Text style={styles.loadingText}>Ładowanie Twoich zleceń...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Moje Zlecenia ({session.role})</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile}>
          <Text style={styles.profileBtnText}>Profil</Text>
        </TouchableOpacity>
      </View>

      {hasMissingConsents ? (
        <TouchableOpacity style={styles.consentWarningBanner} onPress={onOpenConsents}>
          <Text style={styles.consentWarningTitle}>Wymagana akceptacja zgód</Text>
          <Text style={styles.consentWarningSub}>
            Zaktualizowano dokumenty prawne. Kliknij, aby je zaakceptować przed startem zlecenia.
          </Text>
        </TouchableOpacity>
      ) : null}

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : jobs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Brak przypisanych zleceń na najbliższy czas.</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item: FieldJob) => item.id}
          renderItem={({ item }: { item: FieldJob }) => (
            <TouchableOpacity style={styles.card} onPress={() => onSelectJob(item.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.jobIdentifier}>
                  {item.projectNumber || item.installationNumber || 'Zlecenie'}
                </Text>
                <Text style={styles.statusBadge}>{item.status}</Text>
              </View>

              <Text style={styles.clientName}>{item.client.imieINazwisko}</Text>
              <Text style={styles.addressText}>{item.address.ulicaMiasto}</Text>
              {item.scheduledAt ? (
                <Text style={styles.dateText}>Termin: {new Date(item.scheduledAt).toLocaleDateString('pl-PL')}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.slate900,
  },
  profileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.slate200,
    borderRadius: 6,
  },
  profileBtnText: {
    fontSize: 14,
    color: colors.slate700,
    fontWeight: '600',
  },
  consentWarningBanner: {
    backgroundColor: colors.amber100,
    borderWidth: 1,
    borderColor: colors.amber500,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  consentWarningTitle: {
    color: colors.amber800,
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  consentWarningSub: {
    color: colors.amber700,
    fontSize: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  jobIdentifier: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.sky600,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    color: colors.slate600,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate800,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: colors.slate500,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: colors.slate400,
  },
  errorText: {
    color: colors.red500,
    textAlign: 'center',
    fontSize: 14,
    marginTop: 16,
  },
  loadingText: {
    marginTop: 12,
    color: colors.slate500,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.slate400,
    fontSize: 15,
  },
});
