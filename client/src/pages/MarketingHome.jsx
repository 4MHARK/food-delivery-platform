import { Link } from "react-router-dom";
import MarketingNavbar from "../components/MarketingNavbar";
import MarketingFooter from "../components/MarketingFooter";
import MarketingScrollToTop from "../components/MarketingScrollToTop";
import "../marketing.css";

const MarketingHome = () => (
  <div className="landing-page marketing-shell">
    <MarketingScrollToTop />
    <a className="skip-link" href="#main-content">Skip to content</a>
    <MarketingNavbar />
    <main id="main-content" tabIndex={-1}>
      <section className="hero" id="order">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> GOOD FOOD, GOOD MOOD</div>
          <h1>Big cravings.<br /><span>Small wait.</span></h1>
          <p className="hero-description">Find meals from campus restaurants, order in a few steps, and follow your delivery as it makes its way to you.</p>
          <div className="marketing-actions">
            <Link className="marketing-primary" to="/restaurants">Explore restaurants</Link>
            <Link className="marketing-secondary" to="/signup">Create an account</Link>
          </div>
          <div className="hero-note"><span className="material-symbols-outlined" aria-hidden="true">location_on</span><span>Browse local kitchens and order from their menus.</span></div>
        </div>
        <div className="hero-visual" aria-label="A freshly prepared meal ready for delivery">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="food-photo-wrap">
            <img
              className="food-photo"
              src="/images/hero-bowl-1000.jpg"
              srcSet="/images/hero-bowl-600.jpg 600w, /images/hero-bowl-1000.jpg 1000w"
              sizes="(max-width: 640px) 70vw, 390px"
              alt="Fresh colourful bowl with vegetables and grains"
              fetchPriority="high"
              decoding="async"
            />
            <span className="photo-label"><span /> Freshly made</span>
          </div>
          <div className="delivery-card"><span className="delivery-icon"><span className="material-symbols-outlined" aria-hidden="true">hourglass_empty</span></span><span><strong>Stay in the loop</strong><small>Follow your order updates</small></span><span className="delivery-check" aria-hidden="true">✓</span></div>
          <div className="floating-sticker">Made with<br /><b>love &amp; spice</b> <span>✳</span></div>
        </div>
      </section>
      <div className="hero-bottom"><span>Good food from the places you love</span><div className="cuisine-list"><span>Local favourites</span><i /><span>Quick bites</span><i /><span>Something sweet</span></div></div>
      <section className="how-section" id="how-it-works" aria-labelledby="how-heading">
        <div className="how-intro"><span className="section-kicker">GOOD FOOD IN A FEW STEPS</span><h2 id="how-heading">How ordering works</h2><p>From your first search to the first bite, ChowZilla keeps it simple.</p></div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-number" aria-hidden="true">01</span><span className="step-icon"><span className="material-symbols-outlined" aria-hidden="true">storefront</span></span><h3>Choose a restaurant</h3><p>Browse restaurants and find a menu that sounds good.</p></article>
          <article className="step-card"><span className="step-number" aria-hidden="true">02</span><span className="step-icon"><span className="material-symbols-outlined" aria-hidden="true">shopping_bag</span></span><h3>Pick your meal</h3><p>Add your favourites to the cart and place your order.</p></article>
          <article className="step-card"><span className="step-number" aria-hidden="true">03</span><span className="step-icon"><span className="material-symbols-outlined" aria-hidden="true">delivery_dining</span></span><h3>Follow your delivery</h3><p>See order updates while your food makes its way to you.</p></article>
        </div>
      </section>
      <section className="closing-cta" aria-labelledby="closing-cta-heading">
        <span className="cta-sparkle" aria-hidden="true">✳</span>
        <div className="closing-cta-copy"><p className="section-kicker">YOUR NEXT MEAL STARTS HERE</p><h2 id="closing-cta-heading">Good food is just around the corner.</h2><p>Explore the restaurants and menus already available on ChowZilla.</p></div>
        <Link className="closing-cta-button" to="/restaurants">Find a meal</Link>
      </section>
      <section className="join-section" aria-labelledby="join-heading">
        <div className="join-intro"><span className="section-kicker">GOOD THINGS GROW TOGETHER</span><h2 id="join-heading">Part of the ChowZilla story?</h2><p>Whether you make great food or deliver it, there’s a place for you here.</p></div>
        <div className="join-grid">
          <article className="join-card vendor-card" id="vendors"><span className="join-icon"><span className="material-symbols-outlined" aria-hidden="true">storefront</span></span><span className="join-label">FOR FOOD BUSINESSES</span><h3>Bring your kitchen to ChowZilla.</h3><p>Introduce your restaurant and menu to customers looking for their next meal.</p><Link className="join-link" to="/vendors">Vendor information</Link></article>
          <article className="join-card rider-card" id="riders"><span className="join-icon"><span className="material-symbols-outlined" aria-hidden="true">two_wheeler</span></span><span className="join-label">FOR DELIVERY RIDERS</span><h3>Deliver good food, your way.</h3><p>Learn about riding with ChowZilla and bringing orders to customers.</p><Link className="join-link" to="/riders">Rider information</Link></article>
        </div>
      </section>
      <section className="faq-section" id="faqs" aria-labelledby="faq-heading">
        <div className="faq-intro"><span className="section-kicker">A FEW HELPFUL ANSWERS</span><h2 id="faq-heading">Questions? We’ve got you.</h2><p>Here are a few things to know before your first order.</p></div>
        <div className="faq-list">
          <details className="faq-item"><summary>How do I find restaurants?</summary><p>Choose “Explore restaurants” to browse available restaurants and their menus.</p></details>
          <details className="faq-item"><summary>How do I place an order?</summary><p>Choose a restaurant, browse its menu, add what you’d like, then follow checkout to place your order.</p></details>
          <details className="faq-item"><summary>How can my restaurant join ChowZilla?</summary><p>Visit the <Link to="/vendors">Vendors page</Link> to learn about joining.</p></details>
        </div>
      </section>
    </main>
    <MarketingFooter />
  </div>
);

export default MarketingHome;
