import { useContext } from "react";
import { SocialContext } from "./SocialContext";

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used inside SocialProvider");
  return ctx;
}
