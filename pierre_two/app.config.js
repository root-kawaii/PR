const IS_STAGING = process.env.APP_ENV === 'staging';

export default {
  expo: {
    name: IS_STAGING ? 'Pierre (Staging)' : 'pierre_two',
    slug: 'pierre_two',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'pierretwo',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_STAGING ? 'PR.staging' : 'com.rootkawaii.pierre',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'Used to scan QR codes for event check-in.',
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: IS_STAGING ? 'com.rootkawaii.pierre_two.staging' : 'com.rootkawaii.pierre_two',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    updates: {
      url: 'https://u.expo.dev/4e65bba3-9d05-4b27-9300-a81a9b8181be',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    extra: {
      router: {},
      eas: {
        projectId: '4e65bba3-9d05-4b27-9300-a81a9b8181be',
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.4:3000',
      stripePublishableKey:
        process.env.EXPO_PUBLIC_STRIPE_KEY ||
        'pk_test_51SNYzEIyXBlTTF3RmSRveZFwJPPkaKiG7MUacAZTSTkEyo2iqyqpWkUIaZ3TIkH2enw0qYApvWBQlUp0r4TzYXzb009O0oylKv',
    },
  },
};
