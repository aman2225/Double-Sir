import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Card } from "@/engine/types";
import { cardId } from "@/engine/types";

interface UIState {
  selectedCard: Card | null;
  soundEnabled: boolean;
  /** Personal game-sound-effects volume (0-1), independent of music/voice volume. */
  sfxVolume: number;
  /** Whether the CommsDock (chat/emoji/voice panel) is currently open — read by useCommsNotifications so "new message" toasts only fire while the chat tab is out of view. */
  commsOpen: boolean;
  commsTab: "chat" | "emoji" | "voice";
  selectCard: (card: Card | null) => void;
  toggleSound: () => void;
  setSfxVolume: (volume: number) => void;
  setCommsOpen: (open: boolean) => void;
  setCommsTab: (tab: "chat" | "emoji" | "voice") => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      selectedCard: null,
      soundEnabled: true,
      sfxVolume: 1,
      commsOpen: false,
      commsTab: "chat",
      selectCard: (card) => {
        const current = get().selectedCard;
        if (card && current && cardId(card) === cardId(current)) {
          set({ selectedCard: null });
          return;
        }
        set({ selectedCard: card });
      },
      toggleSound: () => set({ soundEnabled: !get().soundEnabled }),
      setSfxVolume: (volume) => set({ sfxVolume: Math.max(0, Math.min(1, volume)) }),
      setCommsOpen: (open) => set({ commsOpen: open }),
      setCommsTab: (tab) => set({ commsTab: tab }),
    }),
    {
      name: "trick-taking-ui-prefs",
      partialize: (state) => ({ soundEnabled: state.soundEnabled, sfxVolume: state.sfxVolume }),
    }
  )
);
