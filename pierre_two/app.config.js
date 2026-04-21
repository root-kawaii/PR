const IS_STAGING = process.env.APP_ENV === 'staging';

export default {
  expo: {
    name: IS_STAGING ? 'Pierre (Staging)' : 'Pierre',
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
      'expo-localization',
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#ec4899',
          sounds: [],
        },
      ],
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
      appEnv: process.env.APP_ENV || 'development',
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://pierre-two-backend.fly.dev',
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_KEY || '',
      posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_KEY || '',
      posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL || 'https://pierre.app/support',
      privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://pierre.app/privacy',
      termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || 'https://pierre.app/terms',
    },
  },
};
