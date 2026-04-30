import { TouchableOpacity, View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/context/ThemeContext';
import { Event } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';

type EventCardProps = {
  event: Event;
  onPress: () => void;
};

const formatEventTime = (event: Event) => {
  if (event.time) {
    return event.time;
  }
  try {
    const date = new Date(event.date);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
};

const formatEventDate = (dateStr: string) => {
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  try {
    const date = new Date(dateStr);
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  } catch (e) {
    return dateStr;
  }
};

const withAlpha = (hexColor: string, alpha: string) =>
  /^#([0-9a-f]{6})$/i.test(hexColor) ? `${hexColor}${alpha}` : hexColor;

export const EventCard = ({ event, onPress }: EventCardProps) => {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(280, Math.min(336, Math.round(width * 0.82)));
  const cardHeight = Math.round(cardWidth * 1.34);
  const infoPanelBackground =
    theme.statusBarStyle === 'dark'
      ? withAlpha(theme.modalBackground, 'CC')
      : withAlpha(theme.modalBackground, 'F0');

  return (
    <TouchableOpacity
      style={[styles.eventCard, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View
        style={[
          styles.eventImageContainer,
          {
            width: cardWidth,
            height: cardHeight,
            backgroundColor: theme.backgroundElevated,
            borderColor: withAlpha(theme.border, 'A6'),
          },
        ]}
      >
        <Image source={{ uri: event.image }} style={styles.eventImage} />
        <LinearGradient
          colors={theme.gradientOverlay as [string, string]}
          style={styles.imageOverlay}
        />
        <LinearGradient
          colors={[withAlpha(theme.primary, '2E'), withAlpha(theme.primary, '00')]}
          style={styles.topGlow}
        />
        <View
          pointerEvents="none"
          style={[styles.imageOutline, { borderColor: withAlpha(theme.textInverse, '14') }]}
        />
        <View style={[styles.topBar, { borderColor: theme.border }]}>
          <View
            style={[
              styles.iconChip,
              {
                backgroundColor: withAlpha(theme.background, 'D9'),
                borderColor: withAlpha(theme.border, 'B3'),
              },
            ]}
          >
            <IconSymbol name="ticket.fill" size={14} color={theme.primary} />
          </View>
          <View
            style={[
              styles.timeBadge,
              {
                backgroundColor: withAlpha(theme.background, 'C4'),
                borderColor: withAlpha(theme.border, '99'),
              },
            ]}
          >
            <IconSymbol name="clock.fill" size={14} color={theme.primary} />
            <ThemedText style={[styles.timeBadgeText, { color: theme.text }]}>{formatEventTime(event)}</ThemedText>
          </View>
        </View>
        <View
          style={[
            styles.infoPanel,
            {
              backgroundColor: infoPanelBackground,
              borderColor: withAlpha(theme.border, 'A6'),
            },
          ]}
        >
          {event.status && (
            <View style={styles.kickerRow}>
              <ThemedText style={[styles.kickerText, { color: theme.error }]}>
                {event.status}
              </ThemedText>
            </View>
          )}
          <View style={styles.titleRow}>
            <ThemedText style={[styles.eventTitle, { color: theme.text }]} numberOfLines={2}>
              {event.title}
            </ThemedText>
          </View>

          {event.venue ? (
            <View style={styles.metaRow}>
              <IconSymbol name="mappin" size={13} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>
                {event.venue}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <IconSymbol name="calendar" size={13} color={theme.textTertiary} />
            <ThemedText style={[styles.metaText, { color: theme.textTertiary }]} numberOfLines={1}>
              {formatEventDate(event.date)}
            </ThemedText>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  eventCard: {
  },
  eventImageContainer: {
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOutline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  kickerRow: {
    marginBottom: 6,
  },
  kickerText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  titleRow: {
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});
