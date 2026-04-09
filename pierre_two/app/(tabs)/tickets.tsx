import {
  Image,
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTickets } from '@/hooks/useTickets';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState, useCallback, useEffect } from 'react';
import { API_URL } from '@/config/api';
import { useApiFetch } from '@/config/apiFetch';
import { TableReservation } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { TableReservationDetailModal } from '@/components/reservation/TableReservationDetailModal';
import { ReservationCodeModal } from '@/components/reservation/ReservationCodeModal';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';

type BookingFilter = 'upcoming' | 'past';

export default function BookingsScreen() {
  const { tickets, loading: ticketsLoading, loadingMore, hasMore, refetch: refetchTickets, loadMore } = useTickets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const apiFetch = useApiFetch();

  const [filter, setFilter] = useState<BookingFilter>('upcoming');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Reservations state
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<TableReservation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReservationCodeModal, setShowReservationCodeModal] = useState(false);

  const fetchReservations = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setReservationsLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/reservations/user/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch reservations');
      const data = await response.json();
      setReservations(data.reservations || data);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setReservations([]);
    } finally {
      setReservationsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchReservations();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refetchTickets(true);
      if (user?.id) fetchReservations(true);
    }, [user]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchTickets(true), fetchReservations(true)]);
    await new Promise(resolve => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    if (nearBottom && hasMore && !loadingMore) loadMore();
  };

  const getTicketStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': case 'confirmed': return theme.success;
      case 'used': return theme.textTertiary;
      case 'cancelled': return theme.error;
      default: return theme.warning;
    }
  };

  const getReservationStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return theme.success;
      case 'pending': return theme.warning;
      case 'cancelled': return theme.error;
      default: return theme.textTertiary;
    }
  };

  const isEventInFuture = (dateStr: string): boolean => {
    const monthMap: Record<string, number> = {
      'GEN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAG': 4, 'GIU': 5,
      'LUG': 6, 'AGO': 7, 'SET': 8, 'OTT': 9, 'NOV': 10, 'DIC': 11,
    };
    const parts = dateStr.split('|')[0].trim().split(' ');
    if (parts.length !== 2) return true;
    const day = parseInt(parts[0]);
    const month = monthMap[parts[1]];
    if (month === undefined) {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0);
      return d >= today;
    }
    const today = new Date();
    const yr = month < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
    const ev = new Date(yr, month, day);
    today.setHours(0,0,0,0); ev.setHours(0,0,0,0);
    return ev >= today;
  };

  const isReservationUpcoming = (r: TableReservation): boolean => {
    if (!r.event?.date) return true;
    const d = new Date(r.event.date);
    const today = new Date(); today.setHours(0,0,0,0); d.setHours(0,0,0,0);
    return d >= today;
  };

  const filteredTickets = tickets.filter(t =>
    filter === 'upcoming' ? isEventInFuture(t.event.date) : !isEventInFuture(t.event.date)
  );
  const filteredReservations = reservations.filter(r =>
    filter === 'upcoming' ? isReservationUpcoming(r) : !isReservationUpcoming(r)
  );

  const totalCount = tickets.length + reservations.length;
  const loading = ticketsLoading || reservationsLoading;
  const hasReservations = filteredReservations.length > 0;
  const hasTickets = filteredTickets.length > 0;
  const upcomingCount = tickets.filter(t => isEventInFuture(t.event.date)).length + reservations.filter(r => isReservationUpcoming(r)).length;

  const handleReservationCodeSubmit = async (code: string) => {
    try {
      const response = await apiFetch(`${API_URL}/reservations/code/${code}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Prenotazione non trovata');
        }
        throw new Error('Errore durante il recupero della prenotazione');
      }

      const data = await response.json();
      setSelectedReservation(data);
      setShowReservationCodeModal(false);
      setShowDetailModal(true);
    } catch (error: any) {
      throw error;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[s.container, { backgroundColor: theme.background }]}>

        {/* Header */}
        <View style={[s.headerBar, { borderBottomColor: theme.border }]}>
          <View style={s.headerTextWrap}>
            <Text style={[s.header, { color: theme.text }]}>I miei acquisti</Text>
            <Text style={[s.headerSubtext, { color: theme.textTertiary }]}>
              {upcomingCount} futuri su {totalCount}
            </Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity
              style={[s.addButton, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}
              onPress={() => setShowReservationCodeModal(true)}
              activeOpacity={0.85}
            >
              <IconSymbol name="plus" size={18} color={theme.primary} />
            </TouchableOpacity>
            <View style={[s.countBadge, { backgroundColor: theme.primary }]}>
              <IconSymbol name="ticket.fill" size={14} color={theme.textInverse} />
              <Text style={[s.countText, { color: theme.textInverse }]}>{totalCount}</Text>
            </View>
          </View>
        </View>

        {/* Filter */}
        <View style={s.filterRow}>
          {(['upcoming', 'past'] as BookingFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[
                s.filterBtn,
                { backgroundColor: theme.backgroundSurface, borderColor: theme.border },
                filter === f && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterText, { color: theme.textTertiary }, filter === f && { color: theme.textInverse }]}>
                {f === 'upcoming' ? 'In arrivo' : 'Passati'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={400}
          contentContainerStyle={[
            s.scrollContent,
            loading && s.scrollCentered,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (filteredTickets.length === 0 && filteredReservations.length === 0) ? (
            <View style={s.center}>
              <IconSymbol name="ticket.fill" size={56} color={theme.border} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>
                Nessun acquisto {filter === 'upcoming' ? 'in arrivo' : 'passato'}
              </Text>
            </View>
          ) : (
            <>
              {hasReservations ? (
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: theme.text }]}>Prenotazioni tavolo</Text>
                  <Text style={[s.sectionCount, { color: theme.textTertiary }]}>{filteredReservations.length}</Text>
                </View>
              ) : null}

              {filteredReservations.map(reservation => {
                const statusColor = getReservationStatusColor(reservation.status);
                const paidAmount = reservation.amountPaid ? parseFloat(reservation.amountPaid.replace(/[^0-9.]/g, '')) : 0;
                const totalAmount = reservation.totalAmount ? parseFloat(reservation.totalAmount.replace(/[^0-9.]/g, '')) : 0;
                const progress = totalAmount > 0 ? Math.min(100, (paidAmount / totalAmount) * 100) : 0;
                return (
                  <TouchableOpacity
                    key={`res-${reservation.id}`}
                    style={[s.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                    onPress={() => { setSelectedReservation(reservation); setShowDetailModal(true); }}
                    activeOpacity={0.85}
                  >
                    {/* Type tag */}
                    <View style={[s.typeTag, { backgroundColor: `${theme.secondary}22`, borderColor: `${theme.secondary}55` }]}>
                      <IconSymbol name="table.furniture" size={11} color={theme.secondary} />
                      <Text style={[s.typeTagText, { color: theme.secondary }]}>Tavolo</Text>
                    </View>

                    <View style={s.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.cardTitle, { color: theme.text }]} numberOfLines={1}>
                          {reservation.event?.title || 'Evento'}
                        </Text>
                        <View style={s.tableRow}>
                          <Text style={[s.cardSub, { color: theme.primary }]}>
                            {reservation.table?.name || 'Tavolo'}
                          </Text>
                          {reservation.table?.zone ? (
                            <View style={[s.zonePill, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                              <Text style={[s.zoneText, { color: theme.textSecondary }]}>{reservation.table.zone}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: `${statusColor}33` }]}>
                        <Text style={[s.statusText, { color: statusColor }]}>{reservation.status}</Text>
                      </View>
                    </View>

                    <View style={s.metaRow}>
                      <IconSymbol name="calendar" size={13} color={theme.textTertiary} />
                      <Text style={[s.metaText, { color: theme.textTertiary }]}>{reservation.event?.date || 'TBD'}</Text>
                      <IconSymbol name="person" size={13} color={theme.textTertiary} />
                      <Text style={[s.metaText, { color: theme.textTertiary }]}>
                        {reservation.numPeople}/{reservation.table?.capacity || 0}
                      </Text>
                    </View>

                    {reservation.amountPaid && reservation.totalAmount && (
                      <View style={[s.progressWrap, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                        <View style={s.progressHeader}>
                          <Text style={[s.progressLabel, { color: theme.text }]}>Stato pagamento</Text>
                          <Text style={[s.progressPercent, { color: theme.success }]}>{Math.round(progress)}%</Text>
                        </View>
                        <View style={[s.progressBar, { backgroundColor: `${theme.border}66` }]}>
                          <View style={[s.progressFill, {
                            backgroundColor: theme.success,
                            width: `${progress}%` as any,
                          }]} />
                        </View>
                        <Text style={[s.progressText, { color: theme.textTertiary }]}>
                          {reservation.amountPaid} / {reservation.totalAmount}
                        </Text>
                      </View>
                    )}

                    {reservation.reservationCode && (
                      <TouchableOpacity
                        style={[s.codeBtn, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}40` }]}
                        onPress={e => { e.stopPropagation(); Clipboard.setStringAsync(reservation.reservationCode); Alert.alert('Copiato!', 'Codice prenotazione copiato'); }}
                      >
                        <IconSymbol name="barcode" size={14} color={theme.primary} />
                        <Text style={[s.codeBtnText, { color: theme.primary }]}>{reservation.reservationCode}</Text>
                      </TouchableOpacity>
                    )}

                    <View style={s.chevron}>
                      <IconSymbol name="chevron.right" size={18} color={theme.textTertiary} />
                    </View>
                  </TouchableOpacity>
                );
              })}

              {hasTickets ? (
                <View style={[s.sectionHeader, { marginTop: hasReservations ? 10 : 0 }]}>
                  <Text style={[s.sectionTitle, { color: theme.text }]}>Biglietti</Text>
                  <Text style={[s.sectionCount, { color: theme.textTertiary }]}>{filteredTickets.length}</Text>
                </View>
              ) : null}

              {filteredTickets.map(ticket => {
                const isExpanded = expandedTicket === ticket.id;
                const statusColor = getTicketStatusColor(ticket.status);
                const qrValue = ticket.qrCode || ticket.ticketCode;
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrValue)}`;
                return (
                  <View
                    key={`tkt-${ticket.id}`}
                    style={[s.ticketCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                  >
                      {/* Image */}
                      <View style={s.imgWrap}>
                        <Image source={{ uri: ticket.event.image }} style={s.img} resizeMode="cover" />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={s.imgGrad} />
                        <View style={[s.statusBadge, s.imgBadge, { backgroundColor: statusColor }]}>
                          <Text style={s.statusText}>{ticket.status.toUpperCase()}</Text>
                        </View>
                        {/* Type tag on image */}
                        <View style={[s.imgTypeTag, { backgroundColor: `${theme.primary}cc` }]}>
                          <IconSymbol name="ticket.fill" size={11} color="#fff" />
                          <Text style={s.imgTypeTagText}>Ticket</Text>
                        </View>
                      </View>

                      <View style={s.ticketBody}>
                        <View style={s.ticketHeader}>
                          <Text style={[s.cardTitle, { color: theme.text, flex: 1 }]} numberOfLines={1}>{ticket.event.title}</Text>
                          <View style={[s.ticketStatusPill, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}44` }]}>
                            <Text style={[s.ticketStatusText, { color: statusColor }]}>
                              {ticket.status === 'active' ? 'Attivo' : ticket.status}
                            </Text>
                          </View>
                        </View>
                        <View style={s.metaRow}>
                          <IconSymbol name="location.fill" size={13} color={theme.textTertiary} />
                          <Text style={[s.metaText, { color: theme.textSecondary }]} numberOfLines={1}>{ticket.event.venue}</Text>
                        </View>
                        <View style={s.metaRow}>
                          <IconSymbol name="calendar" size={13} color={theme.textTertiary} />
                          <Text style={[s.metaText, { color: theme.textTertiary }]}>{ticket.event.date}</Text>
                        </View>

                        <View style={s.ticketMeta}>
                          <View style={[s.typeTag, { backgroundColor: `${theme.primary}22`, borderColor: `${theme.primary}44` }]}>
                            <IconSymbol name="ticket.fill" size={11} color={theme.primary} />
                            <Text style={[s.typeTagText, { color: theme.primary }]}>{ticket.ticketType}</Text>
                          </View>
                          <View style={[s.pricePill, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                            <Text style={[s.priceText, { color: theme.warning }]}>{ticket.price}</Text>
                          </View>
                        </View>

                        <View style={[s.codeRow, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                          <IconSymbol name="barcode" size={14} color={theme.textTertiary} />
                          <Text style={[s.codeLabel, { color: theme.textTertiary }]}>Codice:</Text>
                          <Text style={[s.codeValue, { color: theme.text }]}>{ticket.ticketCode}</Text>
                        </View>

                        {isExpanded && (
                          <View style={s.qrSection}>
                            <View style={[s.qrDivider, { backgroundColor: theme.border }]} />
                            <Text style={[s.qrLabel, { color: theme.textTertiary }]}>SCANSIONA ALL'INGRESSO</Text>
                            <View style={[s.qrWrap, { backgroundColor: '#ffffff' }]}>
                              <Image source={{ uri: qrImageUrl }} style={s.qrImage} resizeMode="contain" />
                            </View>
                            {!ticket.qrCode ? (
                              <Text style={[s.qrFallbackHint, { color: theme.textTertiary }]}>
                                QR generato dal codice biglietto
                              </Text>
                            ) : null}
                            <Text style={[s.qrCode, { color: theme.textTertiary }]}>{ticket.ticketCode}</Text>
                            <Text style={[s.purchaseDate, { color: theme.textTertiary }]}>
                              Acquistato: {new Date(ticket.purchaseDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </Text>
                          </View>
                        )}

                        <TouchableOpacity style={s.expandBtn} onPress={() => setExpandedTicket(isExpanded ? null : ticket.id)}>
                          <Text style={[s.expandText, { color: theme.textTertiary }]}>
                            {isExpanded ? 'Nascondi' : 'Mostra QR Code'}
                          </Text>
                          <IconSymbol name={isExpanded ? 'chevron.up' : 'chevron.down'} size={13} color={theme.textTertiary} />
                        </TouchableOpacity>
                      </View>

                      {/* Notch cutouts */}
                      <View style={[s.notch, { top: 152 }]}>
                        <View style={[s.notchL, { backgroundColor: theme.background }]} />
                        <View style={[s.notchR, { backgroundColor: theme.background }]} />
                      </View>
                  </View>
                );
              })}

              {loadingMore && <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 16 }} />}
              <View style={{ height: 20 }} />
            </>
          )}
        </ScrollView>
      </View>

      <TableReservationDetailModal
        visible={showDetailModal}
        reservation={selectedReservation}
        onClose={() => { setShowDetailModal(false); setSelectedReservation(null); fetchReservations(true); }}
        onPaymentSubmit={async () => {}}
      />

      <ReservationCodeModal
        visible={showReservationCodeModal}
        onClose={() => setShowReservationCodeModal(false)}
        onSubmit={handleReservationCodeSubmit}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  headerTextWrap: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { fontSize: 28, fontWeight: '700' },
  headerSubtext: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  countBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, gap: 6 },
  countText: { fontSize: 14, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  filterBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  filterText: { fontSize: 14, fontWeight: '600' },
  scrollContent: { padding: 16 },
  scrollCentered: { flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, minHeight: 200 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionCount: { fontSize: 13, fontWeight: '700' },

  // Reservation card
  card: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 3 },
  cardSub: { fontSize: 13 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  zonePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  zoneText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 13, marginRight: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: '#fff' },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, marginBottom: 8, alignSelf: 'flex-start' },
  typeTagText: { fontSize: 11, fontWeight: '600' },
  progressWrap: { marginTop: 6, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 12, fontWeight: '700' },
  progressPercent: { fontSize: 12, fontWeight: '800' },
  progressBar: { height: 6, borderRadius: 999, overflow: 'hidden', marginBottom: 7 },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 11, textAlign: 'center' },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  codeBtnText: { fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  chevron: { position: 'absolute', right: 14, top: '50%', marginTop: -9 },

  // Ticket card
  ticketCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 1 },
  imgWrap: { height: 160, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  imgBadge: { position: 'absolute', top: 12, right: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  imgTypeTag: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  imgTypeTagText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  ticketBody: { padding: 16 },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  ticketStatusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  ticketStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  ticketMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pricePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  priceText: { fontSize: 15, fontWeight: '700' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1 },
  codeLabel: { fontSize: 12 },
  codeValue: { fontSize: 13, fontWeight: '700', fontFamily: 'monospace', flex: 1 },
  qrSection: { alignItems: 'center', marginTop: 8 },
  qrDivider: { height: 1, width: '100%', marginBottom: 14 },
  qrLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginBottom: 14 },
  qrWrap: { padding: 16, borderRadius: 12, marginBottom: 12 },
  qrImage: { width: 180, height: 180 },
  qrFallbackHint: { fontSize: 11, marginBottom: 8, textAlign: 'center' },
  qrCode: { fontSize: 12, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 4 },
  purchaseDate: { fontSize: 12 },
  expandBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  expandText: { fontSize: 13, fontWeight: '600' },
  notch: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  notchL: { width: 20, height: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, marginLeft: -10 },
  notchR: { width: 20, height: 20, borderTopLeftRadius: 20, borderBottomLeftRadius: 20, marginRight: -10 },
});
