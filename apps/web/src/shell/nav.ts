import {
  CalendarDays,
  CheckSquare,
  FileText,
  History,
  LayoutGrid,
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
];

export const APPS: NavItem = { to: '/apps', label: 'Toutes les apps', icon: LayoutGrid };
export const JOURNAL: NavItem = { to: '/activite', label: 'Activité', icon: History };
