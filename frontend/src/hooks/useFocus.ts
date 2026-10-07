import { useContext } from "react";
import { FocusContext } from "./FocusContext";

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used inside FocusProvider");
  return ctx;
}
