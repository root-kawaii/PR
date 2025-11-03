// ====================================
// components/event/EventDetailModal.tsx
// ====================================
import { Modal, ScrollView, View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Event } from '@/types';

type EventDetailModalProps = {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
  onReserveTable: () => void;
};

export const EventDetailModal = ({ visible, event, onClose, onReserveTable }: EventDetailModalProps) => {
  if (!event) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={["top"]}>
        <ThemedView style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton}>
              <IconSymbol name="square.and.arrow.up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalImageContainer}>
              <Image source={{ uri: event.image }} style={styles.modalImage} resizeMode="cover" />
            </View>

            <View style={styles.modalTitleSection}>
              <ThemedText style={styles.modalTitle}>{event.title}</ThemedText>
              <View style={styles.modalDateRow}>
                <IconSymbol name="calendar" size={16} color="#e5e7eb" />
                <ThemedText style={styles.modalDate}>{event.date}</ThemedText>
              </View>
              <View style={styles.modalDateRow}>
                <IconSymbol name="mappin" size={16} color="#e5e7eb" />
                <ThemedText style={styles.modalDate}>{event.venue}</ThemedText>
              </View>
            </View>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <DetailItem icon="clock" value={event.time || '23:00'} label="Start Time" />
                <DetailItem icon="person.2" value={event.ageLimit || '18+'} label="Age Limit" />
                <DetailItem icon="clock.fill" value={event.endTime || '04:00'} label="End Time" />
              </View>
            </View>

            <View style={styles.ctaSection}>
              <View style={styles.priceBox}>
                <ThemedText style={styles.priceLabel}>Entry Fee</ThemedText>
                <ThemedText style={styles.priceValue}>{event.price || '32 €'}</ThemedText>
              </View>
              <TouchableOpacity style={styles.buyButton} onPress={onReserveTable}>
                <ThemedText style={styles.buyButtonText}>RESERVE TABLE</ThemedText>
                <IconSymbol name="arrow.right" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {event.description && (
              <View style={styles.descriptionSection}>
                <ThemedText style={styles.descriptionTitle}>About Event</ThemedText>
                <ThemedText style={styles.descriptionText}>{event.description}</ThemedText>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </ThemedView>
      </SafeAreaView>
    </Modal>
  );
};

const DetailItem = ({ icon, value, label }: { icon: string; value: string; label: string }) => (
  <View style={styles.detailBox}>
    <IconSymbol name={icon} size={24} color="#ec4899" />
    <ThemedText style={styles.detailValue}>{value}</ThemedText>
    <ThemedText style={styles.detailLabel}>{label}</ThemedText>
  </View>
);

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalContent: { flex: 1, backgroundColor: '#000' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: { width: '100%', height: 400, backgroundColor: '#1f2937' },
  modalImage: { width: '100%', height: '100%' },
  modalTitleSection: { padding: 24, backgroundColor: '#000', gap: 8 },
  modalTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  modalDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalDate: { fontSize: 14, color: '#9ca3af' },
  detailsContainer: {
    backgroundColor: '#111',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailBox: { flex: 1, alignItems: 'center', gap: 8 },
  detailValue: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  detailLabel: { fontSize: 11, color: '#6b7280', textAlign: 'center' },
  ctaSection: { marginHorizontal: 16, marginTop: 24, gap: 16 },
  priceBox: { backgroundColor: '#111', padding: 20, borderRadius: 16, alignItems: 'center' },
  priceLabel: { fontSize: 14, color: '#9ca3af', marginBottom: 4 },
  priceValue: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  buyButton: {
    backgroundColor: '#ec4899',
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  descriptionSection: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 20,
    backgroundColor: '#111',
    borderRadius: 16,
  },
  descriptionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  descriptionText: { fontSize: 14, color: '#9ca3af', lineHeight: 22 },
});