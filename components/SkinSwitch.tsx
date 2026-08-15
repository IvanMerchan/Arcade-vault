"use client";

import { SKINS, SKIN_ORDER, type SkinId } from "@/lib/game-skins";

export function SkinSwitch({ value, onChange }: { value: SkinId; onChange: (id: SkinId) => void }) {
  return (
    <div className="skin-switch" role="radiogroup" aria-label="Aspecto del juego">
      {SKIN_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
        >
          {SKINS[id].label}
        </button>
      ))}
    </div>
  );
}
