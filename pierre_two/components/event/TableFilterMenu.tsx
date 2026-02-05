import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SectionList,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Table } from "@/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MENU_WIDTH = Math.min(SCREEN_WIDTH * 0.85, 400);

interface TableFilterMenuProps {
  visible: boolean;
  onClose: () => void;
  tables: Table[];
  onTableSelect: (table: Table) => void;
  selectedTableId?: string;
  onFilterChange?: (filteredTableIds: string[]) => void;
}

interface TableSection {
  title: string;
  availableCount: number;
  data: Table[];
}

// Parse price string like "50.00 €" to number
const parsePriceString = (priceStr: string): number => {
  const match = priceStr.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

// Calculate price per person
const getPricePerPerson = (table: Table): number => {
  const minSpend = parsePriceString(table.minSpend);
  return table.capacity > 0 ? minSpend / table.capacity : 0;
};

export const TableFilterMenu: React.FC<TableFilterMenuProps> = ({
  visible,
  onClose,
  tables,
  onTableSelect,
  selectedTableId,
  onFilterChange,
}) => {
  const [searchText, setSearchText] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState(100);
  const [sortAscending, setSortAscending] = useState(true);
  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Calculate max price from tables for slider
  const maxPriceInData = useMemo(() => {
    if (tables.length === 0) return 100;
    const prices = tables.map(getPricePerPerson);
    return Math.ceil(Math.max(...prices, 100));
  }, [tables]);

  // Reset max price filter when tables change
  useEffect(() => {
    setMaxPriceFilter(maxPriceInData);
  }, [maxPriceInData]);

  // Animate menu open/close
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -MENU_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  // Filter and sort tables
  const filteredTables = useMemo(() => {
    return tables
      .filter((table) => {
        // Only show available tables
        if (!table.available) return false;

        // Search filter (name)
        if (searchText) {
          const searchLower = searchText.toLowerCase();
          if (!table.name.toLowerCase().includes(searchLower)) {
            return false;
          }
        }

        // Price per person filter
        const pricePerPerson = getPricePerPerson(table);
        if (pricePerPerson > maxPriceFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priceA = getPricePerPerson(a);
        const priceB = getPricePerPerson(b);
        return sortAscending ? priceA - priceB : priceB - priceA;
      });
  }, [tables, searchText, maxPriceFilter, sortAscending]);

  // Store callback in ref to avoid infinite loops
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  // Notify parent of filtered table IDs when filter changes
  useEffect(() => {
    const filteredIds = filteredTables.map((t) => t.id);
    onFilterChangeRef.current?.(filteredIds);
  }, [filteredTables]);

  // Group tables by zone
  const sections = useMemo((): TableSection[] => {
    const grouped = new Map<string, Table[]>();

    filteredTables.forEach((table) => {
      const zone = table.zone || "Altro";
      if (!grouped.has(zone)) {
        grouped.set(zone, []);
      }
      grouped.get(zone)!.push(table);
    });

    return Array.from(grouped.entries()).map(([zone, zoneTables]) => ({
      title: zone,
      availableCount: zoneTables.length,
      data: zoneTables,
    }));
  }, [filteredTables]);

  const handleTablePress = (table: Table) => {
    onTableSelect(table);
    onClose();
  };

  const renderSectionHeader = ({
    section,
  }: {
    section: TableSection;
  }) => (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
      <ThemedText style={styles.sectionCount}>
        ({section.availableCount} disponibili)
      </ThemedText>
    </View>
  );

  const renderTableRow = ({ item }: { item: Table }) => {
    const pricePerPerson = getPricePerPerson(item);
    const isSelected = item.id === selectedTableId;

    return (
      <TouchableOpacity
        style={[styles.tableRow, isSelected && styles.tableRowSelected]}
        onPress={() => handleTablePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.tableNameContainer}>
          <ThemedText style={styles.tableName}>{item.name}</ThemedText>
        </View>
        <View style={styles.tableCapacity}>
          <ThemedText style={styles.capacityIcon}>👥</ThemedText>
          <ThemedText style={styles.capacityText}>{item.capacity}</ThemedText>
        </View>
        <View style={styles.tablePrice}>
          <ThemedText style={styles.priceText}>
            {pricePerPerson.toFixed(0)}€
          </ThemedText>
          <ThemedText style={styles.priceLabel}>/persona</ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
        />
      </TouchableWithoutFeedback>

      {/* Menu Panel */}
      <Animated.View
        style={[
          styles.menuPanel,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>TAVOLI DISPONIBILI</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <IconSymbol
            name="magnifyingglass"
            size={18}
            color="#9ca3af"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca tavolo..."
            placeholderTextColor="#6b7280"
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchText("")}
              style={styles.clearButton}
            >
              <IconSymbol name="xmark" size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Price Filter */}
        <View style={styles.priceFilterContainer}>
          <View style={styles.priceFilterHeader}>
            <ThemedText style={styles.filterLabel}>Prezzo per persona</ThemedText>
            <ThemedText style={styles.priceValue}>
              max {maxPriceFilter}€
            </ThemedText>
          </View>
          <View style={styles.sliderContainer}>
            <ThemedText style={styles.sliderLabel}>0€</ThemedText>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={maxPriceInData}
              value={maxPriceFilter}
              onValueChange={(value) => setMaxPriceFilter(Math.round(value))}
              minimumTrackTintColor="#ec4899"
              maximumTrackTintColor="#374151"
              thumbTintColor="#ec4899"
            />
            <ThemedText style={styles.sliderLabel}>{maxPriceInData}€</ThemedText>
          </View>
        </View>

        {/* Sort Toggle */}
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortAscending(!sortAscending)}
        >
          <ThemedText style={styles.sortButtonText}>
            Prezzo {sortAscending ? "↑" : "↓"}
          </ThemedText>
        </TouchableOpacity>

        {/* Table List */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderTableRow}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>
                Nessun tavolo trovato
              </ThemedText>
            </View>
          }
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  menuPanel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: "#111827",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 5, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    height: "100%",
  },
  clearButton: {
    padding: 4,
  },
  priceFilterContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  priceFilterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ec4899",
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 12,
    color: "#6b7280",
    minWidth: 30,
    textAlign: "center",
  },
  sortButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1f2937",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1f2e",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ec4899",
    textTransform: "uppercase",
  },
  sectionCount: {
    fontSize: 12,
    color: "#9ca3af",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  tableRowSelected: {
    backgroundColor: "rgba(236, 72, 153, 0.15)",
  },
  tableNameContainer: {
    flex: 1,
  },
  tableName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#fff",
  },
  tableCapacity: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    gap: 4,
  },
  capacityIcon: {
    fontSize: 14,
  },
  capacityText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  tablePrice: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 70,
    justifyContent: "flex-end",
  },
  priceText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  priceLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginLeft: 2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
  },
});
