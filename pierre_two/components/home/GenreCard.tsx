// ====================================
// components/home/GenreCard.tsx
// ====================================
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Genre } from '@/types';

type GenreCardProps = {
  genre: Genre;
};

export const GenreCard = ({ genre }: GenreCardProps) => (
  <TouchableOpacity 
    style={[styles.genreCard, { backgroundColor: genre.color }]}
  >
    <ThemedText style={styles.genreText}>{genre.name}</ThemedText>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  genreCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  genreText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
});