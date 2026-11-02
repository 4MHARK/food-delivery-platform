import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

const HashAwareLink = ({ href, className, children, onClick }) => (
  href.startsWith("#")
    ? <a href={href} className={className} onClick={onClick}>{children}</a>
    : <Link to={href} className={className} onClick={onClick}>{children}</Link>
);

const MarketingNavbar = ({ page = "customer" }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const { pathname } = useLocation();
  const isPartnerPage = page === "vendor" || page === "rider";
  const orderHref = "/restaurants";
  const howHref = isPartnerPage ? "#partner-steps" : "#how-it-works";
  const startHref = isPartnerPage ? "#partner-interest" : "/signup";
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 961px)");
    const closeOnDesktop = () => {
      if (desktopBreakpoint.matches) setMenuOpen(false);
    };
    desktopBreakpoint.addEventListener("change", closeOnDesktop);
    return () => desktopBreakpoint.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const closeOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const handleBrandClick = () => {
    if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header className="site-header" ref={headerRef}>
      <Link className="brand" to="/" aria-label="ChowZilla home" onClick={handleBrandClick}>
        <span className="brand-mark"><span className="material-symbols-outlined" aria-hidden="true">storefront</span></span>
        <span>Chow<span className="brand-accent">Zilla</span></span>
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        <Link to={orderHref}>Order food</Link>
        <a href={howHref}>How it works</a>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} to="/vendors">Vendors</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} to="/riders">Rider</NavLink>
      </nav>
      <div className="header-actions">
        <Link className="sign-in-link" to="/login">Sign in</Link>
        <HashAwareLink className="header-cta" href={startHref}>Get started</HashAwareLink>
      </div>
      <button
        className="mobile-menu"
        type="button"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? "marketing-mobile-navigation" : undefined}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">{menuOpen ? "close" : "menu"}</span>
      </button>
      {menuOpen && (
        <nav className="mobile-nav" id="marketing-mobile-navigation" aria-label="Mobile navigation">
          <Link to={orderHref} onClick={closeMenu}>Order food</Link>
          <a href={howHref} onClick={closeMenu}>How it works</a>
          <NavLink to="/vendors" onClick={closeMenu}>Vendors</NavLink>
          <NavLink to="/riders" onClick={closeMenu}>Rider</NavLink>
          <Link to="/login" onClick={closeMenu}>Sign in</Link>
          <HashAwareLink className="mobile-nav-cta" href={startHref} onClick={closeMenu}>Get started</HashAwareLink>
        </nav>
      )}
    </header>
  );
};

export default MarketingNavbar;
