import { ThemedText } from '@/components/themed-text';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState, useEffect } from 'react';
import { API_URL } from '@/config/api';
import { TableReservation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
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
  const { theme } = useTheme();
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
        return theme.success;
      case 'pending':
        return theme.warning;
      case 'cancelled':
        return theme.error;
      default:
        return theme.textTertiary;
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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <Text style={[styles.header, { color: theme.text }]}>Table Reservations</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerContainer}>
          <Text style={[styles.header, { color: theme.text }]}>Table Reservations</Text>
          <View style={[styles.reservationCount, { backgroundColor: theme.backgroundElevated }]}>
            <IconSymbol name="table.furniture" size={16} color={theme.text} />
            <Text style={[styles.reservationCountText, { color: theme.text }]}>{reservations.length}</Text>
          </View>
        </View>

        {/* Filter Toggle Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
              filter === 'upcoming' && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={() => setFilter('upcoming')}
          >
            <Text style={[
              styles.filterButtonText,
              { color: theme.textTertiary },
              filter === 'upcoming' && { color: theme.textInverse }
            ]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: theme.backgroundElevated, borderColor: theme.border },
              filter === 'past' && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={() => setFilter('past')}
          >
            <Text style={[
              styles.filterButtonText,
              { color: theme.textTertiary },
              filter === 'past' && { color: theme.textInverse }
            ]}>
              Past
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          {filteredReservations.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="table.furniture" size={64} color={theme.border} />
              <Text style={[styles.emptyStateText, { color: theme.textTertiary }]}>
                No {filter} reservations
              </Text>
            </View>
          ) : (
            <View style={styles.reservationsContainer}>
              {filteredReservations.map((reservation) => {
                const statusColor = getStatusColor(reservation.status);

                return (
                  <TouchableOpacity
                    key={reservation.id}
                    style={[styles.reservationCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
                    onPress={() => handleReservationPress(reservation)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.reservationHeader}>
                      <View style={styles.reservationHeaderLeft}>
                        <Text style={[styles.eventTitle, { color: theme.text }]}>
                          {reservation.event?.title || 'Event'}
                        </Text>
                        <Text style={[styles.tableName, { color: theme.primary }]}>
                          {reservation.table?.name || 'Table'}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '33' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {reservation.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reservationInfo}>
                      <View style={styles.infoRow}>
                        <IconSymbol name="calendar" size={14} color={theme.textTertiary} />
                        <Text style={[styles.infoText, { color: theme.textTertiary }]}>
                          {(() => {
                            if (!reservation.event?.date) return 'Date TBD';

                            try {
                              const dateStr = reservation.event.date;
                              let date;

                              if (dateStr.includes('|') || /^\d{1,2}\s+[A-Z]{3}/.test(dateStr)) {
                                return dateStr;
                              }

                              date = new Date(dateStr);

                              if (isNaN(date.getTime())) {
                                return dateStr;
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
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <IconSymbol name="person" size={14} color={theme.textTertiary} />
                        <Text style={[styles.infoText, { color: theme.textTertiary }]}>
                          {reservation.numPeople}/{reservation.table?.capacity || 0} persone
                        </Text>
                      </View>
                    </View>

                    {/* Copy Code Button */}
                    {reservation.reservationCode && (
                      <TouchableOpacity
                        style={[styles.copyButton, { backgroundColor: `${theme.primary}1A`, borderColor: `${theme.primary}4D` }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleCopyCode(reservation.reservationCode);
                        }}
                      >
                        <IconSymbol name="barcode" size={16} color={theme.primary} />
                        <Text style={[styles.copyButtonText, { color: theme.primary }]}>
                          {reservation.reservationCode}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.chevronIcon}>
                      <IconSymbol name="chevron.right" size={20} color={theme.textTertiary} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

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
  },
  reservationCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reservationCountText: {
    fontSize: 14,
    fontWeight: '600',
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
    alignItems: 'center',
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  },
  reservationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
    marginBottom: 4,
  },
  tableName: {
    fontSize: 14,
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
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  chevronIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
});
