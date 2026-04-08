import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol, IconSymbolName } from "@/components/ui/icon-symbol";
import { useTheme } from "@/context/ThemeContext";
import { ThemePalette } from "@/constants/theme";
import { BlurView } from "expo-blur";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAIN_ROUTE_NAMES = ["index", "tickets", "profile"] as const;
const SEARCH_ROUTE_NAME = "explore";

const ROUTE_ICONS: Record<string, IconSymbolName> = {
  index: "house.fill",
  tickets: "ticket.fill",
  profile: "person",
  explore: "magnifyingglass",
};

function getRouteLabel(routeName: string) {
  switch (routeName) {
    case "index":
      return "Home";
    case "tickets":
      return "Acquisti";
    case "profile":
      return "Profilo";
    case "explore":
      return "Cerca";
    default:
      return routeName;
  }
}

function GlassSurface({
  children,
  theme,
  style,
}: {
  children: React.ReactNode;
  theme: ThemePalette;
  style?: object;
}) {
  return (
    <View style={style}>
      <BlurView
        intensity={40}
        tint="default"
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.glassTint,
          {
            backgroundColor: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.16)",
          },
        ]}
      />
      {children}
    </View>
  );
}

function IosSlackTabBar({
  state,
  descriptors,
  navigation,
  theme,
}: BottomTabBarProps & { theme: ThemePalette }) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;
  const mainRoutes = state.routes.filter((route) =>
    (MAIN_ROUTE_NAMES as readonly string[]).includes(route.name),
  );
  const searchRoute = state.routes.find(
    (route) => route.name === SEARCH_ROUTE_NAME,
  );

  const handlePress = (
    routeName: string,
    routeKey: string,
    isFocused: boolean,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const event = navigation.emit({
      type: "tabPress",
      target: routeKey,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const handleLongPress = (routeKey: string) => {
    navigation.emit({
      type: "tabLongPress",
      target: routeKey,
    });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.iosTabBarLayer,
        { bottom: Math.max(insets.bottom, 4) + 2 },
      ]}
    >
      <View style={styles.iosTabBarRow}>
        <GlassSurface theme={theme} style={styles.mainPill}>
          <View style={styles.mainPillContent}>
            {mainRoutes.map((route) => {
              const options = descriptors[route.key]?.options;
              const isFocused = activeRouteName === route.name;
              const label =
                typeof options?.title === "string"
                  ? options.title
                  : getRouteLabel(route.name);

              return (
                <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options?.tabBarAccessibilityLabel}
                  testID={options?.tabBarButtonTestID}
                  activeOpacity={0.9}
                  onPress={() => handlePress(route.name, route.key, isFocused)}
                  onLongPress={() => handleLongPress(route.key)}
                  style={[
                    styles.mainTabButton,
                    isFocused && {
                      backgroundColor: "rgba(255,255,255,0.11)",
                      borderColor: "rgba(255,255,255,0.14)",
                    },
                  ]}
                >
                  <IconSymbol
                    name={ROUTE_ICONS[route.name]}
                    size={28}
                    color={
                      isFocused ? theme.tabIconSelected : theme.tabIconDefault
                    }
                  />
                  <Text
                    style={[
                      styles.mainTabLabel,
                      {
                        color: isFocused
                          ? theme.tabIconSelected
                          : theme.tabIconDefault,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </GlassSurface>

        {searchRoute ? (
          <GlassSurface theme={theme} style={styles.searchOrb}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={
                activeRouteName === searchRoute.name ? { selected: true } : {}
              }
              accessibilityLabel="Cerca"
              activeOpacity={0.9}
              onPress={() =>
                handlePress(
                  searchRoute.name,
                  searchRoute.key,
                  activeRouteName === searchRoute.name,
                )
              }
              onLongPress={() => handleLongPress(searchRoute.key)}
              style={styles.searchOrbButton}
            >
              <IconSymbol
                name="magnifyingglass"
                size={30}
                color={
                  activeRouteName === searchRoute.name
                    ? theme.tabIconSelected
                    : theme.text
                }
              />
            </TouchableOpacity>
          </GlassSurface>
        ) : null}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useTheme();
  const useCustomIosTabBar = Platform.OS === "ios";

  return (
    <Tabs
      {...(useCustomIosTabBar
        ? {
            tabBar: (props: BottomTabBarProps) => (
              <IosSlackTabBar {...props} theme={theme} />
            ),
          }
        : {})}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.background,
        },
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: useCustomIosTabBar
          ? { display: "none" }
          : {
              backgroundColor: theme.tabBackground,
              borderTopColor: theme.border,
            },
        tabBarButton: useCustomIosTabBar ? undefined : HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Acquisti",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="ticket.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profilo",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Cerca",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="magnifyingglass" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iosTabBarLayer: {
    position: "absolute",
    left: 14,
    right: 14,
  },
  iosTabBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mainPill: {
    flex: 1,
    height: 74,
    borderRadius: 29,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  mainPillContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mainTabButton: {
    flex: 1,
    height: 58,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  mainTabLabel: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  searchOrb: {
    width: 74,
    height: 74,
    borderRadius: 37,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  searchOrbButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glassTint: {
    borderRadius: 32,
    borderWidth: 1,
  },
});
