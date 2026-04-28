const IS_STAGING = process.env.APP_ENV === 'staging';
const defaultApiUrl = IS_STAGING
  ? 'https://pierreclubs-backend-staging.fly.dev'
  : 'https://pierreclubs-backend-prod.fly.dev';
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  process.env.EAS_PROJECT_ID ||
  '6c405b8b-7cb7-454f-a1a7-fb52014dcf35';
const updatesUrl = easProjectId ? `https://u.expo.dev/${easProjectId}` : undefined;

const extra = {
  router: {},
  appEnv: process.env.APP_ENV || 'development',
  apiUrl: process.env.EXPO_PUBLIC_API_URL || defaultApiUrl,
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_KEY || '',
  posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_KEY || '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
  supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL || 'https://pierre.app/support',
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://pierre.app/privacy',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || 'https://pierre.app/terms',
};

if (easProjectId) {
  extra.eas = { projectId: easProjectId };
}

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
        NSCameraUsageDescription:
          'Pierre may use the camera when you choose to scan or upload event-related content.',
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
    ...(updatesUrl ? { updates: { url: updatesUrl } } : {}),
    runtimeVersion: {
      policy: 'appVersion',
    },
    extra,
  },
};
