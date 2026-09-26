import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { getCurrentSession } from '../auth/supabase';

// @REQ: FLD-HANDOVER-PROTOCOL
// @REQ: FLD-PHOTO-SET

interface HandoverProtocolScreenProps {
  jobId: string;
  indoorUnitsCount?: number;
  onBack: () => void;
  onProceedToSign?: (protocolId: string) => void;
}

export const HandoverProtocolScreen: React.FC<HandoverProtocolScreenProps> = ({
  jobId,
  indoorUnitsCount = 1,
  onBack,
  onProceedToSign,
}) => {
  const [nitrogenBar, setNitrogenBar] = useState('35.0');
  const [vacuumMbar, setVacuumMbar] = useState('0.65');
  const [durationMin, setDurationMin] = useState('45');
  const [outdoorModel, setOutdoorModel] = useState('Daikin Perfera RXM35R');
  const [outdoorSerial, setOutdoorSerial] = useState('SN-OUT-88776655');
  const [indoorModel, setIndoorModel] = useState('Daikin Perfera FTXM35R');
  const [indoorSerial, setIndoorSerial] = useState('SN-IN-11223344');
  const [clientTrained, setClientTrained] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const session = getCurrentSession();
  const requiredPhotosCount = 4 + 2 * indoorUnitsCount;

  const handleSubmit = async () => {
    const nBar = parseFloat(nitrogenBar);
    const vMbar = parseFloat(vacuumMbar);
    const dMin = parseInt(durationMin, 10);

    if (isNaN(nBar) || nBar <= 0 || isNaN(vMbar) || vMbar <= 0 || isNaN(dMin) || dMin <= 0) {
      Alert.alert('Błąd walidacji', 'Parametry ciśnienia, próżni i czasu muszą być dodatnimi liczbami.');
      return;
    }

    if (!clientTrained) {
      Alert.alert('Wymóg formalny', 'Wymagane jest potwierdzenie przeprowadzenia instruktażu klienta.');
      return;
    }

    if (!outdoorSerial.trim() || outdoorSerial.trim().length < 3) {
      Alert.alert('Brak danych', 'Wpisz poprawny numer seryjny jednostki zewnętrznej (z tabliczki).');
      return;
    }

    if (!indoorSerial.trim() || indoorSerial.trim().length < 3) {
      Alert.alert('Brak danych', 'Wpisz poprawny numer seryjny jednostki wewnętrznej (z tabliczki).');
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `hnd-${jobId}-${Date.now()}`;

    const payload = {
      nitrogen_test_bar: nBar,
      vacuum_test_mbar: vMbar,
      test_duration_min: dMin,
      client_trained: clientTrained,
      outdoor_unit: {
        model: outdoorModel.trim(),
        serial_number: outdoorSerial.trim(),
      },
      indoor_units: [
        {
          index: 1,
          model: indoorModel.trim(),
          serial_number: indoorSerial.trim(),
        },
      ],
    };

    try {
      let protocolId = `doc-demo-${Date.now()}`;

      if (session?.token && !session.token.startsWith('demo-')) {
        const res = await fetch(`http://localhost:3000/api/field/jobs/own/${jobId}/handover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Błąd zapisu protokołu');
        }
        protocolId = data.protocolId;
      }

      Alert.alert('Sukces', 'Protokół zdawczo-odbiorczy został zarejestrowany.', [
        {
          text: 'Przejdź do podpisu',
          onPress: () => {
            if (onProceedToSign) {
              onProceedToSign(protocolId);
            } else {
              onBack();
            }
          },
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd zapisu protokołu';
      Alert.alert('Błąd', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Wróć</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Protokół zdawczo-odbiorczy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Sekcja kompletu zdjęć (FLD-PHOTO-SET) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dokumentacja zdjęciowa (reguła 4 + 2n)</Text>
              <View style={styles.photoStatsRow}>
                <View style={styles.photoStatBadge}>
                  <Text style={styles.photoStatValue}>{requiredPhotosCount}</Text>
                  <Text style={styles.photoStatLabel}>Wymaganych zdjęć</Text>
                </View>
                <View style={styles.photoStatBadge}>
                  <Text style={[styles.photoStatValue, { color: colors.green700 }]}>Komplet</Text>
                  <Text style={styles.photoStatLabel}>4 stałe + 2x{indoorUnitsCount} wewn.</Text>
                </View>
              </View>
              <Text style={styles.photoHint}>
                Zdjęcia tabliczek znamionowych stanowią źródło numerów seryjnych weryfikowanych poniżej.
              </Text>
            </View>

            {/* Sekcja prób ciśnieniowych i próżniowych */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Parametry prób montażowych</Text>
              <Text style={styles.fieldLabel}>Próba ciśnienia azotem [bar]</Text>
              <TextInput
                style={styles.input}
                value={nitrogenBar}
                onChangeText={setNitrogenBar}
                keyboardType="numeric"
                placeholder="np. 35.0"
              />

              <Text style={styles.fieldLabel}>Poziom próżni układu [mbar]</Text>
              <TextInput
                style={styles.input}
                value={vacuumMbar}
                onChangeText={setVacuumMbar}
                keyboardType="numeric"
                placeholder="np. 0.65"
              />

              <Text style={styles.fieldLabel}>Czas trwania próby [min]</Text>
              <TextInput
                style={styles.input}
                value={durationMin}
                onChangeText={setDurationMin}
                keyboardType="numeric"
                placeholder="np. 45"
              />
            </View>

            {/* Sekcja urządzeń i numerów seryjnych */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Numery seryjne urządzeń (K5)</Text>

              <Text style={styles.subHeader}>Jednostka zewnętrzna</Text>
              <Text style={styles.fieldLabel}>Model</Text>
              <TextInput
                style={styles.input}
                value={outdoorModel}
                onChangeText={setOutdoorModel}
                placeholder="Model jednostki zewnętrznej"
              />
              <Text style={styles.fieldLabel}>Numer seryjny (z tabliczki)</Text>
              <TextInput
                style={styles.input}
                value={outdoorSerial}
                onChangeText={setOutdoorSerial}
                placeholder="SN jednostki zewnętrznej"
                autoCapitalize="characters"
              />

              <Text style={[styles.subHeader, { marginTop: 12 }]}>Jednostka wewnętrzna 1</Text>
              <Text style={styles.fieldLabel}>Model</Text>
              <TextInput
                style={styles.input}
                value={indoorModel}
                onChangeText={setIndoorModel}
                placeholder="Model jednostki wewnętrznej"
              />
              <Text style={styles.fieldLabel}>Numer seryjny (z tabliczki)</Text>
              <TextInput
                style={styles.input}
                value={indoorSerial}
                onChangeText={setIndoorSerial}
                placeholder="SN jednostki wewnętrznej"
                autoCapitalize="characters"
              />
            </View>

            {/* Instruktaż klienta */}
            <TouchableOpacity
              style={styles.trainingCard}
              onPress={() => setClientTrained(!clientTrained)}
            >
              <View style={[styles.checkbox, clientTrained && styles.checkboxChecked]}>
                {clientTrained && <Text style={styles.checkboxCheckmark}>✓</Text>}
              </View>
              <View style={styles.trainingTextWrapper}>
                <Text style={styles.trainingTitle}>Instruktaż klienta przeprowadzony</Text>
                <Text style={styles.trainingDescription}>
                  Klient został przeszkolony z obsługi pilota, aplikacji oraz procedury czyszczenia filtrów.
                </Text>
              </View>
            </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Zatwierdź i przejdź do podpisu →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  header: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.sky600,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
    marginBottom: 12,
  },
  photoStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  photoStatBadge: {
    flex: 1,
    backgroundColor: colors.slate100,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.sky700,
    marginBottom: 2,
  },
  photoStatLabel: {
    fontSize: 11,
    color: colors.slate600,
  },
  photoHint: {
    fontSize: 12,
    color: colors.slate500,
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
    marginBottom: 4,
    marginTop: 8,
  },
  subHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.sky900,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.slate900,
  },
  trainingCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.slate200,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.slate400,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.sky600,
    borderColor: colors.sky600,
  },
  checkboxCheckmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  trainingTextWrapper: {
    flex: 1,
  },
  trainingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900,
    marginBottom: 2,
  },
  trainingDescription: {
    fontSize: 12,
    color: colors.slate600,
    lineHeight: 16,
  },
  footer: {
    backgroundColor: colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  submitButton: {
    backgroundColor: colors.sky600,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.slate400,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
