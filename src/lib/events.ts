import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Settings } from "../types";

export interface RoundStartPayload {
  low: number;
  high: number;
}

export interface RoundCallPayload {
  n: number;
  low: number;
  high: number;
  exploded: boolean;
}

export interface RoundUndoPayload {
  low: number;
  high: number;
  exploded: boolean;
}

export type RoundEndPayload = Record<string, never>;

export type NumberBombEvents = {
  "bomb:round-start": RoundStartPayload;
  "bomb:call": RoundCallPayload;
  "bomb:undo": RoundUndoPayload;
  "bomb:round-end": RoundEndPayload;
  "config:updated": Settings;
};

export function emitEvent<K extends keyof NumberBombEvents>(
  event: K,
  payload: NumberBombEvents[K]
): Promise<void> {
  return emit(event, payload);
}

export function onEvent<K extends keyof NumberBombEvents>(
  event: K,
  handler: (payload: NumberBombEvents[K]) => void
): Promise<UnlistenFn> {
  return listen<NumberBombEvents[K]>(event, (e) => handler(e.payload));
}
