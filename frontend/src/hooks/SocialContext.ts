import { createContext } from "react";
import type { SocialSettings } from "../types/social";

export interface SocialValue {
  settings: SocialSettings | null; // null = hasn't joined yet
  loading: boolean;
  weekKey: string; // the Monday of this week
  weekSeconds: number; // your focus time this week
  level: number;
  setIdentity: (nickname: string, emoji: string) => Promise<void>;
  setGlobal: (on: boolean) => Promise<void>;
  createGroup: (name: string) => Promise<string>; // returns the join code
  joinGroup: (code: string) => Promise<string | null>; // null = joined, otherwise a message
  leaveGroup: (code: string, isOwner: boolean) => Promise<void>;
  forgetGroup: (code: string) => Promise<void>; // for groups that no longer exist
  stopSharing: () => Promise<void>;
}

export const SocialContext = createContext<SocialValue | null>(null);
