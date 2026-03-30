import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { View, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { ThemedText } from "@/components/themed-text";
import { MarzipanoScene, Table } from "@/types";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

type MarzipanoViewerProps = {
  scenes: MarzipanoScene[];
  tables: Table[];
  onTableClick: (tableId: string) => void;
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  onError?: (error: string) => void;
  style?: ViewStyle;
};

export type MarzipanoViewerRef = {
  updateAvailability: (availabilityMap: Record<string, boolean>) => void;
  switchScene: (sceneId: string) => void;
  updateHotspotVisibility: (visibleTableIds: string[] | null) => void;
};

export const MarzipanoViewer = forwardRef<
  MarzipanoViewerRef,
  MarzipanoViewerProps
>(({ scenes, tables, onTableClick, onSceneChange, onError, style }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store callbacks in refs to avoid re-renders
  const onTableClickRef = useRef(onTableClick);
  const onSceneChangeRef = useRef(onSceneChange);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  useEffect(() => {
    onTableClickRef.current = onTableClick;
    onSceneChangeRef.current = onSceneChange;
    onErrorRef.current = onError;
  });

  // Track initialization
  const initializedRef = useRef(false);

  // Expose methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      updateAvailability: (availabilityMap: Record<string, boolean>) => {
        if (initializedRef.current && webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.updateHotspotAvailability(${JSON.stringify(
              availabilityMap
            )});
            true;
          `);
        }
      },
      switchScene: (sceneId: string) => {
        if (initializedRef.current && webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.switchToScene('${sceneId}');
            true;
          `);
        }
      },
      updateHotspotVisibility: (visibleTableIds: string[] | null) => {
        if (initializedRef.current && webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.updateHotspotVisibility(${JSON.stringify(visibleTableIds)});
            true;
          `);
        }
      },
    }),
    []
  );

  // Initialize viewer when ready (only once!)
  useEffect(() => {
    if (!viewerReady || initializedRef.current || !webViewRef.current) {
      return;
    }

    // Log to verify this only runs once
    console.log("🚀 React: Sending init to WebView (should only see this ONCE)");

    initializedRef.current = true;

    try {
      // Build availability map
      const availabilityMap: Record<string, boolean> = {};
      tables.forEach((table) => {
        availabilityMap[table.id] = table.available;
      });

      // Build scenes with hotspots - only include serializable data
      const scenesWithHotspots = scenes.map((scene) => ({
        id: scene.id,
        name: scene.name,
        imageUrl: scene.imageUrl,
        initialView: scene.initialView,
        hotspots: [
          ...scene.hotspots.map((h) => ({
            id: h.id,
            type: h.type,
            yaw: h.yaw,
            pitch: h.pitch,
            targetSceneId: h.targetSceneId,
            label: h.label,
          })),
          ...tables
            .filter((table) => table.marzipanoPosition?.sceneId === scene.id)
            .map((table) => ({
              id: `table-${table.id}`,
              type: "table" as const,
              yaw: table.marzipanoPosition!.yaw,
              pitch: table.marzipanoPosition!.pitch,
              tableId: table.id,
              tableName: table.name,
              available: table.available,
              capacity: table.capacity,
              minSpend: table.minSpend.replace(' €', ''),
              totalCost: table.totalCost.replace(' €', ''),
              features: table.features || [],
              locationDescription: table.locationDescription,
            })),
        ],
      }));

      const config = {
        scenes: scenesWithHotspots,
        availabilityMap,
      };

      // Test serialization first
      const configStr = JSON.stringify(config);
      console.log("🚀 Initializing with config size:", configStr.length);

      // Inject as a safe string with proper escaping
      const jsCode = `
        try {
          console.log('🔵 JavaScript injection starting...');
          const config = ${configStr};
          console.log('🔵 Config parsed, calling initMarzipanoViewer...');
          window.initMarzipanoViewer(config);
          console.log('🔵 initMarzipanoViewer called');
        } catch (e) {
          console.error('🔴 Error in injected JS:', e.message, e.stack);
        }
        true;
      `;

      webViewRef.current.injectJavaScript(jsCode);
    } catch (err) {
      console.error("Failed to serialize config:", err);
      setError("Failed to initialize viewer");
    }
  }, [viewerReady]); // Only depend on viewerReady - data is captured when effect runs

  // Stable message handler using refs
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case "READY_FOR_INIT":
          console.log("📍 Marzipano viewer ready for initialization");
          setViewerReady(true);
          break;

        case "VIEWER_READY":
          console.log("✅ Marzipano viewer initialized successfully");
          setIsLoading(false);
          break;

        case "HOTSPOT_CLICK":
          console.log(
            `🎯 Table hotspot clicked: ${message.tableName} (${message.tableId})`
          );
          onTableClickRef.current(message.tableId);
          break;

        case "UNAVAILABLE_TABLE_CLICK":
          console.log(
            `🎯 Unavailable table clicked: ${message.tableName} (${message.tableId})`
          );
          // Show alert or modal with info about unavailable table
          alert(`${message.tableName} is currently unavailable.\n\nWould you like to:\n• View other available tables\n• Join the waitlist\n• Contact us for more information`);
          break;

        case "SCENE_CHANGE":
          console.log(
            `🔄 Scene changed: ${message.sceneName} (${message.sceneId})`
          );
          onSceneChangeRef.current?.(message.sceneId, message.sceneName);
          break;

        case "ERROR":
          console.error(`❌ Marzipano error: ${message.message}`);
          setError(message.message);
          setIsLoading(false);
          onErrorRef.current?.(message.message);
          break;

        case "DEBUG":
          console.log(`🔍 WebView Debug: ${message.message}`);
          break;

        default:
          console.log("Marzipano message:", message);
      }
    } catch (err) {
      console.error("Error parsing Marzipano message:", err);
    }
  }, []); // Empty deps - uses refs

  // Load HTML content from asset — works reliably in both dev and production
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState("init");
  useEffect(() => {
    (async () => {
      try {
        setDebugInfo("loading asset...");
        const asset = Asset.fromModule(require("@/assets/marzipano/viewer.html"));
        await asset.downloadAsync();
        setDebugInfo(`asset downloaded, localUri: ${asset.localUri ? "yes" : "no"}`);
        if (asset.localUri) {
          const html = await FileSystem.readAsStringAsync(asset.localUri);
          setDebugInfo(`html loaded: ${html.length} chars, viewerReady: ${viewerReady}`);
          setHtmlContent(html);
        } else {
          setDebugInfo("no localUri!");
          setError("No localUri for viewer asset");
        }
      } catch (e: any) {
        setDebugInfo(`error: ${e.message}`);
        setError("Failed to load viewer: " + e.message);
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <ThemedText style={styles.errorIcon}>⚠️</ThemedText>
        <ThemedText style={styles.errorTitle}>
          Failed to Load 360° Tour
        </ThemedText>
        <ThemedText style={styles.errorMessage}>{error}</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ec4899" />
          <ThemedText style={styles.loadingText}>
            Loading 360° tour...
          </ThemedText>
          <ThemedText style={{ color: "#ff0", fontSize: 10, marginTop: 8, textAlign: "center" }}>
            DEBUG: {debugInfo} | html:{htmlContent ? htmlContent.length : "null"} | ready:{String(viewerReady)} | loading:{String(isLoading)}
          </ThemedText>
        </View>
      )}

      {!htmlContent && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ec4899" />
          <ThemedText style={styles.loadingText}>Preparing viewer...</ThemedText>
        </View>
      )}
      {htmlContent && <WebView
        ref={webViewRef}
        source={{ html: htmlContent, baseUrl: "" }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("❌ WebView error:", nativeEvent);
          setError("WebView failed to load");
          setIsLoading(false);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("❌ HTTP error:", nativeEvent.statusCode);
        }}
      />}
    </View>
  );
});

MarzipanoViewer.displayName = "MarzipanoViewer";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#9ca3af",
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
});
