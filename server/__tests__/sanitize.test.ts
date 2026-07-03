import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_MAX_LENGTH, isAllowedEmoji, sanitizeChatMessage } from "../sanitize";

describe("sanitizeChatMessage", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeChatMessage("  Trump Heart ❤  ")).toBe("Trump Heart ❤");
  });

  it("strips HTML tags", () => {
    expect(sanitizeChatMessage("<script>alert(1)</script>hello<b>bold</b>")).toBe("alert(1)hellobold");
  });

  it("strips control characters", () => {
    expect(sanitizeChatMessage("hi\x00there\x1f!")).toBe("hithere!");
  });

  it("enforces the max length", () => {
    const long = "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 50);
    const result = sanitizeChatMessage(long);
    expect(result).toHaveLength(CHAT_MESSAGE_MAX_LENGTH);
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(sanitizeChatMessage("")).toBeNull();
    expect(sanitizeChatMessage("   ")).toBeNull();
    expect(sanitizeChatMessage("<b></b>")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(sanitizeChatMessage(42)).toBeNull();
    expect(sanitizeChatMessage(null)).toBeNull();
    expect(sanitizeChatMessage(undefined)).toBeNull();
    expect(sanitizeChatMessage({})).toBeNull();
  });

  it("preserves emoji and normal punctuation", () => {
    expect(sanitizeChatMessage("Nice move! 😂")).toBe("Nice move! 😂");
  });
});

describe("isAllowedEmoji", () => {
  it("accepts whitelisted emoji", () => {
    expect(isAllowedEmoji("😀")).toBe(true);
    expect(isAllowedEmoji("👑")).toBe(true);
  });

  it("rejects arbitrary strings", () => {
    expect(isAllowedEmoji("hello")).toBe(false);
    expect(isAllowedEmoji("<script>")).toBe(false);
    expect(isAllowedEmoji("")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isAllowedEmoji(42)).toBe(false);
    expect(isAllowedEmoji(null)).toBe(false);
    expect(isAllowedEmoji(undefined)).toBe(false);
  });
});
