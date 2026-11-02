import { useState } from "react";
import MarketingNavbar from "../components/MarketingNavbar";
import MarketingFooter from "../components/MarketingFooter";
import MarketingScrollToTop from "../components/MarketingScrollToTop";
import "../marketing.css";

const content = {
  vendor: {
    title: "Let more people discover your food.",
    description: "Bring your restaurant to ChowZilla and make your menu easier for customers to find.",
    image: "/images/vendor-kitchen.jpg",
    imageAlt: "Chef preparing food in a warmly lit restaurant kitchen",
    features: [
      ["storefront", "Showcase your menu", "Give customers a clear place to explore the dishes your kitchen offers."],
      ["location_on", "Reach customers nearby", "Help people looking for food discover your restaurant."],
      ["receipt_long", "Keep the details clear", "Share the menu, hours, and information customers need to order."],
    ],
    steps: ["Tell us about your restaurant", "Share your menu and details", "Prepare to receive orders"],
    extraLabel: "Restaurant name",
    extraName: "restaurant",
    extraPlaceholder: "e.g. ChowZilla Kitchen",
  },
  rider: {
    title: "Bring great food to someone’s door.",
    description: "Learn about delivering with ChowZilla and helping local orders find their way home.",
    image: "/images/rider-delivery-man.jpg",
    imageAlt: "Delivery man in uniform sitting on a motorcycle with a delivery bag",
    features: [
      ["two_wheeler", "Deliver around your area", "Help connect nearby kitchens with the people who ordered from them."],
      ["location_on", "Know where you’re going", "Get the delivery details you need for each order."],
      ["delivery_dining", "A clear way to get started", "Share your details and learn about the rider onboarding process."],
    ],
    steps: ["Tell us about yourself", "Review the onboarding details", "Get ready to ride"],
    extraLabel: "Your city or area",
    extraName: "area",
    extraPlaceholder: "e.g. Yaba, Lagos",
  },
};

const MATRIC_KEY_PATTERN = /^[a-zA-Z0-9/-]$/;
const VEHICLE_KEY_PATTERN = /^[a-zA-Z0-9 -]$/;

const filterMatric = (value) => value.toUpperCase().replace(/[^A-Z0-9/-]/g, "").replace(/^[^A-Z0-9]+/, "").slice(0, 20);
const filterVehicle = (value) => value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").replace(/^[^A-Z0-9]+/, "").replace(/\s{2,}/g, " ").slice(0, 12);
const checkIdentifier = (type, value) => type === "student"
  ? (/^(?=.*\d)[A-Z0-9][A-Z0-9/-]{3,18}[A-Z0-9]$/.test(value.trim()) ? "" : "Enter a matric number with 5–20 characters and at least one number.")
  : (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9][A-Z0-9 -]{3,10}[A-Z0-9]$/.test(value.trim()) ? "" : "Enter a vehicle number with 5–12 characters, including a letter and a number.");

const blockInvalidKeys = (pattern) => (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
  if (!pattern.test(event.key)) event.preventDefault();
};

const Icon = ({ name }) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;

const PartnerLanding = ({ type }) => {
  const page = content[type];
  const [riderType, setRiderType] = useState("");
  const [matric, setMatric] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitInterest = (event) => {
    event.preventDefault();
    if (type === "rider") {
      const value = riderType === "student" ? matric : vehicle;
      const validationError = riderType ? checkIdentifier(riderType, value) : "Choose Student or Shuttle to continue.";
      if (validationError) {
        setError(validationError);
        setSubmitted(false);
        return;
      }
    }
    setError("");
    setSubmitted(true);
  };

  return (
    <div className={`partner-page partner-page-${type} marketing-shell`}>
      <MarketingScrollToTop />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <MarketingNavbar page={type} />
      <main id="main-content" tabIndex={-1}>
        <section className="partner-hero">
          <div className="partner-hero-copy">
            <span className="partner-kicker"><i /> {type === "vendor" ? "FOR FOOD BUSINESSES" : "FOR DELIVERY RIDERS"}</span>
            <h1>{page.title}</h1><p>{page.description}</p>
            <div className="partner-hero-actions"><a className="partner-primary-button" href="#partner-interest">Get started</a><a className="partner-secondary-link" href="#partner-steps">See how it works</a></div>
          </div>
          <div className="partner-hero-visual"><div className="partner-image-orbit" /><img src={page.image} alt={page.imageAlt} /><span className="partner-image-note"><Icon name={type === "vendor" ? "storefront" : "two_wheeler"} />{type === "vendor" ? "Made with care" : "Ready for the road"}</span></div>
        </section>
        <section className="partner-benefits" aria-labelledby="partner-benefits-heading">
          <div className="partner-section-heading"><span className="partner-kicker">A GOOD WAY FORWARD</span><h2 id="partner-benefits-heading">Built around the people who make delivery happen.</h2><p>{type === "vendor" ? "A simple starting point for restaurants that want to be part of ChowZilla." : "A clear starting point for riders interested in delivering with ChowZilla."}</p></div>
          <div className="partner-feature-grid">{page.features.map(([icon, title, text], index) => <article className="partner-feature-card" key={title}><span className="partner-feature-icon"><Icon name={icon} /></span><span className="partner-feature-number" aria-hidden="true">0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>
        <section className="partner-steps" id="partner-steps" aria-labelledby="partner-steps-heading">
          <div className="partner-section-heading"><span className="partner-kicker">GETTING STARTED</span><h2 id="partner-steps-heading">A few steps to get the conversation going.</h2></div>
          <div className="partner-step-grid">{page.steps.map((step, index) => <article className="partner-step" key={step}><span aria-hidden="true">0{index + 1}</span><h3>{step}</h3></article>)}</div>
        </section>
        <section className="partner-interest-section" id="partner-interest" aria-labelledby="partner-interest-heading">
          <div className="partner-interest-copy"><span className="partner-kicker">LET’S TALK</span><h2 id="partner-interest-heading">Be part of what’s next.</h2><p>Share a few details and we’ll have a starting point for the onboarding conversation.</p><span className="partner-interest-mark"><Icon name={type === "vendor" ? "storefront" : "two_wheeler"} /></span></div>
          <form className="partner-interest-form" onSubmit={submitInterest} onChange={() => setSubmitted(false)}>
            <div className="partner-form-context"><span className="partner-form-context-icon"><Icon name={type === "vendor" ? "storefront" : "two_wheeler"} /></span><span>{type === "vendor" ? "RESTAURANT PARTNER" : "DELIVERY PARTNER"} <i /> INTEREST FORM</span></div>
            <h3>{type === "vendor" ? "Tell us about your restaurant" : "Interested in riding with us?"}</h3>
            <p>{type === "vendor" ? "Register your interest in joining ChowZilla as a vendor." : "Register your interest in delivering with ChowZilla."}</p>
            {type === "rider" && <fieldset className="partner-rider-type"><legend>How are you joining as a rider?</legend><div className="partner-rider-type-options">
              <label className={`partner-rider-type-option${riderType === "student" ? " is-selected" : ""}`}><input type="radio" name="riderType" value="student" required checked={riderType === "student"} onChange={() => { setRiderType("student"); setError(""); }} /><span className="partner-rider-type-icon"><Icon name="person" /></span><span><strong>Student</strong><small>Join with your matric details</small></span></label>
              <label className={`partner-rider-type-option${riderType === "shuttle" ? " is-selected" : ""}`}><input type="radio" name="riderType" value="shuttle" required checked={riderType === "shuttle"} onChange={() => { setRiderType("shuttle"); setError(""); }} /><span className="partner-rider-type-icon"><Icon name="delivery_dining" /></span><span><strong>Shuttle</strong><small>Join with your vehicle details</small></span></label>
            </div></fieldset>}
            {type === "rider" && riderType && <div className={`partner-field${error ? " has-error" : ""}`}>
              <label htmlFor="rider-identifier">{riderType === "student" ? "Matric number" : "Vehicle number"}</label>
              <span className="partner-input-wrap">
                <Icon name={riderType === "student" ? "person" : "delivery_dining"} />
                {riderType === "student" ? (
                  <input
                    id="rider-identifier"
                    name="matricNumber"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    inputMode="text"
                    maxLength={20}
                    required
                    value={matric}
                    onChange={(event) => { setMatric(filterMatric(event.target.value)); setError(""); }}
                    onKeyDown={blockInvalidKeys(MATRIC_KEY_PATTERN)}
                    placeholder="e.g. 2020/12345"
                    pattern="[A-Z0-9][A-Z0-9/-]{3,18}[A-Z0-9]"
                    title="Use 5–20 characters with at least one number."
                    aria-invalid={Boolean(error)}
                    aria-describedby={`marketing-rider-identifier-hint${error ? " marketing-rider-identifier-error" : ""}`}
                  />
                ) : (
                  <input
                    id="rider-identifier"
                    name="vehicleNumber"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    inputMode="text"
                    maxLength={12}
                    required
                    value={vehicle}
                    onChange={(event) => { setVehicle(filterVehicle(event.target.value)); setError(""); }}
                    onBlur={(event) => setVehicle(event.target.value.trim())}
                    onKeyDown={blockInvalidKeys(VEHICLE_KEY_PATTERN)}
                    placeholder="e.g. LSD-123-AB"
                    pattern="[A-Z0-9][A-Z0-9 -]{3,10}[A-Z0-9]"
                    title="Use 5–12 characters, including a letter and a number."
                    aria-invalid={Boolean(error)}
                    aria-describedby={`marketing-rider-identifier-hint${error ? " marketing-rider-identifier-error" : ""}`}
                  />
                )}
              </span>
              <small className="partner-field-hint" id="marketing-rider-identifier-hint">
                {riderType === "student" ? "Matric style: letters, numbers, / or -, 5–20 characters." : "Vehicle plate: letters, numbers, spaces or hyphens, 5–12 characters."}
              </small>
              {error && <small className="partner-field-error" id="marketing-rider-identifier-error" role="alert">{error}</small>}
            </div>}
            <label>{page.extraLabel}<span className="partner-input-wrap"><Icon name={type === "vendor" ? "storefront" : "location_on"} /><input name={page.extraName} required placeholder={page.extraPlaceholder} /></span></label>
            <label>Your name<span className="partner-input-wrap"><Icon name="person" /><input name="name" autoComplete="name" required placeholder="Full name" /></span></label>
            <div className="partner-form-row"><label>Email address<span className="partner-input-wrap"><Icon name="email" /><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></span></label><label>Phone number<span className="partner-input-wrap"><Icon name="call" /><input name="phone" type="tel" autoComplete="tel" required placeholder="080 0000 0000" /></span></label></div>
            <label className="partner-consent"><input type="checkbox" name="consent" required /><span>I agree to be contacted about joining ChowZilla.</span></label>
            <button className="partner-primary-button" type="submit">Register interest</button>
            <p className="partner-form-note" role="status" aria-live="polite">{submitted ? `Details${type === "rider" ? ` including your ${riderType === "student" ? "matric number" : "vehicle number"}` : ""} are shown in this form preview. Nothing is sent to a server or stored.` : "Preview only: this form does not send or store your details."}</p>
            <p className="partner-form-contact">Prefer email? <a href="mailto:ademoladav713@gmail.com?subject=ChowZilla%20partner%20enquiry">ademoladav713@gmail.com</a></p>
          </form>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
};

export default PartnerLanding;
