// The screens of plan v2 (section I), in J-C's mockup (`docs/design/jarvis-v2.html`): its whole
// stylesheet, every rule under `.v2` so the pages drawn before keep theirs; its tokens; the phone's
// tab bar. Generated from the mockup: change the mockup, then generate again.

export const v2Css = `
:root {
  color-scheme: light;
        --canvas: #efe6dc;
        --paper: #fffdf9;
        --sand: #fbf6f0;
        --clay: #f4e6da;
        --rule: #e6d6c8;
        --rule-strong: #c9b3a4;
        --ink: #2a1610;
        --bark: #6b4e43;
        --faint: #9a8276;
        --primary: #b83a1b;
        --primary-strong: #962e14;
        --ochre: #c98a2b;
        --on-primary: #fffdf9;
        --on-ink: #fffdf9;
        --success: #2f7d4f;
        --success-surface: #e3f1e8;
        --verify: #7a4a0b;
        --verify-surface: #fbebd0;
        --error: #9b1c3c;
        --error-surface: #f7e1e7;
        --info: #2b5c8a;
        --info-surface: #e2ecf5;
        --heat-0: #f1e7dd;
        --heat-1: #d6e6da;
        --heat-2: #9cc7a9;
        --heat-3: #2f7d4f;
        --shadow: 0 1px 2px rgba(42, 22, 16, 0.06), 0 4px 16px rgba(42, 22, 16, 0.05);
}
:root[data-theme='dark'] {
  color-scheme: dark;
        --canvas: #0f0a07;
        --paper: #17100c;
        --sand: #1d140f;
        --clay: #2c2019;
        --rule: #3a2b23;
        --rule-strong: #5e4a3e;
        --ink: #f4e6da;
        --bark: #bfa799;
        --faint: #8c7568;
        --primary: #f08a63;
        --primary-strong: #e2572d;
        --ochre: #d9a04a;
        --on-primary: #17100c;
        --on-ink: #17100c;
        --success: #4fa873;
        --success-surface: #1c3025;
        --verify: #f2cc8a;
        --verify-surface: #3a2a12;
        --error: #d0546f;
        --error-surface: #3e1620;
        --info: #5c8fc2;
        --info-surface: #172a3d;
        --heat-0: #251b15;
        --heat-1: #1f3a2a;
        --heat-2: #2e6544;
        --heat-3: #4fa873;
        --shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.25);
}
@media (prefers-color-scheme: dark) {
:root:not([data-theme='light']) {
  color-scheme: dark;
          --canvas: #0f0a07;
          --paper: #17100c;
          --sand: #1d140f;
          --clay: #2c2019;
          --rule: #3a2b23;
          --rule-strong: #5e4a3e;
          --ink: #f4e6da;
          --bark: #bfa799;
          --faint: #8c7568;
          --primary: #f08a63;
          --primary-strong: #e2572d;
          --ochre: #d9a04a;
          --on-primary: #17100c;
          --on-ink: #17100c;
          --success: #4fa873;
          --success-surface: #1c3025;
          --verify: #f2cc8a;
          --verify-surface: #3a2a12;
          --error: #d0546f;
          --error-surface: #3e1620;
          --info: #5c8fc2;
          --info-surface: #172a3d;
          --heat-0: #251b15;
          --heat-1: #1f3a2a;
          --heat-2: #2e6544;
          --heat-3: #4fa873;
          --shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.25);
}
}
/* dropped: * */ .v2-dropped {
  box-sizing: border-box;
}
/* dropped: html,
      body */ .v2-dropped {
  margin: 0;
        height: 100%;
}
/* dropped: body */ .v2-dropped {
  background: var(--canvas);
        color: var(--ink);
        font:
          400 14px/1.5 'Instrument Sans',
          system-ui,
          sans-serif;
        -webkit-font-smoothing: antialiased;
}
.v2 button, .v2 select, .v2 input {
  font: inherit;
        color: inherit;
}
.v2 button {
  background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
}
.v2 a {
  color: inherit;
}
.v2 h1, .v2 h2, .v2 h3 {
  font-family: Archivo, system-ui, sans-serif;
        margin: 0;
        letter-spacing: -0.01em;
}
.v2 h2 {
  font-size: 15px;
        font-weight: 600;
}
.v2 svg.i {
  width: 16px;
        height: 16px;
        flex: none;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
}
.v2 .mono {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-variant-numeric: tabular-nums;
}
.v2 .caps {
  font:
          500 11px/1.4 'JetBrains Mono',
          ui-monospace,
          monospace;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--bark);
}
.v2 .muted {
  color: var(--bark);
}
.v2 .faint {
  color: var(--faint);
}
.v2 .pos {
  color: var(--success);
}
.v2 .neg {
  color: var(--error);
}
.v2 .app {
  display: grid;
        grid-template-columns: 252px 1fr;
        height: 100vh;
        padding: 12px;
}
.v2 aside.side {
  display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 4px 12px 4px 4px;
        min-height: 0;
        overflow-y: auto;
}
.v2 main {
  background: var(--paper);
        border: 1px solid var(--rule);
        border-radius: 2px;
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
}
.v2 .switcher, .v2 .me {
  display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 10px;
        background: var(--paper);
        border: 1px solid var(--rule);
        border-radius: 2px;
        width: 100%;
        text-align: left;
}
.v2 .logo {
  width: 30px;
        height: 30px;
        border-radius: 2px;
        background: var(--primary);
        color: var(--on-primary);
        display: grid;
        place-items: center;
        font:
          700 15px/1 Archivo,
          sans-serif;
        flex: none;
}
.v2 .switcher b, .v2 .me b {
  display: block;
        font:
          600 14px/1.2 Archivo,
          sans-serif;
}
.v2 .me b {
  font:
          600 13px/1.2 'Instrument Sans',
          sans-serif;
}
.v2 .switcher small, .v2 .me small {
  color: var(--bark);
        font-size: 12px;
}
.v2 .switcher > .i, .v2 .me > .i {
  margin-left: auto;
        color: var(--faint);
}
.v2 .search {
  display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 10px;
        border: 1px solid var(--rule);
        border-radius: 2px;
        background: var(--paper);
        color: var(--faint);
}
.v2 .search input {
  border: 0;
        outline: 0;
        background: none;
        flex: 1;
        min-width: 0;
        color: var(--ink);
}
.v2 .kbd {
  font:
          500 11px/1 'JetBrains Mono',
          monospace;
        border: 1px solid var(--rule);
        border-radius: 2px;
        padding: 3px 5px;
        color: var(--bark);
}
.v2 .nav-group {
  display: flex;
        flex-direction: column;
        gap: 2px;
}
.v2 .nav-group > .caps {
  padding: 6px 8px 4px;
        color: var(--faint);
        display: flex;
        justify-content: space-between;
        align-items: center;
}
.v2 .nav-item {
  display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 8px;
        border-radius: 2px;
        border: 1px solid transparent;
        width: 100%;
        text-align: left;
        text-decoration: none;
}
.v2 .nav-item:hover {
  background: rgba(255, 253, 249, 0.55);
}
.v2 .nav-item[aria-current='page'] {
  background: var(--paper);
        border-color: var(--rule);
        box-shadow: var(--shadow);
        font-weight: 600;
}
.v2 .nav-item .count {
  margin-left: auto;
        font:
          500 11px/1 'JetBrains Mono',
          monospace;
        color: var(--faint);
}
.v2 .nav-item .count.hot {
  background: var(--primary);
        color: var(--on-primary);
        padding: 3px 6px;
        border-radius: 2px;
}
.v2 .app-icon {
  width: 20px;
        height: 20px;
        border-radius: 2px;
        display: grid;
        place-items: center;
        flex: none;
        color: #fffdf9;
}
.v2 .app-icon .i {
  width: 13px;
        height: 13px;
}
.v2 .nav-item.ghost {
  color: var(--faint);
        border: 1px dashed var(--rule-strong);
}
.v2 .space-dot {
  width: 8px;
        height: 8px;
        border-radius: 2px;
        flex: none;
        margin: 0 6px;
}
.v2 .grow {
  flex: 1;
}
.v2 .avatar {
  width: 30px;
        height: 30px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        flex: none;
        font:
          600 12px/1 Archivo,
          sans-serif;
        background: var(--clay);
}
.v2 .menu {
  display: none;
        background: var(--paper);
        border: 1px solid var(--rule);
        border-radius: 2px;
        box-shadow: var(--shadow);
        padding: 4px;
}
.v2 .menu.open {
  display: block;
}
.v2 .menu button {
  display: flex;
        gap: 10px;
        align-items: center;
        width: 100%;
        padding: 8px;
        border-radius: 2px;
        text-align: left;
}
.v2 .menu button:hover {
  background: var(--sand);
}
.v2 .topbar {
  display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--rule);
}
.v2 .crumbs {
  display: flex;
        align-items: center;
        gap: 8px;
        color: var(--bark);
        font-size: 13px;
        min-width: 0;
}
.v2 .crumbs b {
  color: var(--ink);
        font-weight: 600;
        white-space: nowrap;
}
.v2 .chip-now {
  margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        border: 1px solid var(--rule);
        border-radius: 999px;
        background: var(--sand);
        white-space: nowrap;
}
.v2 .live {
  width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--success);
        box-shadow: 0 0 0 3px var(--success-surface);
        flex: none;
}
.v2 .icon-btn {
  width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border: 1px solid var(--rule);
        border-radius: 2px;
        position: relative;
        background: var(--paper);
        flex: none;
}
.v2 .icon-btn:hover {
  background: var(--sand);
}
.v2 .icon-btn .pip {
  position: absolute;
        top: 5px;
        right: 5px;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--primary);
        border: 1.5px solid var(--paper);
}
.v2 .only-mobile {
  display: none;
}
.page.v2 {
  padding: 20px 24px 28px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
}
.v2 .page-head {
  display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
}
.v2 .page-head h1 {
  font-size: 24px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
}
.v2 .page-head h1 .app-icon {
  width: 28px;
        height: 28px;
}
.v2 .page-head h1 .app-icon .i {
  width: 16px;
        height: 16px;
}
.v2 .page-head p {
  margin: 2px 0 0;
        color: var(--bark);
        font-size: 13px;
}
.v2 .head-actions {
  display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
}
.v2 .built {
  display: inline-flex;
        align-items: center;
        gap: 6px;
        font:
          500 11px/1.4 'JetBrains Mono',
          monospace;
        color: var(--info);
        background: var(--info-surface);
        padding: 2px 7px;
        border-radius: 2px;
        margin-left: 4px;
        vertical-align: 3px;
}
.v2 .tabs {
  display: flex;
        gap: 2px;
        border-bottom: 1px solid var(--rule);
        overflow-x: auto;
        margin-top: -4px;
}
.v2 .tabs a {
  padding: 8px 12px;
        text-decoration: none;
        color: var(--bark);
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        white-space: nowrap;
        font-size: 13.5px;
}
.v2 .tabs a[aria-current='page'] {
  color: var(--ink);
        border-color: var(--primary);
        font-weight: 600;
}
.v2 .tabs a .n {
  font:
          500 11px/1 'JetBrains Mono',
          monospace;
        color: var(--faint);
        margin-left: 4px;
}
.v2 .segmented {
  display: inline-flex;
        padding: 3px;
        gap: 2px;
        background: var(--sand);
        border: 1px solid var(--rule);
        border-radius: 2px;
        max-width: 100%;
        overflow-x: auto;
}
.v2 .segmented button {
  padding: 5px 10px;
        border-radius: 2px;
        color: var(--bark);
        font-size: 13px;
        white-space: nowrap;
}
.v2 .segmented button[aria-pressed='true'] {
  background: var(--paper);
        color: var(--ink);
        font-weight: 600;
        box-shadow: var(--shadow);
}
.v2 .segmented .n {
  font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        margin-left: 4px;
        color: var(--faint);
}
.v2 .btn {
  display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 2px;
        border: 1px solid var(--rule-strong);
        background: var(--paper);
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        text-decoration: none;
}
.v2 .btn:hover {
  background: var(--sand);
}
.v2 .btn.solid {
  background: var(--ink);
        color: var(--on-ink);
        border-color: var(--ink);
}
.v2 .btn.solid:hover {
  background: var(--primary-strong);
        border-color: var(--primary-strong);
        color: #fffdf9;
}
.v2 .btn.small {
  padding: 5px 9px;
        font-size: 12.5px;
}
.v2 .btn.wide {
  width: 100%;
}
.v2 .grid {
  display: grid;
        gap: 16px;
}
.v2 .g4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.v2 .g3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.v2 .g2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.v2 .g21 {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
}
.v2 .g12 {
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
}
.v2 .span2 {
  grid-column: span 2;
}
.v2 .panel {
  background: var(--sand);
        border: 1px solid var(--rule);
        border-radius: 2px;
        display: flex;
        flex-direction: column;
        min-width: 0;
}
.v2 .panel-head {
  display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 9px 12px;
        min-height: 40px;
}
.v2 .panel-head .left {
  display: flex;
        align-items: center;
        gap: 8px;
        color: var(--bark);
        min-width: 0;
}
.v2 .panel-body {
  background: var(--paper);
        border-top: 1px solid var(--rule);
        flex: 1;
        min-width: 0;
}
.v2 .pad {
  padding: 14px 16px;
}
.v2 .pill {
  display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 12px;
        border: 1px solid var(--rule);
        background: var(--paper);
        white-space: nowrap;
}
.v2 .kpi {
  background: var(--paper);
        border: 1px solid var(--rule);
        border-radius: 2px;
        padding: 12px 14px;
        min-width: 0;
}
.v2 .kpi .v {
  font:
          600 26px/1.15 'JetBrains Mono',
          monospace;
        letter-spacing: -0.02em;
        margin-top: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
}
.v2 .kpi .v small {
  font-size: 13px;
        font-weight: 500;
        color: var(--bark);
        margin-left: 4px;
}
.v2 .kpi .s {
  color: var(--bark);
        font-size: 12.5px;
        margin-top: 2px;
}
.v2 .kpi.alert {
  border-color: var(--verify);
        background: var(--verify-surface);
}
.v2 .kpi.alert .v, .v2 .kpi.alert .caps {
  color: var(--verify);
}
.v2 .tag {
  display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 7px;
        border-radius: 2px;
        font:
          500 11.5px/1.4 'JetBrains Mono',
          monospace;
        white-space: nowrap;
}
.v2 .tag::before {
  content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
}
.v2 .tag.error {
  background: var(--error-surface);
        color: var(--error);
}
.v2 .tag.late {
  background: var(--verify-surface);
        color: var(--verify);
}
.v2 .tag.info {
  background: var(--info-surface);
        color: var(--info);
}
.v2 .tag.ok {
  background: var(--success-surface);
        color: var(--success);
}
.v2 .tag.neutral {
  background: var(--clay);
        color: var(--bark);
}
.v2 .tag.plain {
  color: var(--bark);
        padding-left: 0;
}
.v2 .tag.plain::before, .v2 .tag.bare::before {
  display: none;
}
.v2 .origin {
  font:
          500 10.5px/1 'JetBrains Mono',
          monospace;
        padding: 2px 5px;
        border-radius: 2px;
        vertical-align: 1px;
        margin-left: 2px;
}
.v2 .origin.said {
  background: var(--success-surface);
        color: var(--success);
}
.v2 .origin.read {
  background: var(--verify-surface);
        color: var(--verify);
}
.v2 .origin.inferred {
  background: var(--info-surface);
        color: var(--info);
}
.v2 .quote {
  background: var(--success-surface);
        color: var(--success);
        padding: 0 4px;
        border-radius: 2px;
}
.v2 .lock {
  display: inline-flex;
        align-items: center;
        gap: 4px;
        font:
          500 11px/1.4 'JetBrains Mono',
          monospace;
        color: var(--bark);
}
.v2 .lock .i {
  width: 12px;
        height: 12px;
}
.v2 .scroll {
  overflow-x: auto;
}
.v2 table {
  width: 100%;
        border-collapse: collapse;
}
.v2 th {
  text-align: left;
        font:
          500 10.5px/1.4 'JetBrains Mono',
          monospace;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--faint);
        padding: 8px 10px;
        border-bottom: 1px solid var(--rule);
        white-space: nowrap;
        background: var(--paper);
}
.v2 td {
  padding: 9px 10px;
        border-bottom: 1px dotted var(--rule);
        vertical-align: middle;
}
.v2 tr:last-child td {
  border-bottom: 0;
}
.v2 td.n, .v2 th.n {
  text-align: right;
        font-family: 'JetBrains Mono', monospace;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
}
.v2 tr.group td {
  background: var(--sand);
        font:
          500 11px/1.4 'JetBrains Mono',
          monospace;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--bark);
        padding: 6px 10px;
        border-bottom: 1px solid var(--rule);
}
.v2 tr.total td {
  border-top: 1px solid var(--rule-strong);
        font-weight: 600;
        background: var(--sand);
}
.v2 tbody tr.row-click {
  cursor: pointer;
}
.v2 tbody tr.row-click:hover td {
  background: var(--sand);
}
.v2 tr.flash td {
  animation: flash 1.6s ease;
}
@keyframes flash {
from {
  background: var(--success-surface);
}
to {
  background: transparent;
}
}
.v2 .cell-title {
  font-weight: 600;
}
.v2 .cell-sub {
  color: var(--bark);
        font-size: 12px;
}
.v2 .bar {
  height: 6px;
        background: var(--clay);
        border-radius: 1px;
        position: relative;
        overflow: hidden;
        min-width: 60px;
}
.v2 .bar > i {
  position: absolute;
        inset: 0 auto 0 0;
        background: var(--ink);
        border-radius: 1px;
}
.v2 .bar.ok > i {
  background: var(--success);
}
.v2 .bar.warn > i {
  background: var(--ochre);
}
.v2 .bar.info > i {
  background: var(--info);
}
.v2 .chips {
  display: flex;
        flex-wrap: wrap;
        gap: 6px;
}
.v2 .chip {
  display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        border: 1px solid var(--rule);
        border-radius: 2px;
        font-size: 12.5px;
        background: var(--paper);
        text-decoration: none;
        white-space: nowrap;
}
.v2 .chip small {
  color: var(--faint);
        font:
          500 11px 'JetBrains Mono',
          monospace;
}
.v2 .chip[aria-pressed='true'] {
  border-color: var(--ink);
        font-weight: 600;
}
.v2 .toolbar {
  display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: space-between;
}
.v2 .banner {
  display: flex;
        gap: 12px;
        align-items: center;
        padding: 10px 14px;
        border: 1px solid var(--verify);
        background: var(--verify-surface);
        color: var(--verify);
        border-radius: 2px;
        flex-wrap: wrap;
}
.v2 .banner b {
  color: var(--ink);
}
.v2 .banner .btn {
  margin-left: auto;
}
.v2 .hint {
  display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 10px 14px;
        border: 1px dashed var(--info);
        background: var(--info-surface);
        color: var(--info);
        border-radius: 2px;
        font-size: 13px;
}
.v2 .hint em {
  font-style: normal;
        color: var(--ink);
}
.v2 .chart {
  width: 100%;
        height: auto;
        display: block;
}
.v2 .chart text {
  fill: var(--faint);
        font:
          500 10.5px 'JetBrains Mono',
          monospace;
}
.v2 .legend {
  display: flex;
        gap: 14px;
        flex-wrap: wrap;
        color: var(--bark);
        font-size: 12px;
}
.v2 .legend i {
  display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        margin-right: 6px;
        vertical-align: -1px;
}
.v2 .hbar {
  display: grid;
        grid-template-columns: 110px 1fr 92px;
        gap: 10px;
        align-items: center;
        padding: 6px 0;
        font-size: 13px;
}
.v2 .hbar .track {
  position: relative;
        height: 10px;
        background: var(--clay);
        border-radius: 1px;
}
.v2 .hbar .fill {
  position: absolute;
        inset: 0 auto 0 0;
        background: var(--ink);
        border-radius: 1px;
}
.v2 .hbar .fill.over {
  background: var(--error);
}
.v2 .hbar .budget {
  position: absolute;
        top: -3px;
        bottom: -3px;
        width: 2px;
        background: var(--primary);
}
.v2 .heat {
  display: grid;
        gap: 3px;
        align-items: center;
}
.v2 .heat .lbl {
  font-size: 12.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-right: 8px;
}
.v2 .heat .c {
  aspect-ratio: 1;
        border-radius: 2px;
        background: var(--heat-0);
        min-width: 8px;
}
.v2 .heat .c.l1 {
  background: var(--heat-1);
}
.v2 .heat .c.l2 {
  background: var(--heat-2);
}
.v2 .heat .c.l3 {
  background: var(--heat-3);
}
.v2 .heat .c.off {
  background: transparent;
        border: 1px dashed var(--rule);
}
.v2 .heat .c.today {
  outline: 1.5px solid var(--ink);
        outline-offset: 1px;
}
.v2 .heat .day {
  font:
          500 9.5px/1 'JetBrains Mono',
          monospace;
        color: var(--faint);
        text-align: center;
}
.v2 .board {
  display: grid;
        grid-template-columns: minmax(290px, 340px) 1fr;
        gap: 16px;
}
.v2 .list {
  padding: 6px;
}
.v2 .group-title {
  padding: 12px 8px 6px;
        display: flex;
        align-items: center;
        gap: 8px;
}
.v2 .group-title .n {
  color: var(--faint);
}
.v2 .row {
  display: grid;
        grid-template-columns: 30px 1fr auto;
        gap: 10px;
        align-items: center;
        width: 100%;
        text-align: left;
        padding: 8px;
        border: 1px solid transparent;
        border-radius: 2px;
}
.v2 .row:hover {
  background: var(--sand);
}
.v2 .row[aria-selected='true'] {
  border-color: var(--ink);
        background: var(--paper);
        box-shadow: var(--shadow);
}
.v2 .row > div {
  min-width: 0;
}
.v2 .row .t {
  font-weight: 600;
        font-size: 13.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
}
.v2 .row .s {
  color: var(--bark);
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
}
.v2 .kind {
  width: 30px;
        height: 30px;
        border-radius: 2px;
        display: grid;
        place-items: center;
        background: var(--clay);
        color: var(--bark);
}
.v2 .kind.proposed {
  background: var(--info-surface);
        color: var(--info);
        border: 1px dashed var(--info);
}
.v2 .detail {
  display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
}
.v2 .subject {
  padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
}
.v2 .subject-top {
  display: flex;
        gap: 12px;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
}
.v2 .subject-top h2 {
  font-size: 18px;
}
.v2 .context {
  margin: 0;
        line-height: 1.6;
        max-width: 76ch;
}
.v2 .timeline {
  position: relative;
        height: 58px;
        margin: 6px 4px 0;
}
.v2 .track {
  position: absolute;
        left: 0;
        right: 0;
        top: 26px;
        height: 6px;
        background: var(--clay);
        border-radius: 1px;
}
.v2 .span {
  position: absolute;
        top: 26px;
        height: 6px;
        border-radius: 1px;
}
.v2 .span.past {
  background: var(--rule-strong);
}
.v2 .span.late {
  background: var(--ochre);
}
.v2 .span.ahead {
  background: repeating-linear-gradient(90deg, var(--info) 0 6px, transparent 6px 10px);
        opacity: 0.7;
}
.v2 .mark {
  position: absolute;
        top: 0;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        white-space: nowrap;
}
.v2 .mark .lbl {
  font:
          500 10.5px/1.2 'JetBrains Mono',
          monospace;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--bark);
}
.v2 .mark .stem {
  width: 1.5px;
        height: 18px;
        background: var(--ink);
        margin-top: 3px;
}
.v2 .mark.below {
  top: 24px;
        flex-direction: column-reverse;
}
.v2 .mark.below .stem {
  margin: 0 0 3px;
        height: 14px;
}
.v2 .mark.now .lbl {
  color: var(--ink);
        font-weight: 600;
}
.v2 .mark.due .lbl {
  color: var(--primary);
        font-weight: 600;
}
.v2 .mark.due .stem {
  background: var(--primary);
}
.v2 .mark.edge-l {
  transform: none;
        align-items: flex-start;
}
.v2 .mark.edge-r {
  transform: translateX(-100%);
        align-items: flex-end;
}
.v2 .dayband {
  position: relative;
        margin: 10px 16px 0;
        height: 74px;
}
.v2 .hours {
  position: absolute;
        inset: 0;
        display: grid;
}
.v2 .hours span {
  border-left: 1px dotted var(--rule);
        font:
          500 10.5px/1 'JetBrains Mono',
          monospace;
        color: var(--faint);
        padding-left: 4px;
}
.v2 .block {
  position: absolute;
        top: 20px;
        height: 44px;
        border-radius: 2px;
        padding: 5px 7px;
        overflow: hidden;
        font-size: 12px;
        line-height: 1.25;
        border: 1px solid var(--rule-strong);
        background: var(--sand);
}
.v2 .block b {
  display: block;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
}
.v2 .block small {
  font:
          10.5px 'JetBrains Mono',
          monospace;
        color: var(--bark);
        white-space: nowrap;
}
.v2 .block.event {
  background: var(--paper);
        border-color: var(--ink);
}
.v2 .block.proposed {
  background: var(--info-surface);
        border: 1px dashed var(--info);
        color: var(--info);
}
.v2 .block.proposed small {
  color: var(--info);
}
.v2 .block.focus {
  box-shadow: 0 0 0 2px var(--primary);
}
.v2 .now-line {
  position: absolute;
        top: 12px;
        bottom: 0;
        width: 1.5px;
        background: var(--primary);
}
.v2 .now-line::before {
  content: '';
        position: absolute;
        top: -4px;
        left: -3.5px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary);
}
.v2 .choices {
  display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
}
.v2 .choice {
  background: var(--paper);
        border: 1px solid var(--rule);
        border-radius: 2px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
}
.v2 .choice.recommended {
  border: 1.5px solid var(--ink);
        box-shadow: var(--shadow);
}
.v2 .choice-head {
  display: flex;
        flex-direction: column-reverse;
        align-items: flex-start;
        gap: 8px;
}
.v2 .choice-head h3 {
  font-size: 15px;
        font-weight: 600;
}
.v2 .why {
  font:
          500 10.5px/1.3 'JetBrains Mono',
          monospace;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 3px 6px;
        border-radius: 2px;
        background: var(--info-surface);
        color: var(--info);
}
.v2 .choice p {
  margin: 0;
        color: var(--bark);
        font-size: 13px;
}
.v2 .checks {
  list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
}
.v2 .checks li {
  display: flex;
        gap: 8px;
        align-items: flex-start;
}
.v2 .checks .i {
  margin-top: 2px;
        width: 15px;
        height: 15px;
}
.v2 .checks .good .i {
  color: var(--success);
}
.v2 .checks .warn {
  color: var(--verify);
}
.v2 .choice-foot {
  margin-top: auto;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding-top: 6px;
}
.v2 .choice-foot .btn {
  flex: 1;
}
.v2 .empty {
  padding: 40px 16px;
        text-align: center;
        color: var(--bark);
}
.v2 .template {
  list-style: none;
        margin: 0;
        padding: 6px 0;
}
.v2 .template li {
  display: grid;
        grid-template-columns: 92px 1fr auto;
        gap: 10px;
        padding: 7px 16px;
        align-items: center;
        font-size: 13px;
        border-left: 3px solid transparent;
}
.v2 .template li .h {
  font:
          500 12px 'JetBrains Mono',
          monospace;
        color: var(--faint);
}
.v2 .template li.past {
  color: var(--faint);
}
.v2 .template li.current {
  border-left-color: var(--primary);
        background: var(--sand);
        font-weight: 600;
}
.v2 .template li.current .h {
  color: var(--primary);
}
.v2 .check-row {
  display: grid;
        grid-template-columns: 22px 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 9px 16px;
        border-bottom: 1px dotted var(--rule);
        width: 100%;
        text-align: left;
}
.v2 .check-row:last-child {
  border-bottom: 0;
}
.v2 .box {
  width: 18px;
        height: 18px;
        border: 1.5px solid var(--rule-strong);
        border-radius: 2px;
        display: grid;
        place-items: center;
        background: var(--paper);
}
.v2 .box .i {
  width: 13px;
        height: 13px;
        stroke-width: 2.4;
        opacity: 0;
}
.v2 .check-row.done .box {
  background: var(--success);
        border-color: var(--success);
        color: #fffdf9;
}
.v2 .check-row.done .box .i {
  opacity: 1;
}
.v2 .check-row.done .t {
  color: var(--faint);
        text-decoration: line-through;
}
.v2 .check-row.off {
  opacity: 0.55;
}
.v2 .check-row .t {
  font-weight: 500;
}
.v2 .ring {
  --p: 50;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: conic-gradient(var(--success) calc(var(--p) * 1%), var(--clay) 0);
        display: grid;
        place-items: center;
        flex: none;
}
.v2 .ring span {
  width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--paper);
        display: grid;
        place-items: center;
        font:
          600 13px 'JetBrains Mono',
          monospace;
}
.v2 .week {
  display: grid;
        grid-template-columns: 44px repeat(7, minmax(0, 1fr));
        position: relative;
}
.v2 .week .wh {
  font:
          500 11px 'JetBrains Mono',
          monospace;
        color: var(--bark);
        text-align: center;
        padding: 8px 4px;
        border-bottom: 1px solid var(--rule);
}
.v2 .week .wh b {
  display: block;
        font:
          600 16px 'JetBrains Mono',
          monospace;
        color: var(--ink);
}
.v2 .week .wh.today b {
  color: var(--on-primary);
        background: var(--primary);
        border-radius: 2px;
        display: inline-block;
        padding: 0 6px;
}
.v2 .week .gutter {
  position: relative;
}
.v2 .week .gutter span {
  position: absolute;
        right: 6px;
        font:
          500 10px 'JetBrains Mono',
          monospace;
        color: var(--faint);
        transform: translateY(-50%);
}
.v2 .week .col {
  position: relative;
        border-left: 1px solid var(--rule);
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0 39px,
          var(--rule) 39px 40px
        );
}
.v2 .week .col.today {
  background-color: var(--sand);
}
.v2 .week .ev {
  position: absolute;
        left: 3px;
        right: 3px;
        border-radius: 2px;
        padding: 3px 5px;
        font-size: 11.5px;
        line-height: 1.2;
        overflow: hidden;
        border: 1px solid var(--rule-strong);
        background: var(--paper);
}
.v2 .week .ev small {
  display: block;
        font:
          10px 'JetBrains Mono',
          monospace;
        color: var(--bark);
}
.v2 .week .ev.routine {
  background: var(--clay);
        border-color: transparent;
        color: var(--bark);
}
.v2 .week .ev.event {
  border-color: var(--ink);
}
.v2 .week .ev.due {
  border-color: var(--primary);
        background: var(--paper);
        color: var(--primary);
}
.v2 .week .ev.proposed {
  background: var(--info-surface);
        border: 1px dashed var(--info);
        color: var(--info);
}
.v2 .week .nowline {
  position: absolute;
        left: 0;
        right: 0;
        height: 1.5px;
        background: var(--primary);
        z-index: 2;
}
.v2 .ficon {
  width: 32px;
        height: 38px;
        border: 1px solid var(--rule-strong);
        border-radius: 2px;
        display: grid;
        place-items: end center;
        font:
          600 8.5px/1 'JetBrains Mono',
          monospace;
        padding-bottom: 5px;
        background: var(--paper);
        flex: none;
        position: relative;
}
.v2 .ficon::before {
  content: '';
        position: absolute;
        top: -1px;
        right: -1px;
        width: 9px;
        height: 9px;
        background: linear-gradient(225deg, var(--paper) 50%, var(--rule-strong) 50%);
}
.v2 .ficon.pdf {
  color: var(--error);
}
.v2 .ficon.img {
  color: var(--info);
}
.v2 .ficon.csv {
  color: var(--success);
}
.v2 .ficon.md {
  color: var(--bark);
}
.v2 .fname {
  display: flex;
        gap: 10px;
        align-items: center;
        min-width: 0;
}
.v2 .preview {
  border: 1px solid var(--rule);
        background: var(--sand);
        border-radius: 2px;
        aspect-ratio: 3 / 4;
        display: flex;
        flex-direction: column;
        padding: 18px;
        gap: 8px;
        overflow: hidden;
}
.v2 .preview .ln {
  height: 7px;
        background: var(--rule);
        border-radius: 1px;
}
.v2 .preview.img {
  aspect-ratio: 4 / 3;
        background: linear-gradient(160deg, var(--clay), var(--rule-strong));
        align-items: center;
        justify-content: center;
        color: var(--bark);
}
.v2 dl.meta {
  display: grid;
        grid-template-columns: 110px 1fr;
        gap: 6px 12px;
        margin: 0;
        font-size: 13px;
}
.v2 dl.meta dt {
  color: var(--faint);
        font:
          500 11px/1.8 'JetBrains Mono',
          monospace;
        text-transform: uppercase;
        letter-spacing: 0.04em;
}
.v2 dl.meta dd {
  margin: 0;
}
.v2 .model-card {
  display: grid;
        grid-template-columns: 34px 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 10px 14px;
        border-bottom: 1px dotted var(--rule);
        text-decoration: none;
}
.v2 .model-card:hover {
  background: var(--sand);
}
.v2 .model-card:last-child {
  border-bottom: 0;
}
.v2 .nature {
  font:
          500 11.5px 'JetBrains Mono',
          monospace;
        padding: 2px 6px;
        border-radius: 2px;
        background: var(--clay);
        color: var(--ink);
        white-space: nowrap;
}
.v2 .nature.ref {
  background: var(--info-surface);
        color: var(--info);
}
.v2 .nature.calc {
  background: var(--success-surface);
        color: var(--success);
}
.v2 .radio {
  display: grid;
        grid-template-columns: 20px 1fr;
        gap: 10px;
        padding: 12px 14px;
        border: 1px solid var(--rule);
        border-radius: 2px;
        cursor: pointer;
        background: var(--paper);
}
.v2 .radio:has(input:checked) {
  border-color: var(--ink);
        box-shadow: var(--shadow);
}
.v2 .radio input {
  accent-color: var(--primary);
        margin-top: 3px;
}
.v2 .path {
  font:
          500 12.5px 'JetBrains Mono',
          monospace;
        background: var(--sand);
        border: 1px solid var(--rule);
        padding: 2px 6px;
        border-radius: 2px;
        overflow-wrap: anywhere;
}
.v2 .rule-line {
  display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 10px 16px;
        border-bottom: 1px dotted var(--rule);
        font-size: 13px;
}
.v2 .rule-line:last-child {
  border-bottom: 0;
}
.v2 .kw {
  font:
          600 11px 'JetBrains Mono',
          monospace;
        text-transform: uppercase;
        color: var(--primary);
        letter-spacing: 0.04em;
        margin-right: 4px;
}
.v2 .form {
  display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        overflow-y: auto;
}
.v2 .field {
  display: flex;
        flex-direction: column;
        gap: 4px;
}
.v2 .field label {
  font:
          500 11px 'JetBrains Mono',
          monospace;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--bark);
        display: flex;
        justify-content: space-between;
}
.v2 .field label small {
  text-transform: none;
        letter-spacing: 0;
        color: var(--faint);
}
.v2 .field input, .v2 .field select {
  padding: 8px 10px;
        border: 1px solid var(--rule-strong);
        border-radius: 2px;
        background: var(--paper);
        width: 100%;
}
.v2 .field-row {
  display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
}
.v2 .warnbox {
  padding: 10px 12px;
        border: 1px solid var(--verify);
        background: var(--verify-surface);
        color: var(--verify);
        border-radius: 2px;
        font-size: 13px;
        display: none;
}
.v2 .warnbox.show {
  display: block;
}
.v2 .scrim {
  position: fixed;
        inset: 0;
        background: rgba(23, 16, 12, 0.32);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        z-index: 20;
}
.v2 .scrim.open {
  opacity: 1;
        pointer-events: auto;
}
.v2 .drawer {
  position: fixed;
        top: 12px;
        right: 12px;
        bottom: 12px;
        width: min(420px, calc(100vw - 24px));
        background: var(--paper);
        border: 1px solid var(--rule);
        border-radius: 2px;
        box-shadow: var(--shadow);
        z-index: 21;
        transform: translateX(calc(100% + 24px));
        transition: transform 0.25s ease;
        display: flex;
        flex-direction: column;
}
.v2 .drawer.open {
  transform: none;
}
.v2 .drawer-head {
  display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--rule);
}
.v2 .drawer-head h2 {
  font-size: 16px;
}
.v2 .drawer-foot {
  padding: 12px 16px;
        border-top: 1px solid var(--rule);
        display: flex;
        gap: 8px;
}
.v2 .drawer-foot .btn {
  flex: 1;
}
.v2 .journal {
  list-style: none;
        margin: 0;
        padding: 4px 16px;
        overflow-y: auto;
}
.v2 .journal li {
  display: grid;
        grid-template-columns: 46px 1fr auto;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px dotted var(--rule);
        font-size: 13px;
        align-items: start;
}
.v2 .journal time {
  font:
          500 11.5px/1.6 'JetBrains Mono',
          monospace;
        color: var(--faint);
}
.v2 .journal small {
  display: block;
        color: var(--bark);
        font-size: 12px;
}
.v2 .journal .undo {
  font-size: 12px;
        font-weight: 600;
        color: var(--primary);
}
.v2 .journal li.undone {
  opacity: 0.45;
        text-decoration: line-through;
}
.v2 .toast {
  position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translate(-50%, 120px);
        opacity: 0;
        pointer-events: none;
        background: var(--ink);
        color: var(--on-ink);
        padding: 10px 12px 10px 16px;
        border-radius: 2px;
        display: flex;
        gap: 16px;
        align-items: center;
        z-index: 30;
        transition:
          transform 0.25s ease,
          opacity 0.25s;
        box-shadow: var(--shadow);
        font-size: 13px;
        max-width: calc(100vw - 32px);
}
.v2 .toast.show {
  transform: translate(-50%, 0);
        opacity: 1;
        pointer-events: auto;
}
.v2 .toast button {
  font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 3px;
}
.v2 button:focus-visible, .v2 a:focus-visible, .v2 input:focus-visible, .v2 select:focus-visible {
  outline: 2px solid var(--primary);
        outline-offset: 2px;
}
.v2 .task-add {
  display: flex;
        gap: 8px;
        padding: 12px 16px;
        align-items: center;
        flex-wrap: wrap;
}
.v2 .task-add input[name='title'] {
  flex: 1 1 240px;
        min-width: 0;
}
.v2 .task-add input[type='date'] {
  flex: 0 0 auto;
}
.v2 .task-filters {
  display: flex;
        gap: 12px;
        align-items: flex-end;
        justify-content: space-between;
        flex-wrap: wrap;
}
.v2 .task-filters .tabs {
  flex: 1 1 auto;
        margin-top: 0;
}
.v2 .task-filters select {
  width: auto;
        max-width: 100%;
}
.v2 .task-selects {
  display: flex;
        gap: 8px;
        flex-wrap: wrap;
}
.v2 .task-row.stream .kind-ic {
  width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border: 1px solid var(--rule);
        border-radius: 6px;
        color: var(--bark);
}
.v2 .task-row {
  display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 10px 16px;
        border-bottom: 1px dotted var(--rule);
        color: inherit;
        text-decoration: none;
}
.v2 .task-row:last-child {
  border-bottom: 0;
}
.v2 .task-row.exec {
  grid-template-columns: auto minmax(0, 1fr);
}
.v2 .task-row.exec:hover {
  background: var(--paper-2, var(--paper));
}
.v2 .task-row.late .cell-sub:first-of-type {
  color: var(--error, var(--primary));
}
.v2 .task-main {
  min-width: 0;
}
.v2 .task-main .cell-title {
  display: block;
        color: var(--ink);
        text-decoration: none;
        overflow-wrap: anywhere;
}
.v2 .task-main a:hover {
  text-decoration: underline;
}
.v2 .task-actions {
  display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
}
.v2 .task-done {
  cursor: pointer;
}
.v2 .task-done:hover .i {
  opacity: 0.6;
}
@media (max-width: 760px) {
  .v2 .task-row {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .v2 .task-row.stream {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .v2 .task-row.stream .tag {
    grid-column: 2;
    justify-self: start;
  }
  .v2 .task-actions {
    grid-column: 2;
    justify-content: flex-start;
  }
}
@media (max-width: 1180px) {
.v2 .g4 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.v2 .g3, .v2 .g21, .v2 .g12 {
  grid-template-columns: minmax(0, 1fr);
}
.v2 .span2 {
  grid-column: auto;
}
}
@media (max-width: 980px) {
.v2 .board {
  grid-template-columns: 1fr;
}
.v2 .board.reading .list-panel {
  display: none;
}
.v2 .board:not(.reading) .detail {
  display: none;
}
.v2 .back {
  display: inline-flex !important;
}
.v2 .g2 {
  grid-template-columns: minmax(0, 1fr);
}
}
@media (max-width: 760px) {
.v2 .app {
  grid-template-columns: 1fr;
          padding: 0;
}
.v2 main {
  border: 0;
          border-radius: 0;
          box-shadow: none;
}
.v2 aside.side {
  position: fixed;
          z-index: 22;
          inset: 0 auto 0 0;
          width: 280px;
          background: var(--canvas);
          padding: 12px;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
}
.v2 aside.side.open {
  transform: none;
}
.v2 .only-mobile {
  display: grid;
}
.page.v2 {
  padding: 16px;
}
.v2 .hide-s {
  display: none !important;
}
.v2 .g4 {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
}
.v2 .kpi .v {
  font-size: 20px;
}
.v2 .head-actions {
  width: 100%;
}
.v2 .hbar {
  grid-template-columns: 84px 1fr 74px;
}
.v2 .week {
  min-width: 640px;
}
.v2 .field-row {
  grid-template-columns: 1fr;
}
}
.v2 .back {
  display: none;
        align-items: center;
        gap: 6px;
        color: var(--bark);
        font-size: 13px;
}
.v2 .x-mirror {
  font-family: Archivo, sans-serif; font-size: 21px; line-height: 1.45; font-weight: 500; color: var(--ink); max-width: 64ch; text-wrap: pretty;
}
.v2 .x-mirror b {
  font-weight: 700;
}
.v2 .x-mirror .calc {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: var(--info); background: var(--info-surface); border-radius: 4px; padding: 1px 5px; vertical-align: 3px;
}
.v2 .x-grid {
  display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
}
.v2 .x-grid > * {
  min-width: 0;
}
.v2 .x-days {
  display: grid; grid-template-columns: minmax(110px, 1.4fr) repeat(7, minmax(18px, 1fr)) 56px; gap: 6px 4px; align-items: center; font-size: 13px;
}
.v2 .x-days .h {
  font-size: 11px; color: var(--faint); text-align: center; font-family: 'JetBrains Mono', monospace;
}
.v2 .x-dot {
  width: 18px; height: 18px; border-radius: 50%; margin: 0 auto; border: 2px solid var(--rule-strong);
}
.v2 .x-dot.done {
  background: var(--success); border-color: var(--success);
}
.v2 .x-dot.miss {
  border-color: var(--error); background: var(--error-surface);
}
.v2 .x-dot.moved {
  border-color: var(--verify); background: linear-gradient(90deg, var(--verify-surface) 50%, transparent 50%);
}
.v2 .x-dot.off {
  border-style: dashed; opacity: 0.5;
}
.v2 .x-streak {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--bark); text-align: right;
}
.v2 .x-cmp {
  display: grid; grid-template-columns: minmax(110px, 1fr) minmax(0, 2fr) 92px; gap: 6px 10px; align-items: center; font-size: 13px;
}
.v2 .x-cmp .bars {
  display: flex; flex-direction: column; gap: 3px;
}
.v2 .x-cmp .plan, .v2 .x-cmp .real {
  height: 9px; border-radius: 3px;
}
.v2 .x-cmp .plan {
  background: var(--clay); border: 1px dashed var(--rule-strong);
}
.v2 .x-cmp .real {
  background: var(--ink);
}
.v2 .x-cmp .real.over {
  background: var(--verify);
}
.v2 .x-cmp .v {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; text-align: right; color: var(--bark);
}
.v2 .x-legend {
  display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--bark);
}
.v2 .x-legend span {
  display: inline-flex; align-items: center; gap: 6px;
}
.v2 .x-q {
  display: flex; flex-direction: column; gap: 6px;
}
.v2 .x-q label {
  font-weight: 600; font-size: 14px;
}
.v2 .x-q textarea {
  min-height: 64px; border: 1px solid var(--rule); border-radius: 8px; background: var(--sand); padding: 10px 12px; font: inherit; color: var(--ink); resize: vertical;
}
.v2 .x-decide {
  display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--rule);
}
.v2 .x-decide:last-child {
  border-bottom: 0;
}
.v2 .x-arrow {
  color: var(--faint); font-family: 'JetBrains Mono', monospace;
}
.v2 .x-big {
  font-family: Archivo, sans-serif; font-weight: 700; font-size: 30px; line-height: 1.1;
}
.v2 .x-big small {
  font-size: 14px; font-weight: 500; color: var(--bark); margin-left: 6px;
}
.v2 .x-person {
  display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
}
.v2 .x-avatar {
  width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-family: Archivo, sans-serif; font-weight: 700; font-size: 18px; background: var(--ochre); color: var(--on-primary); flex: none;
}
.v2 .x-across {
  display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
}
.v2 .x-app {
  border: 1px solid var(--rule); border-radius: 10px; padding: 12px; background: var(--paper); display: flex; flex-direction: column; gap: 6px; min-width: 0;
}
.v2 .x-app .top {
  display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13.5px;
}
.v2 .x-app .top .app-icon {
  width: 22px; height: 22px;
}
.v2 .x-app p {
  margin: 0; font-size: 13px; color: var(--bark);
}
.v2 .x-app.write {
  border-color: var(--ink); box-shadow: var(--shadow);
}
.v2 .x-tl {
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column;
}
.v2 .x-tl li {
  display: grid; grid-template-columns: 92px 14px minmax(0, 1fr); gap: 10px; padding-bottom: 14px; position: relative; font-size: 13.5px;
}
.v2 .x-tl li time {
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--faint); padding-top: 1px;
}
.v2 .x-tl li i {
  width: 10px; height: 10px; border-radius: 50%; background: var(--rule-strong); margin-top: 5px; position: relative; z-index: 1;
}
.v2 .x-tl li::before {
  content: ''; position: absolute; left: 108px; top: 12px; bottom: 0; width: 2px; background: var(--rule);
}
.v2 .x-tl li:last-child::before {
  display: none;
}
.v2 .x-tl li small {
  display: block; color: var(--bark); font-size: 12px;
}
.v2 .x-touch {
  display: inline-flex; align-items: center; gap: 6px; border-radius: 99px; padding: 3px 10px 3px 4px; font-size: 12.5px; font-weight: 600; background: var(--sand); border: 1px solid var(--rule); color: var(--ink); text-decoration: none;
}
.v2 .x-touch .app-icon {
  width: 20px; height: 20px;
}
.v2 .x-edit {
  border-radius: 5px; padding: 2px 5px; margin: -2px -5px; outline: none;
}
.v2 .x-edit:hover {
  background: var(--clay);
}
.v2 .x-edit:focus {
  background: var(--sand); box-shadow: 0 0 0 2px var(--info);
}
.v2 .x-rel {
  display: flex; flex-direction: column; gap: 8px;
}
.v2 .x-rel a {
  display: flex; gap: 10px; align-items: center; padding: 9px 12px; border-radius: 8px; background: var(--sand); color: var(--ink); text-decoration: none; font-size: 13.5px;
}
.v2 .x-rel a em {
  font-style: normal; color: var(--bark);
}
.v2 .x-tech {
  margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; background: var(--sand); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px; overflow-x: auto; color: var(--bark); white-space: pre;
}
.v2 .x-matrix td.c {
  text-align: center;
}
.v2 .x-matrix .r, .v2 .x-matrix .w, .v2 .x-matrix .rw {
  display: inline-block; font-size: 11px; font-weight: 600; border-radius: 4px; padding: 1px 6px;
}
.v2 .x-matrix .r {
  background: var(--info-surface); color: var(--info);
}
.v2 .x-matrix .w {
  background: var(--success-surface); color: var(--success);
}
.v2 .x-matrix .rw {
  background: var(--ink); color: var(--on-ink);
}
.v2 .x-intent {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.v2 .x-intent span {
  font-size: 12.5px; border: 1px solid var(--rule-strong); border-radius: 99px; padding: 2px 10px; background: var(--paper);
}
.v2 .x-intent span.t {
  background: var(--clay); border-color: var(--clay); font-weight: 600;
}
.v2 .x-struct {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 10px; align-items: stretch;
}
.v2 .x-struct div {
  border: 1px solid var(--rule); border-radius: 10px; padding: 12px; background: var(--sand); font-size: 13px;
}
.v2 .x-struct div b {
  display: block; font-family: Archivo, sans-serif; font-size: 15px; margin-bottom: 4px;
}
.v2 .x-src {
  display: flex; flex-direction: column; gap: 2px;
}
.v2 .x-src button {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; border: 0; background: transparent; text-align: left; font: inherit; color: var(--ink); cursor: pointer;
}
.v2 .x-src button[aria-pressed='true'] {
  background: var(--paper); box-shadow: var(--shadow); font-weight: 600;
}
.v2 .x-src button .n {
  margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--faint);
}
.v2 .x-files {
  display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; align-items: start;
}
.v2 .x-path {
  font-size: 13px; color: var(--bark); display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
}
.v2 .x-path b {
  color: var(--ink);
}
.v2 .x-occ {
  display: inline-flex; border: 1px solid var(--rule); border-radius: 8px; overflow: hidden;
}
.v2 .x-occ button {
  border: 0; background: var(--paper); padding: 4px 9px; font: inherit; font-size: 12px; color: var(--bark); cursor: pointer;
}
.v2 .x-occ button + button {
  border-left: 1px solid var(--rule);
}
.v2 .x-occ button[aria-pressed='true'].done {
  background: var(--success-surface); color: var(--success); font-weight: 600;
}
.v2 .x-occ button[aria-pressed='true'].miss {
  background: var(--error-surface); color: var(--error); font-weight: 600;
}
.v2 .x-occ button[aria-pressed='true'].moved {
  background: var(--verify-surface); color: var(--verify); font-weight: 600;
}
.v2 .x-day {
  display: flex; flex-direction: column;
}
.v2 .x-day .slot {
  display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--rule);
}
.v2 .x-day .slot:last-child {
  border-bottom: 0;
}
.v2 .x-day .slot time {
  font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: var(--bark);
}
.v2 .x-day .slot.tpl {
  background: var(--sand);
}
.v2 .x-day .slot.now {
  box-shadow: inset 3px 0 0 var(--error);
}
.v2 .x-day .meta {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;
}
.v2 .x-day .bell {
  display: inline-flex; gap: 4px; align-items: center; font-size: 11.5px; color: var(--bark); border: 1px solid var(--rule); border-radius: 99px; padding: 1px 8px;
}
.v2 .x-day .bell svg {
  width: 12px; height: 12px;
}
.v2 .x-month {
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
}
.v2 .x-month .mh {
  font-size: 11px; color: var(--faint); text-align: center; padding: 8px 0; border-bottom: 1px solid var(--rule); font-family: 'JetBrains Mono', monospace;
}
.v2 .x-month .md {
  min-height: 86px; border-right: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding: 6px; display: flex; flex-direction: column; gap: 4px; min-width: 0;
}
.v2 .x-month .md:nth-child(7n + 7) {
  border-right: 0;
}
.v2 .x-month .md.out {
  background: var(--sand); color: var(--faint);
}
.v2 .x-month .md .d {
  font-family: 'JetBrains Mono', monospace; font-size: 12px;
}
.v2 .x-month .md.today .d {
  background: var(--primary); color: var(--on-primary); border-radius: 5px; padding: 0 6px; align-self: flex-start;
}
.v2 .x-month .dots {
  display: flex; gap: 3px; flex-wrap: wrap;
}
.v2 .x-month .dots i {
  width: 7px; height: 7px; border-radius: 50%;
}
.v2 .x-month .ev {
  font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 2px solid var(--c, var(--ink)); padding-left: 4px;
}
.v2 .x-steps {
  display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; font-weight: 600; color: var(--faint);
}
.v2 .x-steps span {
  display: inline-flex; gap: 8px; align-items: center;
}
.v2 .x-steps i {
  font-style: normal; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--rule-strong); display: grid; place-items: center; font-size: 11px; font-family: 'JetBrains Mono', monospace;
}
.v2 .x-steps .on {
  color: var(--ink);
}
.v2 .x-steps .on i {
  background: var(--ink); border-color: var(--ink); color: var(--on-ink);
}
.v2 .x-steps .done i {
  background: var(--success); border-color: var(--success); color: var(--on-ink);
}
@media (max-width: 760px) {
.v2 .x-files {
  grid-template-columns: minmax(0, 1fr);
}
.v2 .x-decide {
  grid-template-columns: minmax(0, 1fr);
}
.v2 .x-cmp {
  grid-template-columns: minmax(0, 1fr) 80px;
}
.v2 .x-cmp .bars {
  grid-column: 1 / -1; grid-row: 2;
}
.v2 .x-mirror {
  font-size: 18px;
}
.v2 .x-day .slot {
  grid-template-columns: 52px minmax(0, 1fr);
}
.v2 .x-day .slot > :last-child {
  grid-column: 2;
}
.v2 .x-tl li {
  grid-template-columns: 70px 14px minmax(0, 1fr);
}
.v2 .x-tl li::before {
  left: 86px;
}
}
.x-tabbar {
  display: none;
}
@media (max-width: 760px) {
.x-tabbar {
  display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 21; background: var(--paper); border-top: 1px solid var(--rule); justify-content: space-around; align-items: center; padding: 6px max(8px, env(safe-area-inset-right, 0px)) calc(6px + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
}
.x-tabbar a, .x-tabbar button {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 58px; min-height: 46px; border: 0; background: none; font: inherit; font-size: 11px; font-weight: 600; color: var(--faint); text-decoration: none; position: relative;
}
.x-tabbar a[aria-current='page'] {
  color: var(--ink);
}
.x-tabbar .n {
  position: absolute; top: 2px; right: 12px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--primary); color: var(--on-primary); font-size: 10px; display: grid; place-items: center; padding: 0 4px;
}
.x-tabbar .fab {
  width: 52px; height: 52px; min-width: 52px; border-radius: 16px; background: var(--primary); color: var(--on-primary); margin-top: -24px; box-shadow: var(--shadow);
}
.x-tabbar .fab .i {
  width: 24px; height: 24px;
}
.page.v2 {
  padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
}
.v2 .toast {
  bottom: calc(84px + env(safe-area-inset-bottom, 0px));
}
.v2 .x-month .md {
  min-height: 58px; padding: 4px;
}
.v2 .x-month .ev {
  display: none;
}
.v2 .x-days {
  grid-template-columns: minmax(84px, 1.2fr) repeat(7, minmax(14px, 1fr)) 36px; font-size: 12px;
}
.v2 .x-dot {
  width: 14px; height: 14px;
}
}

.v2 .tabs-more { position: relative; display: inline-flex; }
.v2 .tabs-more > summary { list-style: none; cursor: pointer; padding: 10px 14px; color: var(--bark); }
.v2 .tabs-more > summary::-webkit-details-marker { display: none; }
.v2 .tabs-more > summary[aria-current] { color: var(--ink); font-weight: 600; }
.v2 .tabs-menu { position: fixed; z-index: 60; min-width: 230px; background: var(--paper); border: 1px solid var(--rule-strong); box-shadow: 0 8px 22px rgba(0,0,0,.10); display: flex; flex-direction: column; padding: 4px; }
.v2 .tabs-menu a { padding: 8px 10px; white-space: nowrap; border: 0 !important; display: flex; justify-content: space-between; gap: 12px; }
.v2 .tabs-menu a:hover, .v2 .tabs-menu a[aria-current] { background: var(--sand); }

.v2 .dt-wrap { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.v2 .dt-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.v2 .dt-q { max-width: 280px; }
.v2 .btn.on, .v2 summary.btn.on { border-color: var(--primary); color: var(--primary); }
.v2 .dt-facet { position: relative; }
.v2 .dt-facet > summary { list-style: none; } .v2 .dt-facet > summary::-webkit-details-marker { display: none; }
.v2 .dt-menu { position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; min-width: 240px; max-height: 300px; overflow: auto; background: var(--paper); border: 1px solid var(--rule-strong); box-shadow: 0 8px 22px rgba(0,0,0,.10); padding: 6px; }
.v2 .dt-opt { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; padding: 5px 6px; cursor: pointer; } .v2 .dt-opt:hover { background: var(--sand); }
.v2 .dt-opt b { font-weight: 500; color: var(--bark); font-family: "JetBrains Mono", monospace; font-size: 12px; }
.v2 .dt-pills { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.v2 .dt-pill { border: 1px solid var(--primary); color: var(--primary); background: var(--paper); border-radius: 999px; padding: 3px 10px; font-size: 12.5px; cursor: pointer; }
.v2 .dt-adv { border: 1px solid var(--rule); background: var(--sand); padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.v2 .dt-cond { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(110px, 0.8fr) minmax(140px, 1.4fr) auto; gap: 6px; }
.v2 .dt-meta { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; color: var(--bark); font-size: 13px; }
.v2 .dt-meta b { color: var(--ink); } .v2 .dt-bulk { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.v2 table.dt th.dt-sort { cursor: pointer; user-select: none; white-space: nowrap; } .v2 table.dt th.dt-sort:hover { color: var(--ink); }
.v2 table.dt td.dt-check, .v2 table.dt th.dt-check { width: 28px; }
.v2 table.dt { min-width: 100%; } .v2 table.dt td { vertical-align: top; }
.v2 table.dt td .cell-title { display: block; min-width: 240px; max-width: 420px; font-weight: 600; }
.v2 table.dt td:not(:first-child) { min-width: 112px; max-width: 280px; }
.v2 iframe.live { display: block; width: 100%; border: 0; background: var(--paper); } .v2 table.dt .link, .v2 .dt-tag, .v2 table.dt .mono { white-space: nowrap; }
.v2 table.dt td.dt-acts { white-space: nowrap; text-align: right; } .v2 table.dt td.dt-acts .btn { margin-left: 4px; }
.v2 .dt-tag { display: inline-block; padding: 1px 8px; border-radius: 999px; background: var(--sand); font-size: 12px; }
.v2 .dt-pages { display: flex; gap: 8px; align-items: center; justify-content: flex-end; font-size: 13px; }
.v2 .rv { display: grid; grid-template-columns: minmax(240px, 0.9fr) minmax(0, 1.4fr); gap: 12px; min-height: 420px; }
.v2 .rv-list { border: 1px solid var(--rule); max-height: 620px; overflow: auto; display: flex; flex-direction: column; }
.v2 .rv-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; justify-items: start; width: 100%; gap: 2px 8px; text-align: left; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--rule); background: var(--paper); cursor: pointer; font: inherit; color: inherit; }
.v2 .rv-item:hover { background: var(--sand); } .v2 .rv-item.on { background: var(--sand); box-shadow: inset 3px 0 0 var(--primary); }
.v2 .rv-t { font-weight: 600; min-width: 0; overflow-wrap: anywhere; } .v2 .rv-s { grid-column: 1 / -1; color: var(--bark); font-size: 12.5px; }
.v2 .dt-badge { font-family: "JetBrains Mono", monospace; font-size: 12px; border: 1px solid var(--rule-strong); border-radius: 999px; padding: 0 7px; align-self: start; }
.v2 .rv-detail { border: 1px solid var(--rule); padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.v2 .rv-head h3 { margin: 0 0 4px; font-size: 18px; } .v2 .rv-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.v2 .rv-fields { display: grid; grid-template-columns: minmax(110px, 30%) 1fr; gap: 8px 14px; margin: 0; }
.v2 .rv-fields dt { color: var(--bark); font-size: 12.5px; } .v2 .rv-fields dd { margin: 0; }
.v2 .fn { display: flex; flex-direction: column; gap: 10px; }
.v2 .fn-row { display: grid; grid-template-columns: minmax(90px, 22%) 1fr minmax(70px, auto); gap: 10px; align-items: center; }
.v2 .fn-track { height: 22px; display: flex; justify-content: center; background: var(--sand); }
.v2 .fn-bar { height: 100%; border-radius: 2px; }
.v2 .ring { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
.v2 .ring svg { width: 150px; height: 150px; flex: 0 0 150px; } .v2 .ring-n { font: 600 16px "JetBrains Mono", monospace; fill: var(--ink); }
@media (max-width: 760px) { .v2 .rv { grid-template-columns: 1fr; } .v2 .rv-list { max-height: 320px; } .v2 .dt-cond { grid-template-columns: 1fr 1fr; } }
`;
