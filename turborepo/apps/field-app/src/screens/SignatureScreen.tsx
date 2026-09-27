import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../theme';
import { SignaturePad } from '../features/signature/SignaturePad';

// @REQ: FLD-SIGN-DOC-FREEZE
// @REQ: FLD-SIGN-CAPTURE
// @REQ: FLD-SIGN-AUDIT-TRAIL
// @REQ: FLD-SIGN-TSA

interface SignatureScreenProps {
  jobId: string;
  onBack: () => void;
  onComplete?: () => void;
}

interface DocumentSigningDetails {
  documentId: string;
  documentType: string;
  contentHash: string;
  templateVersion: string;
  isSigned: boolean;
}

export function SignatureScreen({
  jobId,
  onBack,
  onComplete,
}: SignatureScreenProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [docDetails, setDocDetails] = useState<DocumentSigningDetails | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [isSignatureEmpty, setIsSignatureEmpty] = useState<boolean>(true);
  const [signedResult, setSignedResult] = useState<{
    signatureId: string;
    tsaStatus: string;
  } | null>(null);

  useEffect(() => {
    fetchDocumentDetails();
  }, [jobId]);

  const fetchDocumentDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/field/jobs/own/${jobId}/signature`);
      if (!res.ok) {
        throw new Error('Nie udało się pobrać szczegółów dokumentu do podpisu');
      }
      const data: DocumentSigningDetails = await res.json();
      setDocDetails(data);
    } catch {
      Alert.alert(
        'Błąd pobierania',
        'Nie odnaleziono gotowego dokumentu do podpisu. Upewnij się, że sporządzono protokół odbioru.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSignature = async () => {
    if (isSignatureEmpty || !signatureDataUrl || !docDetails) {
      Alert.alert('Brak podpisu', 'Proszę złożyć podpis przed zatwierdzeniem.');
      return;
    }

    try {
      setSubmitting(true);
      const idempotencyKey = `sig-${jobId}-${Date.now()}`;
      const res = await fetch(`/api/field/jobs/own/${jobId}/signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          documentType: docDetails.documentType,
          documentId: docDetails.documentId,
          documentHash: docDetails.contentHash,
          signatureImage: signatureDataUrl,
          captureMetadata: {
            signedAtClient: new Date().toISOString(),
            deviceMode: 'mobile-portrait',
            appVersion: '1.0.0',
          },
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Błąd rejestracji podpisu');
      }

      setSignedResult({
        signatureId: result.signature?.id || 'sig-ok',
        tsaStatus: result.signature?.tsaStatus || 'APPLIED',
      });
      Alert.alert('Sukces', 'Podpis klienta został pomyślnie zarejestrowany.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Błąd rejestracji podpisu';
      Alert.alert('Błąd podpisu', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.sky600} />
        <Text style={styles.loadingText}>Ładowanie dokumentu do podpisu...</Text>
      </View>
    );
  }

  const documentTitle =
    docDetails?.documentType === 'HANDOVER_PROTOCOL'
      ? 'Protokół zdawczo-odbiorczy'
      : 'Umowa montażu';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Powrót do zlecenia</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Podpis klienta na miejscu</Text>
        <Text style={styles.subtitle}>
          Osobisty podpis odręczny na urządzeniu mobilnym
        </Text>
      </View>

      {/* Karta zamrożonego dokumentu (FLD-SIGN-DOC-FREEZE) */}
      <View style={styles.docCard}>
        <View style={styles.docHeaderRow}>
          <Text style={styles.docTypeBadge}>{documentTitle}</Text>
          <Text style={styles.versionBadge}>
            Wersja: {docDetails?.templateVersion || 'v1.0'}
          </Text>
        </View>

        <Text style={styles.docDescText}>
          Dokument został zamrożony kryptograficznie przed prezentacją.
          Wszelkie modyfikacje po złożeniu podpisu są trwale zablokowane.
        </Text>

        <View style={styles.hashBox}>
          <Text style={styles.hashLabel}>Skrót kryptograficzny (SHA-256):</Text>
          <Text style={styles.hashValue} numberOfLines={2}>
            {docDetails?.contentHash || 'Brak skrótu'}
          </Text>
        </View>
      </View>

      {signedResult || docDetails?.isSigned ? (
        <View style={styles.signedSuccessBox}>
          <Text style={styles.signedTitle}>✓ Dokument podpisany</Text>
          <Text style={styles.signedSubtext}>
            Podpis klienta został trwale utrwalony w rejestrze dowodowym.
          </Text>
          {signedResult && (
            <View style={styles.tsaBadgeRow}>
              <Text style={styles.tsaLabel}>Znacznik czasu TSA:</Text>
              <Text style={styles.tsaVal}>
                {signedResult.tsaStatus === 'APPLIED'
                  ? 'Kwalifikowany (EuroCert RFC 3161)'
                  : 'Oczekuje na synchronizację (offline)'}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onComplete || onBack}
          >
            <Text style={styles.doneBtnText}>Zakończ procedurę</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.padSection}>
          <Text style={styles.padInstruction}>
            Proszę poprosić klienta o złożenie podpisu palcem w poniższym polu:
          </Text>

          <SignaturePad
            height={220}
            onSignatureChange={({ dataUrl, isEmpty }) => {
              setSignatureDataUrl(dataUrl);
              setIsSignatureEmpty(isEmpty);
            }}
          />

          <View style={styles.legalNoticeBox}>
            <Text style={styles.legalNoticeText}>
              Składając podpis, klient oświadcza, że zapoznał się z treścią
              powyższego dokumentu, potwierdza poprawność wykonanych prac
              i odbiór instalacji klimatyzacji.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (isSignatureEmpty || submitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmitSignature}
            disabled={isSignatureEmpty || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>
                Zatwierdź podpis klienta
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.slate50,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.slate50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.slate600,
  },
  header: {
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: theme.colors.sky600,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.slate900,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.slate500,
    marginTop: 4,
  },
  docCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.slate200,
    marginBottom: 16,
  },
  docHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  docTypeBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.slate800,
  },
  versionBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.slate500,
    backgroundColor: theme.colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docDescText: {
    fontSize: 13,
    color: theme.colors.slate600,
    lineHeight: 18,
    marginBottom: 12,
  },
  hashBox: {
    backgroundColor: theme.colors.slate100,
    padding: 10,
    borderRadius: 8,
  },
  hashLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.slate500,
    textTransform: 'uppercase',
  },
  hashValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: theme.colors.slate800,
    marginTop: 4,
  },
  padSection: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.slate200,
  },
  padInstruction: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.slate800,
  },
  legalNoticeBox: {
    backgroundColor: theme.colors.sky100,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  legalNoticeText: {
    fontSize: 12,
    color: theme.colors.sky900,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: theme.colors.sky600,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: theme.colors.slate300,
  },
  submitBtnText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  signedSuccessBox: {
    backgroundColor: theme.colors.green50,
    borderColor: theme.colors.green700,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  signedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.green700,
    marginBottom: 6,
  },
  signedSubtext: {
    fontSize: 13,
    color: theme.colors.slate600,
    textAlign: 'center',
    marginBottom: 12,
  },
  tsaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  tsaLabel: {
    fontSize: 12,
    color: theme.colors.slate600,
  },
  tsaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.slate800,
  },
  doneBtn: {
    backgroundColor: theme.colors.slate900,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  doneBtnText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
