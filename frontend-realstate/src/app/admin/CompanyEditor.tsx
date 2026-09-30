import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { CONTACT, SERVICES, SERVICE_ICONS, saveContact, saveServices, whatsappLink, type ContactInfo, type Service } from "@/app/data/content";
import { useDataVersion } from "@/app/data/store";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { Button, Field, TextArea, TextInput } from "@/app/components/ui/form-controls";
import { SERVICE_ICON } from "@/app/components/ui/service-icon";
import { CardTools } from "./ContentEditors";
import { SectionHeading, type Notify } from "./parts";

const isUrl = (v: string) => !v.trim() || /^https?:\/\/\S+\.\S+/.test(v.trim());

/**
 * Contact details (Contact page, footer, every WhatsApp button) and the Services list
 * (home, About and Services pages). Before this, both were hard-coded in App.tsx.
 */
export function CompanySection({ notify }: { notify: Notify }) {
  useDataVersion();
  const [c, setC] = useState<ContactInfo>(() => ({ ...CONTACT }));
  const [services, setServices] = useState<Service[]>(() => SERVICES.map(s => ({ ...s })));
  const setField = (k: keyof ContactInfo, v: string) => setC(o => ({ ...o, [k]: v }));

  const saveContactDetails = () => {
    if (!c.phone.trim() || !c.email.trim()) { notify("Phone and email are needed"); return; }
    if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) { notify("That email address doesn’t look right"); return; }
    if (c.whatsapp.replace(/\D/g, "").length < 10) { notify("Enter the WhatsApp number with its country code, e.g. +977 98…"); return; }
    const bad = (["instagram", "facebook", "youtube", "linkedin"] as const).find(k => !isUrl(c[k]));
    if (bad) { notify(`The ${bad} link should start with https://`); return; }
    saveContact(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.trim()])) as unknown as ContactInfo);
    notify("Contact details updated");
  };

  const setService = (id: number, patch: Partial<Service>) => setServices(l => l.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => setServices(l => {
    const j = i + dir; if (j < 0 || j >= l.length) return l;
    const next = [...l]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const saveServiceList = () => {
    if (!services.length) { notify("Keep at least one service"); return; }
    if (services.some(s => !s.title.trim() || !s.desc.trim())) { notify("Every service needs a title and a description"); return; }
    saveServices(services.map(s => ({ ...s, title: s.title.trim(), desc: s.desc.trim() })));
    notify("Services updated");
  };

  return (
    <div className="flex flex-col gap-14">
      <div>
        <SectionHeading title="Contact Details" subtitle="Shown on the Contact page and in the footer. The WhatsApp number is used by every WhatsApp button on the site."
          actions={<Button onClick={saveContactDetails}><Check size={14} />Save Contact Details</Button>} />
        <div className="border p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-5" style={{ borderColor: BORDER_L, background: WHITE }}>
          <Field label="Telephone"><TextInput value={c.phone} onChange={v => setField("phone", v)} placeholder="+977 1 400 0000" /></Field>
          <Field label="WhatsApp Number" hint={<>Buttons open <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">wa.me/{c.whatsapp.replace(/\D/g, "") || "…"}</a></>}>
            <TextInput value={c.whatsapp} onChange={v => setField("whatsapp", v)} placeholder="+977 980 000 0000" />
          </Field>
          <Field label="Email"><TextInput type="email" value={c.email} onChange={v => setField("email", v)} placeholder="info@nepalbhoomi.com" /></Field>
          <div className="hidden md:block" />
          <Field label="Office Address" hint="Line breaks are kept."><TextArea rows={3} value={c.address} onChange={v => setField("address", v)} placeholder={"Jhamsikhel Road, Lalitpur\nKathmandu Valley, Nepal"} /></Field>
          <Field label="Office Hours" hint="Line breaks are kept."><TextArea rows={3} value={c.hours} onChange={v => setField("hours", v)} placeholder={"Sunday–Friday: 9:00 AM – 6:00 PM\nSaturday: By Appointment"} /></Field>
          <div className="md:col-span-2 pt-5 border-t" style={{ borderColor: BORDER_L }}>
            <p className="text-[10px] tracking-[0.28em] uppercase mb-4" style={{ color: GOLD, ...sans }}>Social Links · leave empty to hide the icon in the footer</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(["instagram", "facebook", "youtube", "linkedin"] as const).map(k => (
                <Field key={k} label={{ instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn" }[k]}
                  hint={isUrl(c[k]) ? undefined : <span style={{ color: MAROON }}>Start with https://</span>}>
                  <TextInput value={c[k]} onChange={v => setField(k, v)} placeholder={`https://${k}.com/…`} />
                </Field>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeading title="Services" subtitle="The services grid on the home page, the About page and the Services page, in this order."
          actions={<>
            <Button variant="quiet" onClick={() => setServices(l => [...l, { id: Math.max(0, ...l.map(s => s.id), ...SERVICES.map(s => s.id)) + 1, icon: "home", title: "", desc: "" }])}>
              <Plus size={14} />Add Service
            </Button>
            <Button onClick={saveServiceList}><Check size={14} />Save Services</Button>
          </>} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {services.map((s, i) => {
            const Icon = SERVICE_ICON[s.icon];
            return (
              <div key={s.id} className="border p-6 flex flex-col gap-4" style={{ borderColor: BORDER_L, background: WHITE }}>
                <div className="flex items-start gap-4">
                  <span className="w-12 h-12 shrink-0 flex items-center justify-center border" style={{ borderColor: BORDER_L, color: MAROON }}><Icon size={22} /></span>
                  <p className="flex-1 min-w-0 pt-2.5 text-[17px] truncate" style={{ color: s.title ? FG_LIGHT : MUTED_L, ...serif }}>{s.title || "New service"}</p>
                  <CardTools first={i === 0} last={i === services.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)}
                    onDelete={() => setServices(l => l.filter(x => x.id !== s.id))} />
                </div>
                <Field label="Icon">
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
                    {SERVICE_ICONS.map(name => {
                      const I = SERVICE_ICON[name], on = s.icon === name;
                      return (
                        <button key={name} type="button" role="radio" aria-checked={on} aria-label={name} onClick={() => setService(s.id, { icon: name })}
                          className="w-10 h-10 flex items-center justify-center border transition-colors hover:border-[#8a2030]"
                          style={{ borderColor: on ? GOLD : BORDER_L, background: on ? "rgba(176,136,72,0.1)" : WHITE, color: on ? MAROON : MUTED_L }}>
                          <I size={17} />
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Title"><TextInput value={s.title} onChange={v => setService(s.id, { title: v })} placeholder="e.g. Property Valuation" maxLength={40} /></Field>
                <Field label="Description" hint="One sentence."><TextArea rows={2} value={s.desc} onChange={v => setService(s.id, { desc: v })} placeholder="What the client gets." /></Field>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
