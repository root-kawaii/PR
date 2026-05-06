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
  onAreaClick: (areaId: string, areaName?: string) => void;
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  onError?: (error: string) => void;
  style?: ViewStyle;
};

export type MarzipanoViewerRef = {
  updateAvailability: (availabilityMap: Record<string, boolean>) => void;
  switchScene: (sceneId: string) => void;
};

export const MarzipanoViewer = forwardRef<
  MarzipanoViewerRef,
  MarzipanoViewerProps
>(({ scenes, tables, onAreaClick, onSceneChange, onError, style }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onAreaClickRef = useRef(onAreaClick);
  const onSceneChangeRef = useRef(onSceneChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onAreaClickRef.current = onAreaClick;
    onSceneChangeRef.current = onSceneChange;
    onErrorRef.current = onError;
  });

  const initializedRef = useRef(false);

  const buildViewerConfig = useCallback(() => {
    const scenesWithHotspots = scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      imageUrl: scene.imageUrl,
      initialView: scene.initialView,
      hotspots: scene.hotspots.map((h) => {
        if (h.type === "area" && h.areaId) {
          const tablesInArea = tables.filter((t) => t.areaId === h.areaId);
          const availableTables = tablesInArea.filter((t) => t.available);
          const representative = availableTables[0] ?? tablesInArea[0];
          return {
            ...h,
            availableCount: availableTables.length,
            totalCount: tablesInArea.length,
            capacity: representative?.capacity,
            totalCost: representative?.totalCost,
            minSpend: representative?.minSpend,
            features: representative?.features,
            locationDescription: representative?.locationDescription,
          };
        }
        return { id: h.id, type: h.type, yaw: h.yaw, pitch: h.pitch,
                 targetSceneId: h.targetSceneId, label: h.label };
      }),
    }));

    return { scenes: scenesWithHotspots };
  }, [scenes, tables]);


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
    }),
    []
  );

  useEffect(() => {
    if (!viewerReady || initializedRef.current || !webViewRef.current) {
      return;
    }

    console.log("🚀 React: Sending init to WebView (should only see this ONCE)");

    initializedRef.current = true;

    try {
      const config = buildViewerConfig();

      const configStr = JSON.stringify(config);
      console.log("🚀 Initializing with config size:", configStr.length);

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
  }, [viewerReady, buildViewerConfig]);

  useEffect(() => {
    if (!viewerReady || !initializedRef.current || !webViewRef.current) {
      return;
    }

    try {
      const configStr = JSON.stringify(buildViewerConfig());
      webViewRef.current.injectJavaScript(`
        try {
          window.syncMarzipanoViewer(${configStr});
        } catch (e) {
          console.error('🔴 Error syncing Marzipano viewer:', e.message, e.stack);
        }
        true;
      `);
    } catch (err) {
      console.error("Failed to sync viewer config:", err);
    }
  }, [buildViewerConfig, viewerReady]);

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

        case "AREA_CLICK":
          console.log(
            `🎯 Area hotspot clicked: ${message.areaName} (${message.areaId})`
          );
          onAreaClickRef.current(message.areaId, message.areaName);
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
  }, []);

  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(require("@/assets/marzipano/viewer.html"));
        await asset.downloadAsync();
        if (asset.localUri) {
          const html = await FileSystem.readAsStringAsync(asset.localUri);
          setHtmlContent(html);
        } else {
          setError("No localUri for viewer asset");
        }
      } catch (e: any) {
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
