import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Card } from "@/engine/types";
import { cardId } from "@/engine/types";

interface UIState {
  selectedCard: Card | null;
  soundEnabled: boolean;
  /** Whether the CommsDock (chat/emoji/voice panel) is currently open — read by useCommsNotifications so "new message" toasts only fire while the chat tab is out of view. */
  commsOpen: boolean;
  commsTab: "chat" | "emoji" | "voice";
  selectCard: (card: Card | null) => void;
  toggleSound: () => void;
  setCommsOpen: (open: boolean) => void;
  setCommsTab: (tab: "chat" | "emoji" | "voice") => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      selectedCard: null,
      soundEnabled: true,
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
      setCommsOpen: (open) => set({ commsOpen: open }),
      setCommsTab: (tab) => set({ commsTab: tab }),
    }),
    { name: "trick-taking-ui-prefs", partialize: (state) => ({ soundEnabled: state.soundEnabled }) }
  )
);
