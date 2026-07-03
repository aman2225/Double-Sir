"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EMOJI_REACTIONS } from "@/sockets/emojiEvents";
import { Smile } from "lucide-react";

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1 p-1">
      {EMOJI_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-transform hover:scale-125 hover:bg-white/10 active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** A small trigger button + popover, for placing next to a seat's avatar. */
export function EmojiQuickButton({ onSelect, className }: { onSelect: (emoji: string) => void; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className={className}
            aria-label="Send emoji reaction"
          />
        }
      >
        <Smile className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1" side="top">
        <EmojiPicker onSelect={onSelect} />
      </PopoverContent>
    </Popover>
  );
}
