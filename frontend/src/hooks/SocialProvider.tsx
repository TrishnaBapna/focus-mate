import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAchievements } from "./useAchievements";
import { useAuth } from "./useAuth";
import { useHour } from "./useHour";
import { SocialContext } from "./SocialContext";
import {
  clearSocial,
  createGroupDoc,
  deleteGroup,
  fetchGroup,
  fetchMembers,
  listenToSocial,
  publishEntry,
  publishMember,
  removeEntries,
  removeMember,
  saveSocial,
} from "../services/social";
import {
  MAX_GROUP_SIZE,
  cleanCode,
  makeCode,
  weekKeysBack,
  weekSecondsFor,
  weekStartKey,
} from "../utils/social";
import type { SocialSettings } from "../types/social";

export default function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { sessions, progress, ready } = useAchievements();
  const hour = useHour();

  // undefined = still loading, null = this person hasn't joined
  const [loaded, setLoaded] = useState<SocialSettings | null | undefined>(undefined);
  const lastPushed = useRef("");

  useEffect(() => {
    if (!user) return;
    return listenToSocial(user.uid, setLoaded);
  }, [user]);

  const weekKey = useMemo(() => weekStartKey(), [hour]);
  const weekSeconds = useMemo(() => weekSecondsFor(sessions, weekKey), [sessions, weekKey]);
  const level = progress.level.level;
  const settings = loaded ?? null;

  // Keep the boards up to date: after a short pause, share the latest numbers
  useEffect(() => {
    if (!user || !ready || !settings || !settings.nickname) return;

    const stats = { nickname: settings.nickname, emoji: settings.emoji, level, weekSeconds };
    const signature = JSON.stringify([weekKey, settings.globalOn, settings.groupCodes, stats]);
    if (signature === lastPushed.current) return;

    const id = window.setTimeout(async () => {
      try {
        const jobs: Promise<unknown>[] = [];
        if (settings.globalOn) jobs.push(publishEntry(weekKey, user.uid, stats));
        for (const code of settings.groupCodes) {
          jobs.push(publishMember(code, user.uid, { ...stats, weekKey }));
        }
        await Promise.all(jobs);
        lastPushed.current = signature;
      } catch (err) {
        console.error("Couldn't update the leaderboards", err);
      }
    }, 1500);

    return () => window.clearTimeout(id);
  }, [user, ready, settings, level, weekSeconds, weekKey]);

  async function setIdentity(nickname: string, emoji: string) {
    if (!user) return;
    await saveSocial(user.uid, {
      nickname,
      emoji,
      globalOn: settings?.globalOn ?? false,
      groupCodes: settings?.groupCodes ?? [],
    });
  }

  async function setGlobal(on: boolean) {
    if (!user) return;
    await saveSocial(user.uid, { globalOn: on });
    if (!on) await removeEntries(user.uid, weekKeysBack(8));
  }

  async function createGroup(name: string) {
    if (!user || !settings) throw new Error("not-ready");
    const stats = { nickname: settings.nickname, emoji: settings.emoji, level, weekSeconds, weekKey };

    for (let attempt = 0; attempt < 4; attempt++) {
      const code = makeCode();
      try {
        await createGroupDoc(code, name.trim(), user.uid);
        await publishMember(code, user.uid, stats);
        await saveSocial(user.uid, { groupCodes: [...settings.groupCodes, code] });
        return code;
      } catch (err) {
        if (attempt === 3) throw err; // (a code clash is very rare, so we just try another)
      }
    }
    throw new Error("no-code");
  }

  async function joinGroup(input: string) {
    if (!user || !settings) return "Please try again in a moment.";
    const code = cleanCode(input);
    if (code.length !== 6) return "Group codes have 6 letters and numbers.";
    if (settings.groupCodes.includes(code)) return "You're already in that group.";

    const info = await fetchGroup(code);
    if (!info) return "No group found with that code.";

    await publishMember(code, user.uid, {
      nickname: settings.nickname,
      emoji: settings.emoji,
      level,
      weekSeconds,
      weekKey,
    });

    const members = await fetchMembers(code);
    if (members.length > MAX_GROUP_SIZE) {
      await removeMember(code, user.uid);
      return "That group is full.";
    }

    await saveSocial(user.uid, { groupCodes: [...settings.groupCodes, code] });
    return null;
  }

  async function forgetGroup(code: string) {
    if (!user || !settings) return;
    await saveSocial(user.uid, { groupCodes: settings.groupCodes.filter((c) => c !== code) });
  }

  async function leaveGroup(code: string, isOwner: boolean) {
    if (!user) return;
    if (isOwner) await deleteGroup(code); // the owner closing a group removes it for everyone
    else await removeMember(code, user.uid);
    await forgetGroup(code);
  }

  async function stopSharing() {
    if (!user || !settings) return;
    await removeEntries(user.uid, weekKeysBack(8));
    for (const code of settings.groupCodes) {
      try {
        const info = await fetchGroup(code);
        if (info && info.ownerUid === user.uid) await deleteGroup(code);
        else await removeMember(code, user.uid);
      } catch (err) {
        console.error("Couldn't leave group", code, err);
      }
    }
    await clearSocial(user.uid);
    lastPushed.current = "";
  }

  return (
    <SocialContext.Provider
      value={{
        settings,
        loading: loaded === undefined,
        weekKey,
        weekSeconds,
        level,
        setIdentity,
        setGlobal,
        createGroup,
        joinGroup,
        leaveGroup,
        forgetGroup,
        stopSharing,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
}
