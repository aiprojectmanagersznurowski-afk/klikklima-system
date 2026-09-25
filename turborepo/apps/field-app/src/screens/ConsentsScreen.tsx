import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { getCurrentSession } from '../auth/supabase';
import { FieldApiClient } from '../api/client';
import { colors } from '../theme';
import type { DocumentConsentStatus } from '../types';

interface ConsentsScreenProps {
  onBack?: () => void;
  onAllAccepted?: () => void;
}

export const ConsentsScreen: React.FC<ConsentsScreenProps> = ({
  onBack,
  onAllAccepted,
}) => {
  const [documents, setDocuments] = useState<DocumentConsentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = getCurrentSession();

  const loadConsents = useCallback(async () => {
    if (!session || !session.token) return;
    setLoading(true);
    setError(null);

    try {
      const client = new FieldApiClient({ getToken: () => session.token });
      const res = await client.getConsents();

      if (res.success && res.documents) {
        setDocuments(res.documents);
        if (res.allAccepted && onAllAccepted) {
          // All consents accepted
        }
      } else {
        setError(res.error || 'Nie udało się pobrać listy dokumentów prawnych');
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  }, [session, onAllAccepted]);

  useEffect(() => {
    loadConsents();
  }, [loadConsents]);

  const handleAccept = async (doc: DocumentConsentStatus) => {
    if (!session || !session.token) return;
    setAcceptingId(doc.id);

    try {
      const client = new FieldApiClient({ getToken: () => session.token });
      const idempotencyKey = `consent-${session.entityId}-${doc.id}-${Date.now()}`;
      const res = await client.acceptConsent(doc.id, idempotencyKey);

      if (res.success) {
        Alert.alert('Zgoda zarejestrowana', `Zaakceptowano: ${doc.documentKind}`);
        // Refresh documents list
        await loadConsents();
      } else {
        Alert.alert('Błąd akceptacji', res.error || 'Wystąpił błąd podczas akceptacji dokumentu');
      }
    } catch {
      Alert.alert('Błąd', 'Błąd komunikacji z serwerem');
    } finally {
      setAcceptingId(null);
    }
  };

  const allAccepted = documents.length > 0 && documents.every((d) => d.accepted);

  const renderItem = ({ item }: { item: DocumentConsentStatus }) => {
    const isPending = acceptingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.docTitle}>{item.documentKind}</Text>
          <Text style={[styles.badge, item.accepted ? styles.badgeAccepted : styles.badgeMissing]}>
            {item.accepted ? 'Zaakceptowano' : 'Wymaga akceptacji'}
          </Text>
        </View>

        <Text style={styles.versionText}>Wersja: {item.versionNo}</Text>
        <Text style={styles.contentText} numberOfLines={3}>
          {item.content}
        </Text>

        {!item.accepted && (
          <TouchableOpacity
            style={[styles.acceptButton, isPending && styles.acceptButtonDisabled]}
            onPress={() => handleAccept(item)}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.acceptButtonText}>Akceptuję oświadczenie</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>← Wróć</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Oświadczenia i Zgody Prawne</Text>
        <Text style={styles.subtitle}>
          Wymóg formalny: akceptacja aktualnych wersji dokumentów przed rozpoczęciem zlecenia
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.sky600} />
          <Text style={styles.loadingText}>Ładowanie dokumentów...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConsents}>
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={documents}
            keyExtractor={(item: DocumentConsentStatus) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Brak wymaganych dokumentów prawnych do zaakceptowania.</Text>
            }
          />

          {allAccepted && onAllAccepted && (
            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.continueButton} onPress={onAllAccepted}>
                <Text style={styles.continueButtonText}>Kontynuuj do zlecenia →</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
    paddingTop: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  backBtn: {
    marginBottom: 8,
  },
  backBtnText: {
    color: colors.sky600,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.slate900,
  },
  subtitle: {
    fontSize: 13,
    color: colors.slate500,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate800,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeAccepted: {
    backgroundColor: colors.green50,
    color: colors.green700,
  },
  badgeMissing: {
    backgroundColor: colors.red50,
    color: colors.red700,
  },
  versionText: {
    fontSize: 12,
    color: colors.slate400,
    marginTop: 4,
  },
  contentText: {
    fontSize: 14,
    color: colors.slate600,
    marginTop: 8,
    lineHeight: 20,
  },
  acceptButton: {
    marginTop: 12,
    backgroundColor: colors.sky600,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: colors.slate400,
  },
  acceptButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  continueButton: {
    backgroundColor: colors.slate900,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    color: colors.slate500,
  },
  errorText: {
    color: colors.red500,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    padding: 10,
    backgroundColor: colors.slate200,
    borderRadius: 6,
  },
  retryButtonText: {
    color: colors.slate700,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.slate400,
    marginTop: 32,
    fontSize: 14,
  },
});
