"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useChatStore } from "@/store/useChatStore";
import { useUIStore } from "@/store/useUIStore";
import { Seat } from "@/engine/types";
import { ChatPanel } from "./ChatPanel";
import { EmojiPicker } from "./EmojiPicker";
import { VoiceControls } from "./VoiceControls";

interface CommsDockProps {
  roomCode: string;
  mySeat: Seat;
  myPlayerProfileId: string;
  otherSeats: Seat[];
  seatNames: Record<Seat, string>;
}

export function CommsDock({ roomCode, mySeat, myPlayerProfileId, otherSeats, seatNames }: CommsDockProps) {
  const open = useUIStore((s) => s.commsOpen);
  const setOpen = useUIStore((s) => s.setCommsOpen);
  const tab = useUIStore((s) => s.commsTab);
  const setTab = useUIStore((s) => s.setCommsTab);
  const messages = useChatStore((s) => s.messages);
  const sendEmoji = useChatStore((s) => s.sendEmoji);
  const chatVisible = open && tab === "chat";

  // "Adjusting state when a prop/derived value changes" — done directly
  // during render (guarded by a previous-value comparison) rather than in
  // an effect, per React's own guidance. Avoids both the extra render pass
  // an effect would cause and the "read a ref during render" pitfall.
  const [prevChatVisible, setPrevChatVisible] = useState(chatVisible);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  if (chatVisible !== prevChatVisible) {
    setPrevChatVisible(chatVisible);
    if (chatVisible) setLastSeenCount(messages.length);
  }
  const unread = chatVisible ? 0 : Math.max(0, messages.length - lastSeenCount);

  const tabs = (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex h-full flex-col">
      <TabsList className="w-full">
        <TabsTrigger value="chat" className="flex-1">
          Chat
        </TabsTrigger>
        <TabsTrigger value="emoji" className="flex-1">
          Emoji
        </TabsTrigger>
        <TabsTrigger value="voice" className="flex-1">
          Voice
        </TabsTrigger>
      </TabsList>
      <TabsContent value="chat" className="min-h-0 flex-1">
        <ChatPanel roomCode={roomCode} mySeat={mySeat} />
      </TabsContent>
      <TabsContent value="emoji" className="flex-1 overflow-y-auto">
        <div className="flex justify-center pt-2">
          <EmojiPicker onSelect={(emoji) => sendEmoji(roomCode, emoji)} />
        </div>
      </TabsContent>
      <TabsContent value="voice" className="flex-1 overflow-y-auto">
        <VoiceControls
          roomCode={roomCode}
          mySeat={mySeat}
          myPlayerProfileId={myPlayerProfileId}
          otherSeats={otherSeats}
          seatNames={seatNames}
        />
      </TabsContent>
    </Tabs>
  );

  return (
    <>
      <Button
        size="icon"
        aria-label="Open chat, emoji, and voice controls"
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-3 z-40 h-12 w-12 rounded-full shadow-2xl sm:right-4"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {/* Desktop: an in-flow floating panel beside the board — no modal backdrop, board stays fully visible and interactive. */}
      <div className="hidden sm:block">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 right-4 top-20 z-30 w-80 rounded-2xl border border-white/10 bg-card/80 p-3 shadow-2xl backdrop-blur-xl"
            >
              {tabs}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile: floating button opens a bottom sheet capped well under full height, so the table stays visible above it. */}
      <div className="sm:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[58vh] rounded-t-2xl border-white/10 bg-card/95 p-3 backdrop-blur-xl">
            <SheetHeader className="p-0 pb-1">
              <SheetTitle>Room {roomCode}</SheetTitle>
            </SheetHeader>
            {tabs}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
