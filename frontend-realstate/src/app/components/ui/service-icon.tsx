import { Award, BarChart3, Briefcase, Building2, Compass, Hammer, Handshake, Home, Key, Landmark, Scale, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ServiceIcon as IconName } from "@/app/data/content";

// The icon names a service can store, drawn with lucide. Add a name here and to
// SERVICE_ICONS in data/content.ts to offer another one in the admin.
export const SERVICE_ICON: Record<IconName, LucideIcon> = {
  home: Home, key: Key, briefcase: Briefcase, award: Award, building: Building2, landmark: Landmark,
  scale: Scale, hammer: Hammer, compass: Compass, chart: BarChart3, shield: ShieldCheck, handshake: Handshake,
};

export function ServiceIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  const Icon = SERVICE_ICON[name] ?? Home;
  return <Icon size={size} />;
}
