"use client";

import { Music, Mic, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useMusicStore } from "@/store/useMusicStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { useUIStore } from "@/store/useUIStore";

/** The 3-slider "Individual Audio Controls" panel — every setting here is 100% personal/device-local, never synced to other players. */
export function MasterVolumeControls() {
  const musicVolume = useMusicStore((s) => s.volume);
  const setMusicVolume = useMusicStore((s) => s.setVolume);
  const masterVoiceVolume = useVoiceStore((s) => s.masterVoiceVolume);
  const setMasterVoiceVolume = useVoiceStore((s) => s.setMasterVoiceVolume);
  const sfxVolume = useUIStore((s) => s.sfxVolume);
  const setSfxVolume = useUIStore((s) => s.setSfxVolume);

  const rows = [
    { icon: Music, label: "Music", value: musicVolume, onChange: setMusicVolume },
    { icon: Mic, label: "Voice", value: masterVoiceVolume, onChange: setMasterVoiceVolume },
    { icon: Volume2, label: "Effects", value: sfxVolume, onChange: setSfxVolume },
  ];

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <Label className="text-xs text-muted-foreground">My audio</Label>
      {rows.map(({ icon: Icon, label, value, onChange }) => (
        <div key={label} className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
          <Slider
            className="flex-1"
            min={0}
            max={1}
            step={0.05}
            value={[value]}
            onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
          />
        </div>
      ))}
    </div>
  );
}
