import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Legacy /auth route — now acts as a smart redirect.
 * If a school slug is persisted, redirect to the school-branded staff login.
 * Otherwise fall back to the School PIN entry screen.
 */
export default function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
    const slug = localStorage.getItem("schoolapp_school_slug");
    if (slug) {
      navigate(`/app/${slug}/login`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return null;
}
