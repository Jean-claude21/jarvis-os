// The icons of her sidebar: one stroke, the color of the text.

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

export const ICONS = {
  home: icon('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  now: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  files: icon('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  more: icon('<path d="M6 12h.01M12 12h.01M18 12h.01"/>'),
  agenda: icon(
    '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  ),
  life: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  documents: icon('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),
  dashboards: icon('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  reminders: icon(
    '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 004 0"/>',
  ),
  journal: icon('<path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5M12 8v4l3 3"/>'),
  spaces: icon('<circle cx="9" cy="9" r="4"/><circle cx="16" cy="15" r="4"/>'),
  connections: icon('<path d="M10 14l4-4M8 8l-2 2a4 4 0 006 6l1-1M16 16l2-2a4 4 0 00-6-6l-1 1"/>'),
  data: icon('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  account: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
};
