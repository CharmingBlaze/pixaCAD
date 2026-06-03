import fs from 'fs';

const themes = [
  ['lavender', { bg: '#1a1528', text: '#f3e8ff', border: '#4c3d6e', brand: '#d8b4fe', accent: '#a855f7', accentD: '#7e22ce', viewport: '#0f0a18', soft: '#3b0764' }],
  ['rose', { bg: '#2a1520', text: '#fce7f3', border: '#6b3a52', brand: '#f9a8d4', accent: '#ec4899', accentD: '#be185d', viewport: '#180810', soft: '#500724' }],
  ['slate', { bg: '#1e293b', text: '#f1f5f9', border: '#475569', brand: '#94a3b8', accent: '#3b82f6', accentD: '#1d4ed8', viewport: '#0f172a', soft: '#334155' }],
  ['amber', { bg: '#292018', text: '#fef3c7', border: '#78552a', brand: '#fcd34d', accent: '#f59e0b', accentD: '#b45309', viewport: '#1a1208', soft: '#451a03' }],
  ['nord', { bg: '#2e3440', text: '#eceff4', border: '#4c566a', brand: '#88c0d0', accent: '#5e81ac', accentD: '#4c566a', viewport: '#242933', soft: '#3b4252' }],
  ['dracula', { bg: '#282a36', text: '#f8f8f2', border: '#44475a', brand: '#bd93f9', accent: '#bd93f9', accentD: '#6272a4', viewport: '#1e1f29', soft: '#44475a' }],
  ['sakura', { bg: '#fdf2f8', text: '#500724', border: '#f9a8d4', brand: '#db2777', accent: '#ec4899', accentD: '#be185d', viewport: '#fce7f3', soft: '#fbcfe8', light: true }],
  ['terminal', { bg: '#0d1117', text: '#39ff14', border: '#238636', brand: '#39ff14', accent: '#238636', accentD: '#196127', viewport: '#010409', soft: '#161b22' }],
  ['coral', { bg: '#2a1215', text: '#fff1f2', border: '#7f3d47', brand: '#fda4af', accent: '#f43f5e', accentD: '#be123c', viewport: '#180608', soft: '#4c0519' }],
  ['arctic', { bg: '#f0f9ff', text: '#0c4a6e', border: '#7dd3fc', brand: '#0284c7', accent: '#0ea5e9', accentD: '#0369a1', viewport: '#bae6fd', soft: '#e0f2fe', light: true }],
  ['espresso', { bg: '#292018', text: '#fef3c7', border: '#6b5344', brand: '#d4a574', accent: '#b45309', accentD: '#78350f', viewport: '#1a1208', soft: '#422006' }],
  ['neon', { bg: '#0a0a0f', text: '#00ffff', border: '#ff00ff', brand: '#00ffff', accent: '#ff00ff', accentD: '#cc00cc', viewport: '#050508', soft: '#1a0a1a' }],
  ['mint', { bg: '#ecfdf5', text: '#064e3b', border: '#6ee7b7', brand: '#059669', accent: '#10b981', accentD: '#047857', viewport: '#d1fae5', soft: '#a7f3d0', light: true }],
  ['grape', { bg: '#1e1033', text: '#f3e8ff', border: '#6b21a8', brand: '#d8b4fe', accent: '#a855f7', accentD: '#7e22ce', viewport: '#120820', soft: '#3b0764' }],
];

let out = '';
for (const [id, t] of themes) {
  const light = t.light;
  const surf = light ? '#fff' : t.soft;
  const surfG = light
    ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
    : `linear-gradient(180deg, ${t.soft} 0%, ${t.bg} 100%)`;
  const panel = light ? '#f8fafc' : t.bg;
  const drop = light ? '#fff' : t.soft;
  out += `.khedApp[data-theme='${id}'], html[data-theme='${id}'] .khedApp {
  --t-body-bg: ${t.bg}; --t-body-text: ${t.text}; --t-app-border: ${t.border};
  --t-menu-bg: linear-gradient(180deg, ${t.soft} 0%, ${t.bg} 100%); --t-menu-border: ${t.border};
  --t-brand: ${t.brand}; --t-brand-border: ${t.border}; --t-menu-hover: ${t.accent};
  --t-dropdown-bg: ${drop}; --t-dropdown-border: ${t.border}; --t-panel-bg: ${panel};
  --t-panel-grad: linear-gradient(180deg, ${t.soft} 0%, ${panel} 100%);
  --t-border: ${t.border}; --t-border-light: ${t.border}; --t-border-muted: ${t.border};
  --t-heading: ${t.text}; --t-muted: ${light ? '#64748b' : t.brand}; --t-subtle: ${light ? '#94a3b8' : t.brand}; --t-link: ${t.accent};
  --t-accent: ${t.accent}; --t-accent-dark: ${t.accentD}; --t-accent-soft: ${t.soft};
  --t-accent-grad: linear-gradient(180deg, ${t.brand} 0%, ${t.accent} 100%);
  --t-surface: ${surf}; --t-surface-grad: ${surfG};
  --t-surface-hover: ${light ? '#f1f5f9' : t.soft}; --t-surface-alt: ${t.soft}; --t-input-border: ${t.border};
  --t-viewport-bg: ${t.viewport}; --t-viewport-border: ${t.border};
  --t-split-bg: linear-gradient(180deg, ${t.border} 0%, ${t.accentD} 100%); --t-split-hover: ${t.accent};
  --t-scroll-track: ${panel}; --t-scroll-border: ${t.border};
  --t-scroll-thumb: linear-gradient(180deg, ${t.accent} 0%, ${t.accentD} 100%);
  --t-scroll-thumb-hover: linear-gradient(180deg, ${t.brand} 0%, ${t.accent} 100%);
  --t-scene-meta: ${light ? t.accent : t.brand}; --t-window-bg: ${t.soft}; --t-window-border: ${t.border};
  --t-titlebar-bg: ${panel}; --t-titlebar-text: ${t.text}; --t-toolbar-bg: ${panel}; --t-pixel-bg: ${t.soft};
  --t-dialog-bg: ${surf}; --t-dialog-border: ${t.border}; --t-dialog-backdrop: rgba(0,0,0,${light ? 0.35 : 0.65});
  --t-dialog-text: ${t.text}; --t-dialog-muted: ${light ? '#475569' : t.brand};
  --t-danger-bg: ${light ? '#fef2f2' : '#450a0a'}; --t-danger-border: #ef4444; --t-danger-text: ${light ? '#991b1b' : '#fecaca'}; --t-danger-hover: ${light ? '#fecaca' : '#7f1d1d'};
  --t-warning-bg: ${light ? '#fffbeb' : '#422006'}; --t-warning-solid: #f59e0b; --t-tool-active-bg: ${t.soft}; --t-tool-active-border: ${t.accent};
  --t-layer-bg: ${panel}; --t-layer-active: ${t.soft}; --t-status-bg: ${panel}; --t-status-border: ${t.border};
  --t-toggle-grad: linear-gradient(180deg, ${surf} 0%, ${panel} 100%); --t-toggle-text: ${t.text};
  --t-toggle-border: ${t.border}; --t-toggle-active: linear-gradient(180deg, ${t.brand} 0%, ${t.accent} 100%);
  --t-poly-dash: ${t.accent}; --t-badge-bg: ${t.soft}; --t-badge-text: ${t.text}; --t-badge-border: ${t.border};
  --t-help-bg: ${surf}; --t-help-border: ${t.border}; --t-close: #ef4444; --t-minimize: ${t.border};
}
html[data-theme='${id}'] { background: ${t.bg}; color: ${t.text}; }

`;
}

fs.appendFileSync('src/styles/themes.css', out);
console.log('appended', themes.length, 'themes');
