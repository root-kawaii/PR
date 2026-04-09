// ====================================
// components/reservation/ReservationCodeModal.tsx
// ====================================
import { useState } from "react";
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/context/ThemeContext";

type ReservationCodeModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<void>;
};

export const ReservationCodeModal = ({
  visible,
  onClose,
  onSubmit,
}: ReservationCodeModalProps) => {
  const { theme } = useTheme();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError("Inserisci un codice prenotazione");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await onSubmit(code.trim());
      setCode("");
      setError("");
    } catch (err: any) {
      setError(err.message || "Prenotazione non trovata");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode("");
    setError("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                <LinearGradient
                  colors={[`${theme.primary}18`, "rgba(0,0,0,0)", `${theme.secondary}12`] as [string, string, string]}
                  style={styles.modalGlow}
                />
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                  <View style={styles.titleWrap}>
                    <View style={[styles.kicker, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}33` }]}>
                      <IconSymbol name="barcode" size={12} color={theme.primary} />
                      <ThemedText style={[styles.kickerText, { color: theme.primary }]}>Accesso rapido</ThemedText>
                    </View>
                    <ThemedText style={[styles.title, { color: theme.text }]}>Inserisci il codice</ThemedText>
                  </View>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.closeButton}
                  >
                    <IconSymbol name="xmark" size={24} color={theme.textTertiary} />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                  <ThemedText style={[styles.description, { color: theme.textTertiary }]}>
                    Inserisci il codice della prenotazione per vedere i dettagli del tavolo e, se necessario, completare la tua quota.
                  </ThemedText>

                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                    placeholder="Es: RES-XXXXXXXX"
                    placeholderTextColor={theme.textTertiary}
                    value={code}
                    onChangeText={(text) => {
                      setCode(text);
                      setError("");
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={20}
                  />

                  {error ? (
                    <View style={styles.errorContainer}>
                      <IconSymbol
                        name="exclamationmark.triangle.fill"
                        size={16}
                        color={theme.error}
                      />
                      <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
                    </View>
                  ) : null}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton, { backgroundColor: theme.backgroundSurface }]}
                    onPress={handleClose}
                    disabled={loading}
                  >
                    <ThemedText style={[styles.cancelButtonText, { color: theme.textTertiary }]}>
                      Annulla
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.submitButton,
                      { backgroundColor: theme.primary },
                      loading && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={theme.textInverse} />
                    ) : (
                      <ThemedText style={[styles.submitButtonText, { color: theme.textInverse }]}>
                        Cerca
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    overflow: "hidden",
    position: "relative",
  },
  modalGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  titleWrap: { flex: 1, paddingRight: 12 },
  kicker: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  kickerText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    letterSpacing: 1,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#ef4444",
  },
  actions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#2a2a2a",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9ca3af",
  },
  submitButton: {
    backgroundColor: "#ec4899",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
