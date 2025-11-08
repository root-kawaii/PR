import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Image, StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTickets } from '@/hooks/useTickets';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState } from 'react';

export const options = {
  icon: 'confirmation-number',
  tabBarLabel: 'Tickets',
};

type TicketFilter = 'current' | 'past';

export default function TicketsScreen() {
  const { tickets, loading, error, refetch } = useTickets();
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [filter, setFilter] = useState<TicketFilter>('current');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch(true); // Silent refetch
    await new Promise(resolve => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'confirmed':
        return '#10b981';
      case 'used':
        return '#6b7280';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  // Parse event date and check if it's in the future
  const isEventInFuture = (dateStr: string): boolean => {
    // Date format: "10 MAG | 23:00" or similar
    const monthMap: { [key: string]: number } = {
      'GEN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAG': 4, 'GIU': 5,
      'LUG': 6, 'AGO': 7, 'SET': 8, 'OTT': 9, 'NOV': 10, 'DIC': 11
    };

    const parts = dateStr.split('|')[0].trim().split(' ');
    if (parts.length !== 2) return true; // Default to current if can't parse

    const day = parseInt(parts[0]);
    const monthStr = parts[1];
    const month = monthMap[monthStr];

    if (month === undefined) return true;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // If the event month is before the current month, assume it's next year
    // Otherwise use current year
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
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ThemedView style={styles.container}>
        <View style={styles.headerContainer}>
          <ThemedText type="title" style={styles.header}>Your Tickets</ThemedText>
          <View style={styles.ticketCount}>
            <IconSymbol name="ticket.fill" size={16} color="#fff" />
            <Text style={styles.ticketCountText}>{tickets.length}</Text>
          </View>
        </View>

        {/* Filter Toggle Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'current' && styles.filterButtonActive]}
            onPress={() => setFilter('current')}
          >
            <Text style={[styles.filterButtonText, filter === 'current' && styles.filterButtonTextActive]}>
              Current
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'past' && styles.filterButtonActive]}
            onPress={() => setFilter('past')}
          >
            <Text style={[styles.filterButtonText, filter === 'past' && styles.filterButtonTextActive]}>
              Past
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#db2777" />
            <Text style={styles.loadingText}>Loading your tickets...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <IconSymbol name="exclamationmark.triangle.fill" size={48} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filteredTickets.length === 0 ? (
          <View style={styles.centerContainer}>
            <IconSymbol name="ticket.fill" size={64} color="#444" />
            <Text style={styles.emptyText}>No {filter} tickets</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'current'
                ? 'You have no upcoming events'
                : 'No past tickets found'}
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#db2777"
                colors={["#db2777"]}
                progressViewOffset={60}
              />
            }
          >
            {filteredTickets.map((ticket) => {
              const isExpanded = expandedTicket === ticket.id;

              return (
                <TouchableOpacity
                  key={ticket.id}
                  activeOpacity={0.9}
                  onPress={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                >
                  <LinearGradient
                    colors={['#1f2937', '#111827']}
                    style={styles.ticketCard}
                  >
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
                        <Text style={styles.ticketTitle} numberOfLines={1}>
                          {ticket.event.title}
                        </Text>

                        <View style={styles.detailRow}>
                          <IconSymbol name="location.fill" size={14} color="#9ca3af" />
                          <Text style={styles.ticketVenue} numberOfLines={1}>
                            {ticket.event.venue}
                          </Text>
                        </View>

                        <View style={styles.detailRow}>
                          <IconSymbol name="calendar" size={14} color="#9ca3af" />
                          <Text style={styles.ticketDate}>{ticket.event.date}</Text>
                        </View>
                      </View>

                      {/* Ticket Type and Price Row */}
                      <View style={styles.ticketMetaRow}>
                        <View style={styles.ticketTypeTag}>
                          <IconSymbol name="ticket.fill" size={12} color="#db2777" />
                          <Text style={styles.ticketTypeText}>{ticket.ticketType}</Text>
                        </View>

                        <View style={styles.priceContainer}>
                          <Text style={styles.priceText}>{ticket.price}</Text>
                        </View>
                      </View>

                      {/* Ticket Code */}
                      <View style={styles.ticketCodeSection}>
                        <View style={styles.ticketCodeRow}>
                          <IconSymbol name="barcode" size={16} color="#6b7280" />
                          <Text style={styles.ticketCodeLabel}>Ticket Code:</Text>
                          <Text style={styles.ticketCode}>{ticket.ticketCode}</Text>
                        </View>
                      </View>

                      {/* Expandable QR Code Section */}
                      {isExpanded && ticket.qrCode && (
                        <View style={styles.qrSection}>
                          <View style={styles.qrDivider} />
                          <Text style={styles.qrLabel}>Scan at entrance</Text>
                          <View style={styles.qrPlaceholder}>
                            <IconSymbol name="qrcode" size={120} color="#4b5563" />
                            <Text style={styles.qrNote}>QR Code: {ticket.qrCode}</Text>
                          </View>
                          <Text style={styles.purchaseDate}>
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
                        <Text style={styles.expandButtonText}>
                          {isExpanded ? 'Hide Details' : 'Show QR Code'}
                        </Text>
                        <IconSymbol
                          name={isExpanded ? "chevron.up" : "chevron.down"}
                          size={14}
                          color="#9ca3af"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Decorative Notch Pattern */}
                    <View style={styles.notchContainer}>
                      <View style={styles.notchLeft} />
                      <View style={styles.notchRight} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}

            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </ThemedView>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  ticketCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#db2777',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  ticketCountText: {
    color: '#fff',
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
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: '#374151',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#db2777',
    borderColor: '#ec4899',
  },
  filterButtonText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginTop: 8,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
  },
  ticketCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3748',
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
    color: '#fff',
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
    color: '#d1d5db',
    flex: 1,
  },
  ticketDate: {
    fontSize: 13,
    color: '#9ca3af',
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
    backgroundColor: 'rgba(219, 39, 119, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(219, 39, 119, 0.3)',
  },
  ticketTypeText: {
    color: '#ec4899',
    fontSize: 13,
    fontWeight: '600',
  },
  priceContainer: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  priceText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ticketCodeSection: {
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  ticketCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketCodeLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  ticketCode: {
    color: '#fff',
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
    backgroundColor: '#374151',
    width: '100%',
    marginBottom: 16,
  },
  qrLabel: {
    color: '#9ca3af',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
    marginBottom: 12,
  },
  qrNote: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  purchaseDate: {
    color: '#6b7280',
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
    color: '#9ca3af',
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
    backgroundColor: '#0a0a0a',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    marginLeft: -10,
  },
  notchRight: {
    width: 20,
    height: 20,
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    marginRight: -10,
  },
});