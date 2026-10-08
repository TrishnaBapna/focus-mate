import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFocus } from "../hooks/useFocus";

// During a strict session, any attempt to open another page sends you back.
export default function StrictGuard() {
  const { strictActive } = useFocus();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (strictActive && pathname !== "/focus") navigate("/focus", { replace: true });
  }, [strictActive, pathname, navigate]);

  return null;
}
