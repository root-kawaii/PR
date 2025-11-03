// ====================================
// components/home/ClubCard.tsx
// ====================================
import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Club } from '@/types';

type ClubCardProps = {
  club: Club;
  index: number;
};

export const ClubCard = ({ club, index }: ClubCardProps) => (
  <TouchableOpacity style={styles.clubCard}>
    <Image source={{ uri: club.image }} style={styles.clubImage} />
    <View style={[styles.clubOverlay, index === 0 ? styles.pinkGradient : styles.cyanGradient]} />
    <View style={styles.clubInfo}>
      <ThemedText style={styles.clubName} numberOfLines={1}>
        {club.name}
      </ThemedText>
      <ThemedText style={styles.clubSubtitle} numberOfLines={1}>
        {club.subtitle}
      </ThemedText>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  clubCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  clubImage: {
    width: '100%',
    height: '100%',
  },
  clubOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.6,
  },
  pinkGradient: {
    backgroundColor: '#ec4899',
  },
  cyanGradient: {
    backgroundColor: '#06b6d4',
  },
  clubInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  clubName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  clubSubtitle: {
    fontSize: 11,
    color: '#e5e7eb',
  },
});