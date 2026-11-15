// The FAQ page's questions and answers, shared by the page (pages/legal/LegalPage.tsx), the
// pre-rendered HTML (scripts/prerender.mjs) and the FAQPage structured data. No imports: prerender.mjs
// loads this file on its own. Kept apart from legal.ts so the app's main download stays small.

const EMAIL = "info@nepalbhoomi.com";
const PHONE = "+977 9818783518";
const OFFICE = "Lazimpat, Kathmandu (opposite Image Channel building)";

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  { q: "How do I buy a property through Nepal Bhoomi?", a: "Find a property on the Buy page, then send an enquiry, call us or message us on WhatsApp, quoting its NB ID (for example #NBS004). An advisor arranges a visit, shares the documents, helps you negotiate and guides you through the agreement and registration at the land revenue office (Malpot)." },
  { q: "Which documents should I check before buying land or a house?", a: "At minimum: the land ownership certificate (Lalpurja), the cadastral map (naksa) and plot number, up-to-date land tax receipts, the boundaries (char killa) and road access, and for buildings the approved building plan and completion certificate. Our team helps you collect them, and we recommend having a lawyer confirm them." },
  { q: "What does Ropani-Aana-Paisa-Dam (for example 4-4-0-1) mean?", a: "It is the traditional land measure used in the Kathmandu Valley: 1 ropani = 16 aana = 5,476 sq.ft, 1 aana = 4 paisa = 342.25 sq.ft, and 1 paisa = 4 dam. So 4-4-0-1 means 4 ropani, 4 aana, 0 paisa and 1 dam, about 23,294 sq.ft. Our listings show the square-feet figure too." },
  { q: "Why does the map show an area instead of the exact location?", a: "To protect owners' privacy and security, most properties show an approximate area about 500 metres across. We share the exact location when you arrange a visit." },
  { q: "How can I list my property for free?", a: "Create an account, open Free Listing, add the details and photos, and send it. Our team reviews it, may call you to confirm details, and then publishes it. Your contact details are never shown on the website." },
  { q: "Are listing prices final?", a: "Not always. Many prices are negotiable, and some properties are listed as Negotiable without a price. Ask us for the latest price before you visit." },
  { q: "What does the Verified badge mean?", a: "It means our team has checked the property's details with the owner. Always confirm the ownership documents yourself before paying anything." },
  { q: "Can Non-Resident Nepalis (NRNs) or foreigners buy property in Nepal?", a: "Non-Resident Nepalis may own property within limits set by Nepali law. Foreign nationals generally cannot own land in Nepal. Rules change, so ask us and confirm your eligibility with a lawyer before you plan a purchase." },
  { q: "Can you help me get a home loan?", a: "We can introduce you to banks and help you prepare the property documents they ask for. Use our EMI calculator to estimate monthly payments; the bank decides the final rate and amount." },
  { q: "Do you help with renting out or managing a property?", a: "Yes. We find and check tenants, prepare rental agreements and can manage buildings for owners. See our Services page or contact us." },
  { q: "How do I contact Nepal Bhoomi?", a: `Call ${PHONE}, email ${EMAIL}, message us on WhatsApp, or visit our office in ${OFFICE}, Sunday to Friday, 9:30 AM to 6:00 PM.` },
];

/** schema.org FAQPage for the FAQ page (lets search results show the questions). */
export const faqLd = (faqs: Faq[]): object => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});
