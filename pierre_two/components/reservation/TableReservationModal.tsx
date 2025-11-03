// ====================================
// components/reservation/TableReservationModal.tsx
// ====================================
import { useState } from 'react';
import { Modal, ScrollView, View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Event } from '@/types';
import { MOCK_TABLES } from '@/constants/data';

type TableReservationModalProps = {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
};

export const TableReservationModal = ({ visible, event, onClose }: TableReservationModalProps) => {
  const [selectedZone, setSelectedZone] = useState<string>('A');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  if (!event) return null;

  const tables = event.tables || MOCK_TABLES;
  const filteredTables = tables.filter(t => t.zone === selectedZone);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={["top"]}>
        <ThemedView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color="#fff" />
            </TouchableOpacity>
            <ThemedText style={styles.reservationTitle}>Reserve Table</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.reservationScroll}>
            <View style={styles.infoCard}>
              <ThemedText style={styles.infoCardTitle}>INFO BASE (Disponibile)</ThemedText>
              <ThemedText style={styles.infoCardSubtitle}>TAVOLO</ThemedText>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>1. Prenotque Max</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>2. Minimo Spesa per Persona</ThemedText>
              </View>
              <View style={styles.prenotaBox}>
                <ThemedText style={styles.prenotaText}>Prenota</ThemedText>
              </View>
            </View>

            <View style={styles.zoneSelectorContainer}>
              <ThemedText style={styles.sectionLabel}>LISTA TAVOLI DIVISA PER PREZZO</ThemedText>
              <View style={styles.zoneButtons}>
                <TouchableOpacity
                  style={[styles.zoneButton, selectedZone === 'A' && styles.zoneButtonActive]}
                  onPress={() => setSelectedZone('A')}
                >
                  <ThemedText style={styles.zoneButtonText}>ZONA A (80€)</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.zoneButton, selectedZone === 'B' && styles.zoneButtonActive]}
                  onPress={() => setSelectedZone('B')}
                >
                  <ThemedText style={styles.zoneButtonText}>ZONA B (25€)</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.tableListContainer}>
              {filteredTables.map((table) => (
                <TouchableOpacity
                  key={table.id}
                  style={[
                    styles.tableItem,
                    selectedTable === table.id && styles.tableItemSelected,
                    !table.available && styles.tableItemDisabled
                  ]}
                  onPress={() => table.available && setSelectedTable(table.id)}
                  disabled={!table.available}
                >
                  <View style={styles.tableItemHeader}>
                    <ThemedText style={styles.tableItemTitle}>• {table.name}</ThemedText>
                    {!table.available && (
                      <View style={styles.unavailableBadge}>
                        <ThemedText style={styles.unavailableText}>Not Available</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={styles.tableItemDetail}>
                    Capacity: {table.capacity} | Min Spend: {table.minSpend}€
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {selectedTable && (
            <View style={styles.bottomBar}>
              <View style={styles.bottomPrice}>
                <ThemedText style={styles.bottomPriceLabel}>Total</ThemedText>
                <ThemedText style={styles.bottomPriceValue}>
                  {tables.find(t => t.id === selectedTable)?.price}€
                </ThemedText>
              </View>
              <TouchableOpacity style={styles.confirmButton}>
                <ThemedText style={styles.confirmButtonText}>CONFIRM RESERVATION</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ThemedView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalContent: { flex: 1, backgroundColor: '#000' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reservationTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  reservationScroll: { flex: 1 },
  infoCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#dc2626',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  infoCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  infoCardSubtitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  infoRow: { marginBottom: 8 },
  infoLabel: { fontSize: 13, color: '#fff' },
  prenotaBox: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f97316',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  prenotaText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  zoneSelectorContainer: { marginHorizontal: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 12, textAlign: 'right' },
  zoneButtons: { gap: 12 },
  zoneButton: {
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
  },
  zoneButtonActive: { borderColor: '#ec4899', backgroundColor: '#1f1f2e' },
  zoneButtonText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  tableListContainer: { marginHorizontal: 16, gap: 12 },
  tableItem: {
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
  },
  tableItemSelected: { borderColor: '#ec4899', backgroundColor: '#1f1f2e' },
  tableItemDisabled: { opacity: 0.5 },
  tableItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableItemTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  unavailableBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#991b1b',
    borderRadius: 6,
  },
  unavailableText: { fontSize: 10, color: '#fff' },
  tableItemDetail: { fontSize: 12, color: '#9ca3af' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    gap: 12,
  },
  bottomPrice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomPriceLabel: { fontSize: 14, color: '#9ca3af' },
  bottomPriceValue: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  confirmButton: {
    backgroundColor: '#ec4899',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
});