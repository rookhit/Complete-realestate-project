// The Privacy Policy, Terms of Use and FAQ: their words, in one place, for both the pages
// (pages/legal/LegalPage.tsx) and the pre-rendered HTML search engines read (scripts/prerender.mjs).
// No imports: prerender.mjs loads this file on its own, like meta.ts.
//
// Written for Nepal Bhoomi's real practices (what the site stores and why). Have a lawyer review
// before relying on it, and keep LEGAL_UPDATED current whenever the wording changes.

export const LEGAL_UPDATED = "14 November 2026";
const EMAIL = "info@nepalbhoomi.com";
const PHONE = "+977 9818783518";
const OFFICE = "Lazimpat, Kathmandu (opposite Image Channel building)";

/** A heading with its paragraphs; a paragraph starting with "• " is shown as a list item. */
export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { path: string; title: string; intro: string; sections: LegalSection[] };

export const PRIVACY: LegalDoc = {
  path: "/privacy-policy",
  title: "Privacy Policy",
  intro: `Nepal Bhoomi Real Estate ("Nepal Bhoomi", "we") runs www.nepalbhoomi.com. This policy explains what personal information we collect, why, who helps us handle it, how long we keep it and your choices. We follow Nepal's Privacy Act, 2075 (2018).`,
  sections: [
    { heading: "What we collect", body: [
      "• Account details: your name, email address, phone number and a securely hashed password. If you sign in with Google, we receive your name, email address and profile picture from Google; we never see your Google password.",
      "• What you send us: enquiries, callback requests and contact messages (with the name, email and phone you give), reviews you write, and free listings (property details, photos, the property's location link and the owner's contact details).",
      "• Security records: the date of your last sign-in, and for each signed-in session the browser type and IP address, used only to protect your account from misuse.",
      "We do not use advertising or tracking cookies, and we do not sell personal information.",
    ] },
    { heading: "Why we use it", body: [
      "• To answer your enquiries and help you buy, sell or rent property.",
      "• To review free listings and, with your agreement, publish the property (never your contact details).",
      "• To run your account: email verification codes, password resets and security alerts.",
      "• To keep the website safe: preventing spam, repeated wrong passwords and misuse.",
    ] },
    { heading: "Photos and locations", body: [
      "Property photos uploaded to the website are resized, stamped with the Nepal Bhoomi watermark, and stripped of hidden camera data (including GPS location) before they are stored.",
      "For most properties the map shows an approximate area about 500 metres across, not the exact spot. The exact location you give us is seen only by our team.",
    ] },
    { heading: "Who helps us handle it", body: [
      "We use trusted service providers who process information only to run the website for us:",
      "• Supabase (database, hosted in Mumbai, India) for accounts, listings and messages.",
      "• Cloudflare R2 for property photos and videos.",
      "• Vercel for hosting the website.",
      "• Google, if you choose to sign in with Google, and Google Mail for sending account emails.",
      "• OpenFreeMap and OpenStreetMap for map tiles, which receive your IP address when a map loads.",
      "We may also share information when the law requires it, or with your consent (for example, putting a buyer in touch with a seller).",
    ] },
    { heading: "Cookies and storage on your device", body: [
      "• One essential sign-in cookie keeps you signed in for up to 7 days. It cannot be read by scripts and is only sent to our sign-in service.",
      "• Your browser may keep a half-written Free Listing (including picked photos) on your device until you send it or log out, and form text you typed before signing in.",
      "These are needed for the site to work; there are no analytics or advertising cookies.",
    ] },
    { heading: "How long we keep it", body: [
      "• Accounts that are never verified are deleted after 7 days.",
      "• Security logs are deleted after 180 days.",
      "• Messages, reviews and free listings are kept while they are useful for the enquiry or listing, and deleted when no longer needed.",
      "• Your account is kept until you ask us to delete it.",
    ] },
    { heading: "Your choices and rights", body: [
      `You may ask to see, correct or delete the personal information we hold about you, or withdraw your consent to us using it. Email ${EMAIL} or call ${PHONE}; we may need to confirm it is you, and we reply within 30 days.`,
    ] },
    { heading: "Security", body: [
      "Passwords are stored only as secure hashes, connections use HTTPS, administrator access needs two-factor authentication, and access to personal information is limited to our team. No system is perfectly secure, so please use a strong, unique password.",
    ] },
    { heading: "Children", body: ["The website is meant for adults buying, selling or renting property. We do not knowingly collect information from children under 16."] },
    { heading: "Changes and contact", body: [
      "If we change this policy we update the date at the top; important changes are announced on the website.",
      `Questions: ${EMAIL}, ${PHONE}, or visit us at ${OFFICE}.`,
    ] },
  ],
};

export const TERMS: LegalDoc = {
  path: "/terms",
  title: "Terms of Use",
  intro: `These terms apply to everyone who uses www.nepalbhoomi.com, run by Nepal Bhoomi Real Estate, ${OFFICE}. By using the website you agree to them; if you do not agree, please do not use it.`,
  sections: [
    { heading: "What the website is", body: [
      "The website presents properties for sale and rent and lets you contact our team. Listings are invitations to enquire, not offers: a property is only bought, sold or let under a written agreement signed by the parties.",
    ] },
    { heading: "Listing information", body: [
      "Property details, photos, areas and prices come from owners and our team. We work to keep them accurate, but they may change or contain mistakes. Before any decision, check the property in person and confirm the ownership documents (such as the land ownership certificate, map and tax clearance) with the relevant government office or a lawyer.",
      "Prices may change and are often negotiable. Maps usually show an approximate area, not the exact location.",
    ] },
    { heading: "Your account", body: [
      "• Give true information and keep your password secret; you are responsible for what is done with your account.",
      "• One account per person. We may suspend or close accounts that break these terms or are used to misuse the website.",
    ] },
    { heading: "Free listings", body: [
      "• Only list a property you own or are authorised in writing to market, and give true details.",
      "• Only upload photos you took or have the right to use. You allow Nepal Bhoomi to edit, watermark and publish them, and the details you send, to market the property.",
      "• Every listing is reviewed by our team. We may ask for documents, edit a listing, or decline to publish it. Your contact details are never published.",
      "• Any fee for selling or letting your property is agreed separately in writing before we act on it.",
    ] },
    { heading: "Reviews and messages", body: [
      "Reviews must be honest and about your own experience. We publish reviews after moderation and may decline reviews that are false, offensive or unrelated. Do not send spam or anything unlawful through the website's forms.",
    ] },
    { heading: "Content and watermarks", body: [
      "The website's design, text, logos and property photos belong to Nepal Bhoomi or the people who licensed them to us. You may view and share links to pages, but you may not copy, scrape or republish listings or photos, or remove watermarks, without our written permission.",
    ] },
    { heading: "Other websites", body: ["Links to other services (such as Google Maps, WhatsApp or YouTube) are for convenience; their own terms apply and we are not responsible for them."] },
    { heading: "Liability", body: [
      "The website is provided as it is. As far as the law allows, Nepal Bhoomi is not liable for losses caused by relying on listing information without checking it, by interruptions to the website, or by the actions of buyers, sellers, landlords or tenants. Nothing here limits rights you have under Nepal's consumer protection laws.",
    ] },
    { heading: "Changes and governing law", body: [
      "We may update these terms; the date at the top shows the latest version, and continuing to use the website means you accept it.",
      "These terms are governed by the laws of Nepal, and disputes are subject to the courts of Kathmandu.",
      `Contact: ${EMAIL}, ${PHONE}.`,
    ] },
  ],
};
