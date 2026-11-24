import {
  CalendarDays,
  CheckSquare,
  FileText,
  History,
  Inbox,
  Target,
  Wallet,
  LayoutDashboard,
  LayoutGrid,
  NotebookPen,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';

// The menu follows the system (v3 D2, R7): one moment (Aujourd'hui), the views across her whole life
// — one per facet, shown only when something she keeps has it, nothing imposed — then her apps (the
// services). The journal sits in the top bar, always in sight.

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const TODAY: NavItem = { to: '/', label: 'Aujourd’hui', icon: Sun };

/** A view across every app, born of a facet. */
export interface AcrossItem extends NavItem {
  facet: string;
}
export const ACROSS: AcrossItem[] = [
  { facet: 'dated', to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { facet: 'todo', to: '/taches', label: 'Tâches', icon: CheckSquare },
  { facet: 'document', to: '/documents', label: 'Documents', icon: FileText },
  { facet: 'who', to: '/personnes', label: 'Personnes', icon: Users },
  { facet: 'amount', to: '/argent', label: 'Argent', icon: Wallet },
  { facet: 'measurable', to: '/objectifs', label: 'Objectifs', icon: Target },
];

/** Her dashboards (spec 107): cards of all her apps, across her life — always there. */
export const DASHBOARDS: NavItem = {
  to: '/tableaux',
  label: 'Tableaux de bord',
  icon: LayoutDashboard,
};

/** Her bilans (v3 F4): a week, a month, looked back on — always there, whatever she keeps. */
export const BILANS: NavItem = { to: '/bilans', label: 'Bilans', icon: NotebookPen };

/** What waits for her yes (v3 D13), always in the menu. */
export const QUEUE: NavItem = { to: '/a-valider', label: 'À valider', icon: Inbox };

export const APPS: NavItem = { to: '/apps', label: 'Toutes les apps', icon: LayoutGrid };
export const JOURNAL: NavItem = { to: '/activite', label: 'Activité', icon: History };
