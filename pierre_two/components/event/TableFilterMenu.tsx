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
import { useTheme } from "@/context/ThemeContext";
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
  data: AreaOption[];
}

interface AreaOption {
  title: string;
  availableCount: number;
  representativeTable: Table;
  tableIds: string[];
  pricePerPerson: number;
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
  const { theme } = useTheme();
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

  const getAreaLabel = (table: Table): string => {
    const areaName = table.areaName?.trim();
    if (areaName) return areaName;

    const zoneName = table.zone?.trim();
    if (zoneName) return zoneName;

    return "A";
  };

  const filteredAreas = useMemo(() => {
    const visibleTables = tables
      .filter((table) => {
        if (!table.available) return false;

        if (searchText) {
          const searchLower = searchText.toLowerCase();
          if (!getAreaLabel(table).toLowerCase().includes(searchLower)) {
            return false;
          }
        }

        const pricePerPerson = getPricePerPerson(table);
        return pricePerPerson <= maxPriceFilter;
      })
      .sort((a, b) => {
        const priceA = getPricePerPerson(a);
        const priceB = getPricePerPerson(b);
        return sortAscending ? priceA - priceB : priceB - priceA;
      });

    const grouped = new Map<string, Table[]>();
    visibleTables.forEach((table) => {
      const areaLabel = getAreaLabel(table);
      if (!grouped.has(areaLabel)) {
        grouped.set(areaLabel, []);
      }
      grouped.get(areaLabel)!.push(table);
    });

    return Array.from(grouped.entries()).map(([areaLabel, areaTables]) => ({
      title: areaLabel,
      availableCount: areaTables.length,
      representativeTable: areaTables[0],
      tableIds: areaTables.map((table) => table.id),
      pricePerPerson: getPricePerPerson(areaTables[0]),
    }));
  }, [tables, searchText, maxPriceFilter, sortAscending]);

  // Store callback in ref to avoid infinite loops
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  // Notify parent of filtered table IDs when filter changes
  useEffect(() => {
    const filteredIds = filteredAreas.flatMap((area) => area.tableIds);
    onFilterChangeRef.current?.(filteredIds);
  }, [filteredAreas]);

  const sections = useMemo((): TableSection[] => {
    return [{ title: "Aree disponibili", data: filteredAreas }];
  }, [filteredAreas]);

  const handleAreaPress = (area: AreaOption) => {
    onTableSelect(area.representativeTable);
    onClose();
  };

  const renderSectionHeader = ({ section }: { section: TableSection }) => (
    <View
      style={[
        styles.sectionHeader,
        {
          backgroundColor: theme.backgroundSurface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <ThemedText style={[styles.sectionTitle, { color: theme.secondary }]}>
        {section.title}
      </ThemedText>
    </View>
  );

  const renderAreaRow = ({ item }: { item: AreaOption }) => {
    const isSelected = item.tableIds.includes(selectedTableId ?? "");

    return (
      <TouchableOpacity
        style={[
          styles.tableRow,
          { borderBottomColor: theme.border },
          isSelected && { backgroundColor: `${theme.secondary}18` },
        ]}
        onPress={() => handleAreaPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.tableNameContainer}>
          <ThemedText style={[styles.tableName, { color: theme.text }]}>
            {item.title}
          </ThemedText>
          <ThemedText style={[styles.sectionCount, { color: theme.textTertiary }]}>
            {item.availableCount} tavoli disponibili in quest'area
          </ThemedText>
        </View>
        <View style={styles.tableCapacity}>
          <IconSymbol name="person.2.fill" size={15} color={theme.info} />
          <ThemedText style={[styles.capacityText, { color: theme.textSecondary }]}>
            {item.representativeTable.capacity}
          </ThemedText>
        </View>
        <View style={styles.tablePrice}>
          <ThemedText style={[styles.priceText, { color: theme.text }]}>
            {item.pricePerPerson.toFixed(0)}€
          </ThemedText>
          <ThemedText style={[styles.priceLabel, { color: theme.textTertiary }]}>
            /persona
          </ThemedText>
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
          style={[
            styles.backdrop,
            {
              backgroundColor: theme.overlay,
              opacity: backdropAnim,
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Menu Panel */}
      <Animated.View
        style={[
          styles.menuPanel,
          {
            backgroundColor: theme.modalBackground,
            borderRightColor: theme.border,
          },
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            AREE DISPONIBILI
          </ThemedText>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeButton,
              {
                backgroundColor: theme.backgroundSurface,
                borderColor: theme.border,
              },
            ]}
          >
            <IconSymbol name="xmark" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <IconSymbol
            name="magnifyingglass"
            size={18}
            color={theme.textTertiary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Cerca area..."
            placeholderTextColor={theme.textTertiary}
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
              <IconSymbol name="xmark" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Price Filter */}
        <View style={styles.priceFilterContainer}>
          <View style={styles.priceFilterHeader}>
            <ThemedText style={[styles.filterLabel, { color: theme.textSecondary }]}>
              Prezzo per persona
            </ThemedText>
            <ThemedText style={[styles.priceValue, { color: theme.secondary }]}>
              max {maxPriceFilter}€
            </ThemedText>
          </View>
          <View style={styles.sliderContainer}>
            <ThemedText style={[styles.sliderLabel, { color: theme.textTertiary }]}>
              0€
            </ThemedText>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={maxPriceInData}
              value={maxPriceFilter}
              onValueChange={(value) => setMaxPriceFilter(Math.round(value))}
              minimumTrackTintColor={theme.secondary}
              maximumTrackTintColor={theme.borderLight}
              thumbTintColor={theme.secondary}
            />
            <ThemedText style={[styles.sliderLabel, { color: theme.textTertiary }]}>
              {maxPriceInData}€
            </ThemedText>
          </View>
        </View>

        {/* Sort Toggle */}
        <TouchableOpacity
          style={[
            styles.sortButton,
            {
              backgroundColor: theme.backgroundSurface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => setSortAscending(!sortAscending)}
        >
          <ThemedText style={[styles.sortButtonText, { color: theme.text }]}>
            Prezzo {sortAscending ? "↑" : "↓"}
          </ThemedText>
        </TouchableOpacity>

        {/* Area List */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.title}
          renderItem={renderAreaRow}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ThemedText style={[styles.emptyText, { color: theme.textTertiary }]}>
                Nessuna area trovata
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
  },
  menuPanel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: MENU_WIDTH,
    borderRightWidth: 1,
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
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
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "600",
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
    minWidth: 30,
    textAlign: "center",
  },
  sortButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sectionCount: {
    fontSize: 12,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  tableNameContainer: {
    flex: 1,
  },
  tableName: {
    fontSize: 15,
    fontWeight: "500",
  },
  tableCapacity: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    gap: 4,
  },
  capacityText: {
    fontSize: 14,
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
  },
  priceLabel: {
    fontSize: 11,
    marginLeft: 2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
});
