import {
  Activity,
  CalendarDays,
  FileText,
  Inbox,
  LayoutGrid,
  Sun,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

// The world « Vivre » (v3 D2): what everyone sees. The workshop (types, skills, agents) is behind
// its own door.

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const LIVE: NavItem[] = [
  { to: '/', label: 'Aujourd’hui', icon: Sun },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/personnes', label: 'Personnes', icon: Users },
  { to: '/argent', label: 'Argent', icon: Wallet },
  { to: '/activite', label: 'Activité', icon: Activity },
  { to: '/attente', label: 'À valider', icon: Inbox },
  { to: '/apps', label: 'Mes apps', icon: LayoutGrid },
];
