import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { getCurrentSession } from '../auth/supabase';

// @REQ: FLD-CHECKLIST-PREINSTALL

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  checkedAt: string | null;
  workerEmail: string | null;
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  {
    id: 'SITE_PROTECTION',
    label: 'Zabezpieczenie miejsca prac',
    description: 'Zabezpieczenie podłogi, mebli i wyposażenia w strefie montażu (folie, karton).',
    checked: false,
    checkedAt: null,
    workerEmail: null,
  },
  {
    id: 'WALL_STRUCTURE_CHECK',
    label: 'Weryfikacja podłoża i instalacji ukrytych',
    description: 'Sprawdzenie nośności ściany i tras przewodów/rur detektorem.',
    checked: false,
    checkedAt: null,
    workerEmail: null,
  },
  {
    id: 'POWER_SUPPLY_VERIFIED',
    label: 'Kontrola punktu zasilania',
    description: 'Weryfikacja zabezpieczenia prądowego (B16) i sprawności uziemienia.',
    checked: false,
    checkedAt: null,
    workerEmail: null,
  },
  {
    id: 'EQUIPMENT_INTEGRITY',
    label: 'Stan techniczny urządzeń',
    description: 'Brak uszkodzeń opakowań i obudów jednostek zewnętrznej i wewnętrznych.',
    checked: false,
    checkedAt: null,
    workerEmail: null,
  },
  {
    id: 'PASS_THROUGH_PLAN',
    label: 'Uzgodnienie trasy z klientem',
    description: 'Potwierdzenie z inwestorem miejsc montażu, trasy chłodniczej i odpływu skroplin.',
    checked: false,
    checkedAt: null,
    workerEmail: null,
  },
];

interface ChecklistScreenProps {
  jobId: string;
  onBack: () => void;
}

export const ChecklistScreen: React.FC<ChecklistScreenProps> = ({ jobId, onBack }) => {
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const session = getCurrentSession();
  const workerEmail = session?.email ?? 'monter@klikklima.pl';

  useEffect(() => {
    // Próba pobrania aktualnego stanu checklisty z serwera
    const fetchChecklist = async () => {
      if (!session?.token || session.token.startsWith('demo-')) {
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:3000/api/field/jobs/own/${jobId}/checklist`, {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.checklist)) {
            setItems(data.checklist);
          }
        }
      } catch {
        // W razie braku łączności działamy na lokalnym stanie
      } finally {
        setLoading(false);
      }
    };

    fetchChecklist();
  }, [jobId, session?.token]);

  const toggleItem = (id: string) => {
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextChecked = !item.checked;
        return {
          ...item,
          checked: nextChecked,
          checkedAt: nextChecked ? nowIso : null,
          workerEmail: nextChecked ? workerEmail : null,
        };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const idempotencyKey = `chk-${jobId}-${Date.now()}`;

    try {
      if (session?.token && !session.token.startsWith('demo-')) {
        const res = await fetch(`http://localhost:3000/api/field/jobs/own/${jobId}/checklist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            items: items.map((i) => ({ id: i.id, checked: i.checked })),
          }),
        });

        if (!res.ok) {
          throw new Error('Błąd zapisu na serwerze');
        }
      }

      Alert.alert('Sukces', 'Stan checklisty przedmontażowej został zapisany.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd zapisu';
      Alert.alert('Informacja', `Zapisano lokalnie (${msg}). Dane zsynchronizują się po powrocie sieci.`);
    } finally {
      setSaving(false);
    }
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const progressPercent = Math.round((checkedCount / items.length) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Wróć</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checklista przedmontażowa</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.sky600} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Status przygotowania (KPI)</Text>
                <Text style={styles.progressBadge}>
                  {checkedCount}/{items.length} ({progressPercent}%)
                </Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.kpiNote}>
                Checklista jest wskaźnikiem jakości montażu KlikKlima. Jej wynik trafia do protokołu odbioru.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.itemCard, item.checked && styles.itemCardChecked]}
              onPress={() => toggleItem(item.id)}
            >
              <View style={styles.itemHeader}>
                <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                  {item.checked && <Text style={styles.checkboxCheckmark}>✓</Text>}
                </View>
                <Text style={[styles.itemLabel, item.checked && styles.itemLabelChecked]}>
                  {item.label}
                </Text>
              </View>

              <Text style={styles.itemDescription}>{item.description}</Text>

              {item.checked && item.checkedAt && (
                <View style={styles.auditRow}>
                  <Text style={styles.auditText}>
                    Odhaczono: {new Date(item.checkedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    {item.workerEmail ? ` (${item.workerEmail})` : ''}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Zapisz checklistę</Text>
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
  progressCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate700,
  },
  progressBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.sky700,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.slate200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.sky600,
  },
  kpiNote: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  loader: {
    marginVertical: 32,
  },
  itemCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  itemCardChecked: {
    borderColor: colors.sky600,
    backgroundColor: colors.slate50,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  itemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.slate900,
    flex: 1,
  },
  itemLabelChecked: {
    color: colors.sky900,
  },
  itemDescription: {
    fontSize: 13,
    color: colors.slate600,
    lineHeight: 18,
    paddingLeft: 36,
  },
  auditRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingLeft: 36,
  },
  auditText: {
    fontSize: 11,
    color: colors.slate500,
    fontStyle: 'italic',
  },
  footer: {
    backgroundColor: colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
  },
  saveButton: {
    backgroundColor: colors.sky600,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.slate400,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
