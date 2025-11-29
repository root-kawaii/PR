import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Get the API URL based on the environment
 * Priority:
 * 1. Production URL from app.json extra config
 * 2. Platform-specific development URLs
 */
export const getApiUrl = (): string => {
  // Use production URL from app.json extra config if available
  const apiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (apiUrl) {
    return apiUrl;
  }

  // Fall back to local development
  const isDevice = Constants.isDevice;
  const isSimulator =
    Constants.deviceName?.includes("Simulator") ||
    Constants.deviceName?.includes("Emulator");

  // If explicitly a simulator/emulator, use localhost equivalents
  if (isSimulator === true) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3000"; // Android emulator
    }
    return "http://127.0.0.1:3000"; // iOS simulator
  }

  // If explicitly a device OR if we can't determine (safer to assume device)
  if (isDevice === true || (isDevice !== false && !isSimulator)) {
    // Physical device - use your computer's local network IP
    return "http://127.0.0.1:3000";
  }

  // Default fallback for simulators
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000"; // Android emulator
  }
  return "http://127.0.0.1:3000"; // iOS simulator and web
};

// Export the API_URL constant for convenience
export const API_URL = getApiUrl();
