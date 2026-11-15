import { MUTED_L, sans } from "./brand";

/**
 * "By creating an account, you agree to our Terms of Use and Privacy Policy." under forms that take
 * personal details. The links open in a new tab, so a half-filled form isn't lost.
 */
export function LegalConsent({ action, align = "center" }: { action: string; align?: "center" | "left" }) {
  const link = "underline underline-offset-2 transition-colors hover:text-[#8a2030]";
  return (
    <p className={`text-[12px] leading-relaxed ${align === "center" ? "text-center" : ""}`} style={{ color: MUTED_L, ...sans }}>
      By {action}, you agree to our{" "}
      <a href="/terms" target="_blank" rel="noopener" className={link}>Terms of Use</a> and{" "}
      <a href="/privacy-policy" target="_blank" rel="noopener" className={link}>Privacy Policy</a>.
    </p>
  );
}
