import { Link, useLocation } from "react-router-dom";

const CONTACT_EMAIL = "ademoladav713@gmail.com";

const MarketingFooter = () => {
  const { pathname } = useLocation();

  const homeHashLink = (hash, label) => (
    pathname === "/"
      ? <a href={`#${hash}`}>{label}</a>
      : <Link to={`/#${hash}`}>{label}</Link>
  );

  const scrollToTop = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-column">
          <Link
            className="brand footer-brand"
            to="/"
            aria-label="ChowZilla home"
            onClick={() => { if (pathname === "/") scrollToTop(); }}
          >
            <span className="brand-mark"><span className="material-symbols-outlined" aria-hidden="true">storefront</span></span>
            <span>Chow<span className="brand-accent">Zilla</span></span>
          </Link>
          <p>Good food, made easier to find.</p>
          <a className="footer-contact" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
        <div className="footer-links-column">
          <h3>Explore</h3>
          <Link to="/restaurants">Restaurants</Link>
          {homeHashLink("how-it-works", "How it works")}
          {homeHashLink("faqs", "FAQs")}
        </div>
        <div className="footer-links-column">
          <h3>Join ChowZilla</h3>
          <Link to="/vendors">Vendors</Link>
          <Link to="/riders">Riders</Link>
        </div>
        <button className="footer-back-top" type="button" onClick={scrollToTop}>
          <span aria-hidden="true">↑</span>
          Back to top
        </button>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} ChowZilla</span><span>Made for good food days.</span></div>
    </footer>
  );
};

export default MarketingFooter;
