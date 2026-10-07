import { useEffect, useState } from "react";

// Current hour (0-23), refreshed every minute.
export function useHour() {
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60000);
    return () => window.clearInterval(id);
  }, []);

  return hour;
}
