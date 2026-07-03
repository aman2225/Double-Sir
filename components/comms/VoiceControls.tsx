"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, Volume2, Headphones, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVoiceStore } from "@/store/useVoiceStore";
import { Seat } from "@/engine/types";
import { toast } from "sonner";

interface VoiceControlsProps {
  roomCode: string;
  mySeat: Seat;
  myPlayerProfileId: string;
  otherSeats: Seat[];
  seatNames: Record<Seat, string>;
}

export function VoiceControls({ roomCode, mySeat, myPlayerProfileId, otherSeats, seatNames }: VoiceControlsProps) {
  const voiceEnabled = useVoiceStore((s) => s.voiceEnabled);
  const micEnabled = useVoiceStore((s) => s.micEnabled);
  const pushToTalkEnabled = useVoiceStore((s) => s.pushToTalkEnabled);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const seatVolumes = useVoiceStore((s) => s.seatVolumes);
  const localMutedSeats = useVoiceStore((s) => s.localMutedSeats);
  const remoteMuted = useVoiceStore((s) => s.remoteMuted);

  const enableVoice = useVoiceStore((s) => s.enableVoice);
  const disableVoice = useVoiceStore((s) => s.disableVoice);
  const toggleMic = useVoiceStore((s) => s.toggleMic);
  const setPushToTalk = useVoiceStore((s) => s.setPushToTalk);
  const startPushToTalk = useVoiceStore((s) => s.startPushToTalk);
  const stopPushToTalk = useVoiceStore((s) => s.stopPushToTalk);
  const setSeatVolume = useVoiceStore((s) => s.setSeatVolume);
  const toggleLocalMute = useVoiceStore((s) => s.toggleLocalMute);
  const setOutputDevice = useVoiceStore((s) => s.setOutputDevice);

  const [busy, setBusy] = useState(false);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const supportsOutputSelection = typeof window !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  useEffect(() => {
    if (!voiceEnabled || !supportsOutputSelection) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setOutputDevices(devices.filter((d) => d.kind === "audiooutput")))
      .catch(() => {});
  }, [voiceEnabled, supportsOutputSelection]);

  async function handleEnableVoice() {
    setBusy(true);
    try {
      await enableVoice(roomCode, mySeat, myPlayerProfileId);
    } catch {
      toast.error("Couldn't access your microphone. Check browser permissions and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!voiceEnabled) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Button onClick={handleEnableVoice} disabled={busy}>
          <Mic className="mr-2 h-4 w-4" />
          {busy ? "Requesting microphone..." : "Enable Voice Chat"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Uses your microphone to talk with the other 3 players in this room.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={micEnabled && !pushToTalkEnabled ? "default" : "outline"}
            size="icon"
            aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            onClick={toggleMic}
            disabled={pushToTalkEnabled}
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <span className="text-sm text-muted-foreground">
            {pushToTalkEnabled ? "Push-to-talk" : micEnabled ? "Mic on" : "Muted"}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={disableVoice} className="text-xs text-muted-foreground">
          Leave voice
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Radio className="h-4 w-4 text-muted-foreground" />
          Push-to-talk
        </div>
        <Switch checked={pushToTalkEnabled} onCheckedChange={setPushToTalk} />
      </div>

      {pushToTalkEnabled && (
        <Button
          className="w-full select-none"
          variant="secondary"
          onPointerDown={startPushToTalk}
          onPointerUp={stopPushToTalk}
          onPointerLeave={stopPushToTalk}
        >
          Hold to Talk
        </Button>
      )}

      {supportsOutputSelection && outputDevices.length > 0 && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Headphones className="h-3.5 w-3.5" /> Output device
          </Label>
          <Select onValueChange={(value) => typeof value === "string" && value && setOutputDevice(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Default speaker" />
            </SelectTrigger>
            <SelectContent>
              {outputDevices.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label || "Speaker"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Other players</Label>
        {otherSeats.map((seat) => {
          const state = connectionState.get(seat) ?? "connecting";
          const isLocalMuted = localMutedSeats.has(seat);
          const theirMuted = remoteMuted.get(seat) ?? false;
          return (
            <div key={seat} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span className="w-16 truncate text-sm">{seatNames[seat]}</span>
              {state !== "connected" ? (
                <span className="text-xs text-muted-foreground">
                  {state === "failed" ? "Voice unavailable" : "Connecting..."}
                </span>
              ) : (
                <>
                  {theirMuted && <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <Slider
                    className="flex-1"
                    min={0}
                    max={1}
                    step={0.05}
                    value={[seatVolumes.get(seat) ?? 1]}
                    onValueChange={(v) => setSeatVolume(seat, Array.isArray(v) ? v[0] : v)}
                  />
                  <Button
                    variant={isLocalMuted ? "destructive" : "ghost"}
                    size="icon-xs"
                    aria-label={isLocalMuted ? `Unmute ${seatNames[seat]}` : `Mute ${seatNames[seat]}`}
                    onClick={() => toggleLocalMute(seat)}
                  >
                    {isLocalMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
