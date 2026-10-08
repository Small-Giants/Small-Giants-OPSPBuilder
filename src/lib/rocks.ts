import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  smartToDescription,
  type Quarter,
  type Rock,
  type SmartDescription,
} from "@/types";

export type RockDraft = Omit<Rock, "id">;

export function rocksCollection(companyId: string) {
  return collection(db, "companies", companyId, "rocks");
}

export function rockDoc(companyId: string, rockId: string) {
  return doc(db, "companies", companyId, "rocks", rockId);
}

/** Strips undefined values, which Firestore rejects outright. */
function scrub<T extends Record<string, any>>(value: T): T {
  const out: Record<string, any> = {};
  Object.entries(value).forEach(([key, v]) => {
    if (v === undefined) return;
    out[key] = v;
  });
  return out as T;
}

export function newRockDraft(params: {
  companyId: string;
  year: number;
  quarter?: Quarter;
  goalId?: string;
  ownerId?: string;
  ownerName?: string;
}): RockDraft {
  return {
    text: "",
    description: "",
    smart: undefined,
    status: "not_started",
    quarter: params.quarter ?? "Q1",
    year: params.year,
    goalId: params.goalId ?? "",
    progress: 0,
    priority: false,
    ownerId: params.ownerId ?? "",
    ownerName: params.ownerName ?? "",
    contributorIds: [],
    consultedIds: [],
    informedIds: [],
    companyId: params.companyId,
  };
}

/**
 * SMART is optional on a rock, so the free-text description is only replaced
 * when at least one SMART field has been filled in.
 */
function describe(draft: Partial<Rock>): string | undefined {
  const fromSmart = draft.smart ? smartToDescription(draft.smart) : "";
  if (fromSmart) return fromSmart;
  return draft.description;
}

export async function createRock(
  companyId: string,
  draft: RockDraft,
  createdBy?: string
): Promise<string> {
  const payload = scrub({
    ...draft,
    description: describe(draft) ?? "",
    companyId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: createdBy ?? "",
  });

  const ref = await addDoc(rocksCollection(companyId), payload);
  return ref.id;
}

export async function updateRock(
  companyId: string,
  rockId: string,
  updates: Partial<Rock>,
  updatedBy?: string
): Promise<void> {
  const { id: _id, ...rest } = updates as Partial<Rock> & { id?: string };
  const payload = scrub({
    ...rest,
    ...(rest.smart ? { description: describe(rest) } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy ?? rest.updatedBy,
  });

  await updateDoc(rockDoc(companyId, rockId), payload);
}

export async function deleteRock(
  companyId: string,
  rockId: string
): Promise<void> {
  await deleteDoc(rockDoc(companyId, rockId));
}

export function buildRockSmart(
  partial: Partial<SmartDescription> | undefined
): SmartDescription {
  return {
    specific: partial?.specific ?? "",
    measurable: partial?.measurable ?? "",
    achievable: partial?.achievable ?? "",
    relevant: partial?.relevant ?? "",
    timeBound: partial?.timeBound ?? "",
  };
}
