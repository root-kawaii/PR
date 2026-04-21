import Constants from 'expo-constants';

const linksExtra = Constants.expoConfig?.extra ?? {};

const readUrl = (key: string, fallback: string) =>
  typeof linksExtra[key] === 'string' && linksExtra[key].length > 0
    ? linksExtra[key]
    : fallback;

export const SUPPORT_URL = readUrl('supportUrl', 'https://pierre.app/support');
export const PRIVACY_POLICY_URL = readUrl('privacyPolicyUrl', 'https://pierre.app/privacy');
export const TERMS_URL = readUrl('termsUrl', 'https://pierre.app/terms');
