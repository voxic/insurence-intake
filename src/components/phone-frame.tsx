import type { ReactNode } from "react";
import type { AccentId } from "@/lib/seeds/types";
import { formatClockTime } from "@/lib/utils";

export function PhoneFrame({
  children,
  time = new Date(),
  accent = "teal",
}: {
  children: ReactNode;
  time?: Date;
  accent?: AccentId;
}) {
  return (
    <div className="phone-device">
      <div className="phone-button phone-button-silent" />
      <div className="phone-button phone-button-vol-up" />
      <div className="phone-button phone-button-vol-down" />
      <div className="phone-button phone-button-power" />
      <div className="phone-bezel">
        <div className="phone-glass">
          <div className="phone-screen" data-accent={accent}>
            <div className="phone-status">
              <span>{formatClockTime(time)}</span>
              <div className="phone-island" aria-hidden="true" />
              <span className="phone-status-right">5G ●●●●</span>
            </div>
            <div className="phone-app">{children}</div>
            <div className="phone-home" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
