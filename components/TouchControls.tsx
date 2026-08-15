"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { TouchButton } from "@/lib/touch-controls";
import type { GameSkin } from "@/lib/game-skins";

type TouchControlsProps = {
  buttons: TouchButton[];
  skin: GameSkin;
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
};

export function TouchControls({ buttons, skin, onPress, onRelease }: TouchControlsProps) {
  const left = buttons.filter((b) => b.side === "left");
  const right = buttons.filter((b) => b.side === "right");

  const handleDown = (code: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onPress(code);
  };
  // setPointerCapture keeps pointerup/cancel/lostpointercapture targeting this
  // same button even if the finger slides off it — release fires on all three
  // as a safety net so no action is ever left stuck pressed.
  const handleUp = (code: string) => () => onRelease(code);

  return (
    <div className="touch-controls">
      <div className="touch-controls-cluster">
        {left.map((btn) => (
          <button
            key={btn.code}
            type="button"
            className="touch-btn"
            aria-label={btn.aria}
            style={{ color: skin.primary, borderColor: skin.primary }}
            onPointerDown={handleDown(btn.code)}
            onPointerUp={handleUp(btn.code)}
            onPointerCancel={handleUp(btn.code)}
            onLostPointerCapture={handleUp(btn.code)}
          >
            {btn.glyph}
          </button>
        ))}
      </div>
      <div className="touch-controls-cluster">
        {right.map((btn) => (
          <button
            key={btn.code}
            type="button"
            className="touch-btn"
            aria-label={btn.aria}
            style={{ color: skin.accent, borderColor: skin.accent }}
            onPointerDown={handleDown(btn.code)}
            onPointerUp={handleUp(btn.code)}
            onPointerCancel={handleUp(btn.code)}
            onLostPointerCapture={handleUp(btn.code)}
          >
            {btn.glyph}
          </button>
        ))}
      </div>
    </div>
  );
}
