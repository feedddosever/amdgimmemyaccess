// Facts shown on the landing and About pages. Update PILOT after the trattoria visit.

export const REPO_URL = "https://github.com/feedddosever/amdgimmemyaccess";

// Starting guess for the restaurant's subscription, to be tested with the pilot.
export const PRICE_PER_MONTH_EUR = 29;

export const PILOT: { status: "seeking" | "agreed"; restaurant?: string; quote?: string } = {
  status: "seeking",
};

export const DEMO_LINKS = {
  japaneseTourist: "/m/demo-trattoria?lang=ja&aud=first_timer&table=7",
  fishAllergy: "/m/demo-trattoria?lang=en&aud=dietary&allergens=fish&table=4",
};
