import { db } from "../firestore";
import { parseClickUpLocation, type ClickUpLocation } from "./location";
import { DEFAULT_RECAP_MARKERS, type RecapConfig } from "./recap";

/** companies/{id}/integrations/clickup, edited by admins under Integrations. */
export interface ClickUpSettings extends RecapConfig {
  enabled: boolean;
}

export const DEFAULT_SETTINGS: ClickUpSettings = {
  enabled: false,
  recapMarkers: DEFAULT_RECAP_MARKERS,
  recapAuthor: "",
};

/**
 * companies/{id}/integrations/clickup-location, superadmin-only. Where the app
 * creates a ClickUp task for each new department goal.
 */
export interface ClickUpGoalLocation {
  url: string;
}

/** The RACI roles mirrored to People custom fields on the goal's ClickUp task. */
export const RACI_FIELD_NAMES = {
  accountable: "Accountable",
  responsible: "Responsible",
  consulted: "Consulted",
  informed: "Informed",
} as const;

export async function loadSettings(companyId: string): Promise<ClickUpSettings> {
  const snap = await db().doc(`companies/${companyId}/integrations/clickup`).get();
  const stored = (snap.data() ?? {}) as Partial<ClickUpSettings> & { recapMarker?: string };
  const markers =
    stored.recapMarkers?.filter(Boolean) ??
    // Settings saved before the rock plan existed held a single heading.
    (stored.recapMarker ? [stored.recapMarker, ...DEFAULT_RECAP_MARKERS] : DEFAULT_RECAP_MARKERS);
  return { ...DEFAULT_SETTINGS, ...stored, recapMarkers: Array.from(new Set(markers)) };
}

export async function loadGoalLocation(
  companyId: string
): Promise<(ClickUpLocation & { url: string }) | null> {
  const snap = await db().doc(`companies/${companyId}/integrations/clickup-location`).get();
  const url = (snap.data() as ClickUpGoalLocation | undefined)?.url?.trim();
  if (!url) return null;
  const parsed = parseClickUpLocation(url);
  return parsed ? { ...parsed, url } : null;
}
