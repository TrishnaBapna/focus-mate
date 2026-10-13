import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  listenToFriendships,
  listenToMyProfile,
  listenToProfiles,
  updateWeekTotal,
} from "../services/social";
import { listenToSessions } from "../services/sessions";
import { weekSecondsOf, weekStartKey } from "../utils/week";
import type { Friendship, Profile } from "../types";

export function useMyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return listenToMyProfile(user.uid, (p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [user]);

  return { profile, loading };
}

export function useFriendships() {
  const { user } = useAuth();
  const [friendships, setFriendships] = useState<Friendship[]>([]);

  useEffect(() => {
    if (!user) return;
    return listenToFriendships(user.uid, setFriendships);
  }, [user]);

  return friendships;
}

export function useProfiles(uids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const key = uids.join(",");

  useEffect(() => {
    return listenToProfiles(key ? key.split(",") : [], (list) => {
      setProfiles(Object.fromEntries(list.map((p) => [p.id, p])));
    });
  }, [key]);

  return profiles;
}

// Keeps your public weekly total up to date (runs once, inside Layout)
export function useSyncProfile() {
  const { user } = useAuth();
  const { profile } = useMyProfile();
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    return listenToSessions(user.uid, 500, (list) => setSeconds(weekSecondsOf(list)));
  }, [user]);

  useEffect(() => {
    if (!user || !profile || seconds === null) return;
    const weekKey = weekStartKey(new Date());
    if (profile.weekKey === weekKey && profile.weekSeconds === seconds) return;
    updateWeekTotal(user.uid, weekKey, seconds).catch((err) =>
      console.error("Failed to sync weekly total", err)
    );
  }, [user, profile, seconds]);
}
