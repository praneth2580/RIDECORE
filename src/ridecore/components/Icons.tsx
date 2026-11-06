import type { ReactNode } from 'react';

/** RIDECORE's icons: one plain stroke, round ends, in the text's colour. */
function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);

export const LocateIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

/** The speedometer. */
export const GaugeIcon = () => (
  <Icon>
    <path d="M4.2 17.5a9 9 0 1 1 15.6 0" />
    <path d="m12 13 4-4.5" />
    <circle cx="12" cy="13" r="1.2" fill="currentColor" />
  </Icon>
);

/** The map: a road between two banks. */
export const MapIcon = () => (
  <Icon>
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Icon>
);

/** The trip: a flag at the end. */
export const FlagIcon = () => (
  <Icon>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" />
  </Icon>
);

/** A place to go. */
export const PinIcon = () => (
  <Icon>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
);

export const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

/** A place gone to before. */
export const RecentIcon = () => (
  <Icon>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
    <path d="M3.5 4v4h4" />
    <path d="M12 8v4l2.5 2" />
  </Icon>
);

export const CompassIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15 9-1.8 4.2L9 15l1.8-4.2Z" />
  </Icon>
);

/** GPS: a fix, with its signal around it. */
export const GpsIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
    <path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
  </Icon>
);

export const BatteryIcon = () => (
  <Icon>
    <rect x="3" y="7.5" width="16" height="9" rx="2" />
    <path d="M22 11v2" />
    <path d="M6.5 10.5v3M9.5 10.5v3" />
  </Icon>
);

export const VoiceIcon = () => (
  <Icon>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
);

export const VoiceOffIcon = () => (
  <Icon>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Icon>
);

/** Petrol pumps and places to eat on the map. */
export const FuelIcon = () => (
  <Icon>
    <path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20" />
    <path d="M3.5 20h12M5 10h9" />
    <path d="M14 8.5h2.5l2 2.5v6a1.5 1.5 0 0 1-3 0V13H14" />
  </Icon>
);

/** Recording: a dot in a ring. */
export const RecordIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
  </Icon>
);

/** The screen kept on. */
export const ScreenOnIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5" />
  </Icon>
);

/** The map zooming out with speed. */
export const ZoomIcon = () => (
  <Icon>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.5-4.5M7.5 10.5h6" />
  </Icon>
);

export const HomeIcon = () => (
  <Icon>
    <path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4Z" />
  </Icon>
);

/** The phone's own settings. */
export const GearIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.5M12 18.7v2.5M2.8 12h2.5M18.7 12h2.5M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
  </Icon>
);

/** Maps kept on the phone, for riding without signal. */
export const OfflineIcon = () => (
  <Icon>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </Icon>
);

export const EndIcon = () => (
  <Icon>
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
  </Icon>
);

/** Thrown away: a ride not kept. */
export const DiscardIcon = () => (
  <Icon>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7" />
    <path d="m6.5 7 .9 11.6c.1 1.1.9 1.9 2 1.9h5.2c1.1 0 1.9-.8 2-1.9L17.5 7" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

/** The phone's apps. */
export const GridIcon = () => (
  <Icon>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
  </Icon>
);

export const MusicIcon = () => (
  <Icon>
    <path d="M9 18V5.5l11-2V16" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Icon>
);

export const RadioIcon = () => (
  <Icon>
    <rect x="3" y="8" width="18" height="12" rx="2.5" />
    <path d="m7 8 9-4.5" />
    <circle cx="15.5" cy="14" r="2.5" />
    <path d="M6.5 12.5h3M6.5 15.5h3" />
  </Icon>
);

export const PlayIcon = () => (
  <Icon>
    <path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7Z" fill="currentColor" />
  </Icon>
);

export const PauseIcon = () => (
  <Icon>
    <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
  </Icon>
);

export const NextIcon = () => (
  <Icon>
    <path d="M5.5 6.2v11.6a.7.7 0 0 0 1.1.6l8.6-5.8a.7.7 0 0 0 0-1.2L6.6 5.6a.7.7 0 0 0-1.1.6Z" fill="currentColor" />
    <path d="M18.5 5.5v13" />
  </Icon>
);

export const PreviousIcon = () => (
  <Icon>
    <path d="M18.5 6.2v11.6a.7.7 0 0 1-1.1.6l-8.6-5.8a.7.7 0 0 1 0-1.2l8.6-5.8a.7.7 0 0 1 1.1.6Z" fill="currentColor" />
    <path d="M5.5 5.5v13" />
  </Icon>
);

export const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <Icon>
    <path
      d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
);

export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
);

export const CloudIcon = () => (
  <Icon>
    <path d="M7 18.5h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 11a3.8 3.8 0 0 0 1 7.5Z" />
  </Icon>
);

export const RainIcon = () => (
  <Icon>
    <path d="M7 14.5h10a3.6 3.6 0 0 0 .5-7.2A5.5 5.5 0 0 0 6.6 8 3.3 3.3 0 0 0 7 14.5Z" />
    <path d="m8.5 17.5-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5" />
  </Icon>
);

export const StormIcon = () => (
  <Icon>
    <path d="M7 14.5h10a3.6 3.6 0 0 0 .5-7.2A5.5 5.5 0 0 0 6.6 8 3.3 3.3 0 0 0 7 14.5Z" />
    <path d="m12.5 15-2 3.5h3l-2 3.5" />
  </Icon>
);

export const FogIcon = () => (
  <Icon>
    <path d="M4 9h16M6 13h12M4 17h16" />
  </Icon>
);

/** The weather in one picture. */
export const WeatherIcon = ({ kind }: { kind: 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' }) =>
  kind === 'clear' ? <SunIcon /> : kind === 'fog' ? <FogIcon /> : kind === 'storm' ? <StormIcon /> : kind === 'cloudy' || kind === 'snow' ? <CloudIcon /> : <RainIcon />;

/** The screen's edge lit for a turn. */
export const GlowIcon = () => (
  <Icon>
    <rect x="6" y="3.5" width="12" height="17" rx="2.5" />
    <path d="M2.5 7v10M21.5 7v10" />
    <path d="m13.5 9.5-3 2.5 3 2.5" />
  </Icon>
);

/** A SIM's signal: four rising bars, lit up to the level; all dim when unknown. */
export const SignalIcon = ({ level }: { level: number | null }) => (
  <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className="rc-signal">
    {[0, 1, 2, 3].map((bar) => (
      <rect
        key={bar}
        x={3 + bar * 5}
        y={18 - (bar + 1) * 3.6}
        width="3.4"
        height={(bar + 1) * 3.6 + 2}
        rx="1"
        fill="currentColor"
        opacity={level == null ? 0.55 : bar < level ? 1 : 0.25}
      />
    ))}
  </svg>
);

export const WifiIcon = () => (
  <Icon>
    <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" />
    <circle cx="12" cy="19.3" r="1.3" fill="currentColor" />
  </Icon>
);

export const AirplaneIcon = () => (
  <Icon>
    <path d="M10.5 20.5 12 18l1.5 2.5M12 3.5c.9 0 1.5.9 1.5 2V10l7 4v2l-7-2v4h-3v-4l-7 2v-2l7-4V5.5c0-1.1.6-2 1.5-2Z" />
  </Icon>
);

/** No connection at all. */
export const NoNetworkIcon = () => (
  <Icon>
    <path d="M7 18h10a4 4 0 0 0 1.2-7.8A6 6 0 0 0 7.3 8.6" />
    <path d="M5.4 10.6A3.8 3.8 0 0 0 7 18" />
    <path d="m3.5 3.5 17 17" />
  </Icon>
);

/** A headset: a helmet's intercom or earphones, to hear navigation in. */
export const HeadsetIcon = () => (
  <Icon>
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <rect x="3" y="14" width="4.5" height="6.5" rx="1.8" />
    <rect x="16.5" y="14" width="4.5" height="6.5" rx="1.8" />
  </Icon>
);

/** The phone's battery, filled to its charge, a bolt while charging. */
export const BatteryLevelIcon = ({ level, charging }: { level: number; charging: boolean }) => (
  <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <rect x="2.5" y="7" width="17" height="10" rx="2.4" />
    <path d="M21.5 10.5v3" strokeLinecap="round" />
    <rect x="4.6" y="9.1" width={Math.max(0.8, 12.8 * Math.min(1, Math.max(0, level)))} height="5.8" rx="1.1" fill="currentColor" stroke="none" />
    {charging ? <path d="m11.8 8.2-2.6 4.3h3.4l-2.4 3.3" stroke="#000" strokeWidth="1.6" strokeLinecap="round" /> : null}
  </svg>
);
