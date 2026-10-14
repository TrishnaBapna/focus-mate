// What a person has chosen to share (kept privately in their own account)
export interface SocialSettings {
  nickname: string;
  emoji: string;
  globalOn: boolean; // appears on the global board
  groupCodes: string[]; // groups they belong to
}

// One line on a leaderboard (a global entry or a group member)
export interface BoardEntry {
  id: string; // the person's id
  nickname: string;
  emoji: string;
  level: number;
  weekSeconds: number;
  weekKey?: string; // which week these seconds are for (group members only)
}

export interface GroupInfo {
  code: string;
  name: string;
  ownerUid: string;
}
