import { ThemedText } from '@/components/themed-text';
import { Image, StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTickets } from '@/hooks/useTickets';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState, useCallback } from 'react';

export const options = {
  icon: 'confirmation-number',
  tabBarLabel: 'Tickets',
};

type TicketFilter = 'current' | 'past';

export default function TicketsScreen() {
  const { tickets, loading, loadingMore, error, hasMore, refetch, loadMore } = useTickets();
  const { theme } = useTheme();
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [filter, setFilter] = useState<TicketFilter>('current');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch(true);
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'confirmed':
        return theme.success;
      case 'used':
        return theme.textTertiary;
      case 'cancelled':
        return theme.error;
      default:
        return theme.warning;
    }
  };

  const isEventInFuture = (dateStr: string): boolean => {
    const monthMap: { [key: string]: number } = {
      'GEN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAG': 4, 'GIU': 5,
      'LUG': 6, 'AGO': 7, 'SET': 8, 'OTT': 9, 'NOV': 10, 'DIC': 11
    };

    const parts = dateStr.split('|')[0].trim().split(' ');
    if (parts.length !== 2) return true;

    const day = parseInt(parts[0]);
    const monthStr = parts[1];
    const month = monthMap[monthStr];

    if (month === undefined) return true;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const eventYear = month < currentMonth ? currentYear + 1 : currentYear;
    const eventDate = new Date(eventYear, month, day);

    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    return eventDate >= today;
  };

  const filteredTickets = tickets.filter(ticket => {
    const isFuture = isEventInFuture(ticket.event.date);
    return filter === 'current' ? isFuture : !isFuture;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerContainer}>
          <Text style={[styles.header, { color: theme.text }]}>Your Tickets</Text>
          <View style={[styles.ticketCount, { backgroundColor: theme.primary }]}>
            <IconSymbol name="ticket.fill" size={16} color={theme.textInverse} />
            <Text style={[styles.ticketCountText, { color: theme.textInverse }]}>{tickets.length}</Text>
          </View>
        </View>

        {/* Filter Toggle Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: theme.backgroundSurface, borderColor: theme.border },
              filter === 'current' && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={() => setFilter('current')}
          >
            <Text style={[
              styles.filterButtonText,
              { color: theme.textTertiary },
              filter === 'current' && { color: theme.textInverse }
            ]}>
              Current
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: theme.backgroundSurface, borderColor: theme.border },
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            (loading || error || filteredTickets.length === 0) && styles.scrollContentCentered
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressViewOffset={60}
            />
          }
        >
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textTertiary }]}>Loading your tickets...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <IconSymbol name="exclamationmark.triangle.fill" size={48} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : filteredTickets.length === 0 ? (
            <View style={styles.centerContainer}>
              <IconSymbol name="ticket.fill" size={64} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No {filter} tickets</Text>
              <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
                {filter === 'current'
                  ? 'You have no upcoming events'
                  : 'No past tickets found'}
              </Text>
            </View>
          ) : (
            <>
              {filteredTickets.map((ticket) => {
              const isExpanded = expandedTicket === ticket.id;

              return (
                <TouchableOpacity
                  key={ticket.id}
                  activeOpacity={0.9}
                  onPress={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                >
                  <View style={[styles.ticketCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    {/* Event Image Section */}
                    <View style={styles.imageSection}>
                      <Image
                        source={{ uri: ticket.event.image }}
                        style={styles.ticketImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.imageGradient}
                      />

                      {/* Status Badge */}
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) }]}>
                        <Text style={styles.statusBadgeText}>{ticket.status.toUpperCase()}</Text>
                      </View>
                    </View>

                    {/* Ticket Info Section */}
                    <View style={styles.infoSection}>
                      <View style={styles.eventInfo}>
                        <Text style={[styles.ticketTitle, { color: theme.text }]} numberOfLines={1}>
                          {ticket.event.title}
                        </Text>

                        <View style={styles.detailRow}>
                          <IconSymbol name="location.fill" size={14} color={theme.textTertiary} />
                          <Text style={[styles.ticketVenue, { color: theme.textSecondary }]} numberOfLines={1}>
                            {ticket.event.venue}
                          </Text>
                        </View>

                        <View style={styles.detailRow}>
                          <IconSymbol name="calendar" size={14} color={theme.textTertiary} />
                          <Text style={[styles.ticketDate, { color: theme.textTertiary }]}>{ticket.event.date}</Text>
                        </View>
                      </View>

                      {/* Ticket Type and Price Row */}
                      <View style={styles.ticketMetaRow}>
                        <View style={[styles.ticketTypeTag, { backgroundColor: `${theme.primary}26`, borderColor: `${theme.primary}4D` }]}>
                          <IconSymbol name="ticket.fill" size={12} color={theme.primary} />
                          <Text style={[styles.ticketTypeText, { color: theme.primary }]}>{ticket.ticketType}</Text>
                        </View>

                        <View style={[styles.priceContainer, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                          <Text style={[styles.priceText, { color: theme.warning }]}>{ticket.price}</Text>
                        </View>
                      </View>

                      {/* Ticket Code */}
                      <View style={[styles.ticketCodeSection, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                        <View style={styles.ticketCodeRow}>
                          <IconSymbol name="barcode" size={16} color={theme.textTertiary} />
                          <Text style={[styles.ticketCodeLabel, { color: theme.textTertiary }]}>Ticket Code:</Text>
                          <Text style={[styles.ticketCode, { color: theme.text }]}>{ticket.ticketCode}</Text>
                        </View>
                      </View>

                      {/* Expandable QR Code Section */}
                      {isExpanded && ticket.qrCode && (
                        <View style={styles.qrSection}>
                          <View style={[styles.qrDivider, { backgroundColor: theme.border }]} />
                          <Text style={[styles.qrLabel, { color: theme.textTertiary }]}>Scan at entrance</Text>
                          <View style={[styles.qrPlaceholder, { backgroundColor: theme.backgroundSurface, borderColor: theme.border }]}>
                            <IconSymbol name="qrcode" size={120} color={theme.border} />
                            <Text style={[styles.qrNote, { color: theme.textTertiary }]}>QR Code: {ticket.qrCode}</Text>
                          </View>
                          <Text style={[styles.purchaseDate, { color: theme.textTertiary }]}>
                            Purchased: {new Date(ticket.purchaseDate).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      )}

                      {/* Expand/Collapse Indicator */}
                      <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                      >
                        <Text style={[styles.expandButtonText, { color: theme.textTertiary }]}>
                          {isExpanded ? 'Hide Details' : 'Show QR Code'}
                        </Text>
                        <IconSymbol
                          name={isExpanded ? "chevron.up" : "chevron.down"}
                          size={14}
                          color={theme.textTertiary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Decorative Notch Pattern */}
                    <View style={styles.notchContainer}>
                      <View style={[styles.notchLeft, { backgroundColor: theme.background }]} />
                      <View style={[styles.notchRight, { backgroundColor: theme.background }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {hasMore && (
              <TouchableOpacity
                style={[styles.loadMoreButton, { borderColor: theme.border }]}
                onPress={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color={theme.primary} />
                  : <Text style={[styles.loadMoreText, { color: theme.primary }]}>Carica altri ticket</Text>
                }
              </TouchableOpacity>
            )}

            <View style={{ height: 20 }} />
            </>
          )}
        </ScrollView>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  ticketCount: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  ticketCountText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  ticketCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
  },
  imageSection: {
    height: 160,
    position: 'relative',
  },
  ticketImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  infoSection: {
    padding: 16,
  },
  eventInfo: {
    marginBottom: 12,
  },
  ticketTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ticketVenue: {
    fontSize: 14,
    flex: 1,
  },
  ticketDate: {
    fontSize: 13,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  ticketTypeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ticketCodeSection: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  ticketCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketCodeLabel: {
    fontSize: 12,
  },
  ticketCode: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    flex: 1,
  },
  qrSection: {
    marginTop: 12,
    alignItems: 'center',
  },
  qrDivider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
  },
  qrLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 12,
  },
  qrNote: {
    fontSize: 10,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  purchaseDate: {
    fontSize: 12,
    marginTop: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notchContainer: {
    position: 'absolute',
    top: 152,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notchLeft: {
    width: 20,
    height: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    marginLeft: -10,
  },
  notchRight: {
    width: 20,
    height: 20,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    marginRight: -10,
  },
  loadMoreButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
