import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Marketing pages are the logged-out entry point, so they need their own
 * scroll handling: route changes start at the top, and hash links land below
 * the sticky header. This is scoped to marketing pages so the authenticated
 * app keeps its existing scroll behaviour.
 */
const MarketingScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (hash) {
        const target = document.getElementById(hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: "auto", block: "start" });
          return;
        }
      }
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
};

export default MarketingScrollToTop;
