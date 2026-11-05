import { useEffect, useState } from 'react';

export interface Battery {
  /** 0–1 */
  level: number;
  charging: boolean;
}

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

/** The phone's battery, or null where the browser doesn't say. */
export function useBattery(): Battery | null {
  const [battery, setBattery] = useState<Battery | null>(null);

  useEffect(() => {
    const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }).getBattery;
    if (!getBattery) return;
    let manager: BatteryManager | null = null;
    const read = () => manager && setBattery({ level: manager.level, charging: manager.charging });
    void getBattery
      .call(navigator)
      .then((m) => {
        manager = m;
        read();
        m.addEventListener('levelchange', read);
        m.addEventListener('chargingchange', read);
      })
      .catch(() => undefined);
    return () => {
      manager?.removeEventListener('levelchange', read);
      manager?.removeEventListener('chargingchange', read);
    };
  }, []);

  return battery;
}
