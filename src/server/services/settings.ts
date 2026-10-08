import type { SettingsData } from "@/lib/schemas";
import type { PublicInfo, Settings } from "@/lib/types";
import { cached, invalidate } from "../cache";
import { sql } from "../db";

const SETTINGS_KEY = "settings";
const TTL_MS = 10 * 60_000;

interface SettingsRow {
  max_per_class: number;
  price_three_days: number;
  price_daily: number;
  booking_cutoff_minutes: number;
  trial_window_days: number;
  whatsapp_phone: string | null;
  address: string | null;
}

function toSettings(row: SettingsRow): Settings {
  return {
    maxPerClass: row.max_per_class,
    priceThreeDays: row.price_three_days,
    priceDaily: row.price_daily,
    bookingCutoffMinutes: row.booking_cutoff_minutes,
    trialWindowDays: row.trial_window_days,
    whatsappPhone: row.whatsapp_phone,
    address: row.address,
  };
}

/** Configuración general (en caché hasta que el admin la cambie). */
export function getSettings(): Promise<Settings> {
  return cached(SETTINGS_KEY, TTL_MS, async () => {
    const [row] = await sql<SettingsRow[]>`
      select max_per_class, price_three_days, price_daily, booking_cutoff_minutes,
             trial_window_days, whatsapp_phone, address
      from public.settings
      where id
    `;
    return toSettings(row);
  });
}

export async function getPublicInfo(): Promise<PublicInfo> {
  const s = await getSettings();
  return { whatsappPhone: s.whatsappPhone, address: s.address, maxPerClass: s.maxPerClass };
}

export async function updateSettings(v: SettingsData): Promise<Settings> {
  const [row] = await sql<SettingsRow[]>`
    update public.settings
    set max_per_class = ${v.maxPerClass},
        price_three_days = ${v.priceThreeDays},
        price_daily = ${v.priceDaily},
        booking_cutoff_minutes = ${v.bookingCutoffMinutes},
        trial_window_days = ${v.trialWindowDays},
        whatsapp_phone = ${v.whatsappPhone},
        address = ${v.address}
    where id
    returning max_per_class, price_three_days, price_daily, booking_cutoff_minutes,
              trial_window_days, whatsapp_phone, address
  `;
  invalidate(SETTINGS_KEY);
  return toSettings(row);
}
