import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, X } from "lucide-react";
import { PROVINCE_OF, searchDistricts } from "@/app/data/districts";
import { BORDER_D, BORDER_L, FG_DARK, FG_LIGHT, GOLD, MUTED_D, MUTED_L, WHITE, sans } from "./brand";

// Type-ahead over the 77 districts. Names starting with the text come first, and
// aliases work ("pokhara" finds Kaski). Arrow keys, Enter and Escape work as expected.
export function DistrictCombobox({ value, onChange, placeholder="Type a district...", dark=false }: {
  value:string; onChange:(v:string)=>void; placeholder?:string; dark?:boolean;
}) {
  const [query,setQuery]=useState(value);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const wrapRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ setQuery(value); },[value]);

  useEffect(()=>{
    const onDocDown=(e:MouseEvent)=>{
      if(wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown",onDocDown);
    return ()=>document.removeEventListener("mousedown",onDocDown);
  },[]);

  const results=searchDistricts(query,8);
  const fg=dark?FG_DARK:FG_LIGHT;
  const muted=dark?MUTED_D:MUTED_L;
  const border=dark?BORDER_D:BORDER_L;
  const panelBg=dark?"#14120f":WHITE;

  const pick=(d:string)=>{ onChange(d); setQuery(d); setOpen(false); };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2.5 border px-4" style={{borderColor:border}}>
        <MapPin size={15} style={{color:GOLD,flexShrink:0}}/>
        <input
          value={query}
          onChange={e=>{ setQuery(e.target.value); setActive(0); setOpen(true); if(e.target.value==="") onChange(""); }}
          onFocus={()=>setOpen(true)}
          onKeyDown={e=>{
            if(e.key==="ArrowDown"){ e.preventDefault(); setOpen(true); setActive(a=>Math.min(a+1,results.length-1)); }
            else if(e.key==="ArrowUp"){ e.preventDefault(); setActive(a=>Math.max(a-1,0)); }
            else if(e.key==="Enter"){ if(open&&results[active]){ e.preventDefault(); pick(results[active]); } }
            else if(e.key==="Escape"){ setOpen(false); }
          }}
          placeholder={placeholder}
          role="combobox" aria-expanded={open} aria-autocomplete="list"
          className="flex-1 bg-transparent py-3 text-[15px] outline-none"
          style={{color:fg,...sans}}
        />
        {query && (
          <button type="button" onClick={()=>{ setQuery(""); onChange(""); setOpen(true); }} aria-label="Clear district" className="p-1" style={{color:muted}}>
            <X size={14}/>
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length>0 && (
          <motion.ul
            initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}
            transition={{duration:0.14}}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto border shadow-lg"
            style={{background:panelBg,borderColor:border}}
            role="listbox"
          >
            {results.map((d,i)=>(
              <li key={d}>
                <button
                  type="button"
                  onMouseEnter={()=>setActive(i)}
                  onClick={()=>pick(d)}
                  role="option" aria-selected={i===active}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ background: i===active ? (dark?"rgba(176,136,72,0.12)":"#f7f3ed") : "transparent" }}
                >
                  <span className="text-[14px]" style={{color:fg,...sans}}>{d}</span>
                  <span className="text-[10px] tracking-[0.18em] uppercase" style={{color:muted,...sans}}>{PROVINCE_OF[d]}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
        {open && results.length===0 && (
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="absolute left-0 right-0 top-full z-50 mt-1 border px-4 py-3 shadow-lg"
            style={{background:panelBg,borderColor:border}}
          >
            <span className="text-[14px]" style={{color:muted,...sans}}>No district matches &ldquo;{query}&rdquo;</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
