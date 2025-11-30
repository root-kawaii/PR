import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState, useEffect } from 'react';
import { API_URL } from '@/config/api';
import { TableReservation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { TableReservationDetailModal } from '@/components/reservation/TableReservationDetailModal';
import * as Clipboard from 'expo-clipboard';
import { useStripe } from '@stripe/stripe-react-native';

type ReservationFilter = 'upcoming' | 'past';

export default function ReservationsScreen() {
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReservationFilter>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<TableReservation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const fetchReservations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${API_URL}/reservations/user/${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch reservations');

      const data = await response.json();
      setReservations(data.reservations || data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchReservations();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReservations(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const isReservationUpcoming = (reservation: TableReservation): boolean => {
    if (!reservation.event?.date) return true;
    const eventDate = new Date(reservation.event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate >= today;
  };

  const filteredReservations = reservations.filter(reservation => {
    const isUpcoming = isReservationUpcoming(reservation);
    return filter === 'upcoming' ? isUpcoming : !isUpcoming;
  });

  const handleReservationPress = (reservation: TableReservation) => {
    setSelectedReservation(reservation);
    setShowDetailModal(true);
  };

  const handleCopyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copiato!', 'Codice prenotazione copiato negli appunti');
  };

  const handlePaymentSubmit = async (numPeople: number) => {
    if (!selectedReservation || !user) return;

    const minSpendPerPerson = parseFloat(
      selectedReservation.table?.minSpend?.replace(' €', '') || '0'
    );
    const amount = minSpendPerPerson * numPeople;

    try {
      // Step 1: Create payment intent for adding people to reservation
      console.log('Creating payment intent for additional people...');
      const paymentIntentResponse = await fetch(
        `${API_URL}/reservations/${selectedReservation.id}/add-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            num_people: numPeople,
            user_id: user.id,
          }),
        }
      );

      if (!paymentIntentResponse.ok) {
        const errorText = await paymentIntentResponse.text();
        console.error('Payment intent error:', errorText);
        throw new Error(`Failed to create payment intent: ${errorText}`);
      }

      const paymentIntentData = await paymentIntentResponse.json();
      console.log('Payment intent created:', paymentIntentData.paymentIntentId);

      // Step 2: Initialize and present Stripe payment sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentIntentData.clientSecret,
        merchantDisplayName: 'Pierre Two',
        returnURL: 'pierre-two://stripe-redirect',
      });

      if (initError) {
        console.error('Payment sheet init error:', initError);
        Alert.alert('Errore', 'Impossibile inizializzare il pagamento. Riprova.');
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          console.error('Payment sheet present error:', presentError);
          Alert.alert('Errore', 'Pagamento non riuscito. Riprova.');
        }
        return;
      }

      console.log('Payment successful');

      // Step 3: Confirm payment with backend
      const confirmResponse = await fetch(
        `${API_URL}/reservations/${selectedReservation.id}/confirm-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stripe_payment_intent_id: paymentIntentData.paymentIntentId,
            payment_amount: amount,
            user_id: user.id,
          }),
        }
      );

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm payment');
      }

      Alert.alert(
        'Pagamento Confermato!',
        `Hai aggiunto ${numPeople} ${numPeople === 1 ? 'persona' : 'persone'} alla prenotazione per €${amount.toFixed(2)}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowDetailModal(false);
              setSelectedReservation(null);
              fetchReservations(true);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert(
        'Errore',
        'Non è stato possibile completare il pagamento. Riprova più tardi.'
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ThemedView style={styles.container}>
          <ThemedText type="title" style={styles.header}>Table Reservations</ThemedText>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ec4899" />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ThemedView style={styles.container}>
        <View style={styles.headerContainer}>
          <ThemedText type="title" style={styles.header}>Table Reservations</ThemedText>
          <View style={styles.reservationCount}>
            <IconSymbol name="table.furniture" size={16} color="#fff" />
            <ThemedText style={styles.reservationCountText}>{reservations.length}</ThemedText>
          </View>
        </View>

        {/* Filter Toggle Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'upcoming' && styles.filterButtonActive]}
            onPress={() => setFilter('upcoming')}
          >
            <ThemedText style={[styles.filterButtonText, filter === 'upcoming' && styles.filterButtonTextActive]}>
              Upcoming
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'past' && styles.filterButtonActive]}
            onPress={() => setFilter('past')}
          >
            <ThemedText style={[styles.filterButtonText, filter === 'past' && styles.filterButtonTextActive]}>
              Past
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ec4899"
            />
          }
        >
          {filteredReservations.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="table.furniture" size={64} color="#4b5563" />
              <ThemedText style={styles.emptyStateText}>
                No {filter} reservations
              </ThemedText>
            </View>
          ) : (
            <View style={styles.reservationsContainer}>
              {filteredReservations.map((reservation) => {
                const statusColor = getStatusColor(reservation.status);

                return (
                  <TouchableOpacity
                    key={reservation.id}
                    style={styles.reservationCard}
                    onPress={() => handleReservationPress(reservation)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.reservationHeader}>
                      <View style={styles.reservationHeaderLeft}>
                        <ThemedText style={styles.eventTitle}>
                          {reservation.event?.title || 'Event'}
                        </ThemedText>
                        <ThemedText style={styles.tableName}>
                          {reservation.table?.name || 'Table'}
                        </ThemedText>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <ThemedText style={[styles.statusText, { color: statusColor }]}>
                          {reservation.status}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.reservationInfo}>
                      <View style={styles.infoRow}>
                        <IconSymbol name="calendar" size={14} color="#9ca3af" />
                        <ThemedText style={styles.infoText}>
                          {(() => {
                            if (!reservation.event?.date) return 'Date TBD';

                            try {
                              // Handle different date formats
                              const dateStr = reservation.event.date;
                              let date;

                              // If it's already a formatted string (e.g., "15 GEN | 23:30"), return it
                              if (dateStr.includes('|') || /^\d{1,2}\s+[A-Z]{3}/.test(dateStr)) {
                                return dateStr;
                              }

                              // Try to parse as ISO date
                              date = new Date(dateStr);

                              // Check if date is valid
                              if (isNaN(date.getTime())) {
                                return dateStr; // Return original if can't parse
                              }

                              return date.toLocaleDateString('it-IT', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              });
                            } catch (error) {
                              console.error('Date parsing error:', error, reservation.event.date);
                              return reservation.event.date;
                            }
                          })()}
                        </ThemedText>
                      </View>
                      <View style={styles.infoRow}>
                        <IconSymbol name="person" size={14} color="#9ca3af" />
                        <ThemedText style={styles.infoText}>
                          {reservation.numPeople}/{reservation.table?.capacity || 0} persone
                        </ThemedText>
                      </View>
                    </View>

                    {/* Copy Code Button */}
                    {reservation.reservationCode && (
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleCopyCode(reservation.reservationCode);
                        }}
                      >
                        <IconSymbol name="barcode" size={16} color="#ec4899" />
                        <ThemedText style={styles.copyButtonText}>
                          {reservation.reservationCode}
                        </ThemedText>
                      </TouchableOpacity>
                    )}

                    <View style={styles.chevronIcon}>
                      <IconSymbol name="chevron.right" size={20} color="#9ca3af" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </ThemedView>

      {/* Reservation Detail Modal */}
      <TableReservationDetailModal
        visible={showDetailModal}
        reservation={selectedReservation}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedReservation(null);
        }}
        onPaymentSubmit={handlePaymentSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  reservationCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reservationCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  filterButtonActive: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  reservationsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  reservationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  reservationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reservationHeaderLeft: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  tableName: {
    fontSize: 14,
    color: '#ec4899',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  reservationInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  copyButtonText: {
    fontSize: 14,
    color: '#ec4899',
    fontWeight: '600',
    letterSpacing: 1,
  },
  chevronIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  codeContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  code: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ec4899',
    letterSpacing: 2,
  },
  expandIcon: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
});
