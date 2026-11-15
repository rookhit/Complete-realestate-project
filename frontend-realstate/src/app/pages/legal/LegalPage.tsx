// The Privacy Policy, Terms of Use and FAQ pages. Their words live in src/seo/legal.ts, shared with
// the pre-rendered HTML that search engines read.
import { ChevronDown } from "lucide-react";
import { LEGAL_UPDATED, PRIVACY, TERMS, type LegalDoc } from "@/seo/legal";
import { FAQS } from "@/seo/faq";
import { BG_LIGHT, BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { GoldLine, Tag } from "@/app/components/ui/typography";

export type LegalKind = "privacy" | "terms" | "faq";

function Header({ tag, title, intro }: { tag: string; title: string; intro: string }) {
  return (
    <div className="px-6 md:px-12 lg:px-20 py-16 md:py-20 border-b" style={{ borderColor: BORDER_L, background: WHITE }}>
      <div className="flex items-center gap-3 mb-4"><GoldLine /><Tag c={GOLD}>{tag}</Tag></div>
      <h1 className="leading-[0.92]" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(2.4rem,5vw,4.2rem)" }}>{title}</h1>
      <p className="mt-5 text-[15px] leading-relaxed max-w-3xl" style={{ color: MUTED_L, ...sans }}>{intro}</p>
    </div>
  );
}

/** A paragraph, or a list item when it starts with "• ". Consecutive items form one list. */
function Body({ lines }: { lines: string[] }) {
  const out: JSX.Element[] = [];
  let items: string[] = [];
  const flush = () => {
    if (!items.length) return;
    out.push(<ul key={`l${out.length}`} className="flex flex-col gap-2 pl-5 list-disc marker:text-[#b08848]">{items.map(t => <li key={t}>{t}</li>)}</ul>);
    items = [];
  };
  for (const l of lines) {
    if (l.startsWith("• ")) { items.push(l.slice(2)); continue; }
    flush();
    out.push(<p key={`p${out.length}`}>{l}</p>);
  }
  flush();
  return <div className="flex flex-col gap-3 text-[15px] leading-[1.8]" style={{ color: FG_LIGHT, ...sans }}>{out}</div>;
}

function Document({ doc }: { doc: LegalDoc }) {
  const id = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <>
      <Header tag={`Last updated ${LEGAL_UPDATED}`} title={doc.title} intro={doc.intro} />
      <div className="px-6 md:px-12 lg:px-20 py-14 grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-10 lg:gap-16 items-start">
        <nav aria-label="On this page" className="lg:sticky lg:top-28 border p-5" style={{ borderColor: BORDER_L, background: WHITE }}>
          <p className="text-[10px] tracking-[0.28em] uppercase mb-3" style={{ color: GOLD, ...sans }}>On this page</p>
          <ol className="flex flex-col gap-2 text-[13px]" style={{ ...sans }}>
            {doc.sections.map((s, i) => (
              <li key={s.heading}><a href={`#${id(s.heading)}`} className="transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}>{i + 1}. {s.heading}</a></li>
            ))}
          </ol>
        </nav>
        <article className="flex flex-col gap-10 max-w-3xl min-w-0">
          {doc.sections.map((s, i) => (
            <section key={s.heading} id={id(s.heading)} style={{ scrollMarginTop: "7rem" }}>
              <h2 className="text-[22px] mb-4" style={{ color: FG_LIGHT, ...serif }}><span style={{ color: GOLD }}>{i + 1}.</span> {s.heading}</h2>
              <Body lines={s.body} />
            </section>
          ))}
        </article>
      </div>
    </>
  );
}

function FaqList() {
  return (
    <>
      <Header tag="Help" title="Frequently Asked Questions" intro="Answers to what buyers, sellers and tenants ask us most. Can't find yours? Call or message us and an advisor will help." />
      <div className="px-6 md:px-12 lg:px-20 py-14">
        <div className="max-w-3xl flex flex-col border-t" style={{ borderColor: BORDER_L }}>
          {FAQS.map(f => (
            <details key={f.q} className="group border-b" style={{ borderColor: BORDER_L }}>
              <summary className="flex items-center justify-between gap-6 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <h2 className="text-[17px] md:text-[19px] leading-snug" style={{ color: FG_LIGHT, ...serif }}>{f.q}</h2>
                <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" style={{ color: MAROON }} />
              </summary>
              <p className="pb-6 pr-8 text-[15px] leading-[1.8]" style={{ color: MUTED_L, ...sans }}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}

/** One of the three pages; `kind` picks which. */
export function LegalPage({ kind }: { kind: LegalKind }) {
  return (
    <div className="min-h-screen pt-20" style={{ background: BG_LIGHT }}>
      {kind === "faq" ? <FaqList /> : <Document doc={kind === "privacy" ? PRIVACY : TERMS} />}
    </div>
  );
}
