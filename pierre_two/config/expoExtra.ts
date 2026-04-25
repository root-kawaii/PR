import Constants from "expo-constants";

type ExpoExtra = Record<string, unknown>;

export const getExpoExtra = (): ExpoExtra => {
  const constants = Constants as typeof Constants & {
    manifest?: { extra?: ExpoExtra };
    manifest2?: { extra?: ExpoExtra; extraClient?: { expoClient?: { extra?: ExpoExtra } } };
  };

  return (
    constants.expoConfig?.extra ||
    constants.manifest?.extra ||
    constants.manifest2?.extraClient?.expoClient?.extra ||
    constants.manifest2?.extra ||
    {}
  );
};

export const getExpoExtraString = (key: string): string => {
  const value = getExpoExtra()[key];
  return typeof value === "string" ? value : "";
};
