import fs from 'fs';
import path from 'path';

/** @typedef {{ label: string, bg: string, text: string, border: string, brand: string, accent: string, accentD: string, viewport: string, soft: string, light?: boolean }} ThemeDef */

/** @type {Record<string, ThemeDef>} */
const PALETTES = {
  classic: {
    label: 'Classic (Default)',
    bg: '#aca899',
    text: '#111111',
    border: '#716f64',
    brand: '#003399',
    accent: '#316ac5',
    accentD: '#1c4a8f',
    viewport: '#586878',
    soft: '#ece9d8',
    light: true,
  },
  midnight: {
    label: 'Midnight',
    bg: '#0f1117',
    text: '#e8eaef',
    border: '#2a3142',
    brand: '#a5b4fc',
    accent: '#6366f1',
    accentD: '#4338ca',
    viewport: '#0a0c12',
    soft: '#1a1f2e',
  },
  charcoal: {
    label: 'Charcoal',
    bg: '#2a2826',
    text: '#eceae8',
    border: '#5c5652',
    brand: '#f0a080',
    accent: '#c46840',
    accentD: '#8b4428',
    viewport: '#1a1816',
    soft: '#3a3834',
  },
  forest: {
    label: 'Forest',
    bg: '#142318',
    text: '#e8f5e9',
    border: '#2d4a32',
    brand: '#86efac',
    accent: '#22c55e',
    accentD: '#15803d',
    viewport: '#0a1510',
    soft: '#1e3324',
  },
  sunset: {
    label: 'Sunset',
    bg: '#2a1810',
    text: '#fff7ed',
    border: '#5c3d2e',
    brand: '#fdba74',
    accent: '#f97316',
    accentD: '#c2410c',
    viewport: '#1a0f0a',
    soft: '#3d2314',
  },
  ocean: {
    label: 'Ocean',
    bg: '#0a1929',
    text: '#e0f2fe',
    border: '#1e4976',
    brand: '#7dd3fc',
    accent: '#0ea5e9',
    accentD: '#0369a1',
    viewport: '#041018',
    soft: '#0c2340',
  },
  lavender: {
    label: 'Lavender',
    bg: '#1a1528',
    text: '#f3e8ff',
    border: '#4c3d6e',
    brand: '#d8b4fe',
    accent: '#a855f7',
    accentD: '#7e22ce',
    viewport: '#0f0a18',
    soft: '#3b0764',
  },
  rose: {
    label: 'Rose',
    bg: '#2a1520',
    text: '#fce7f3',
    border: '#6b3a52',
    brand: '#f9a8d4',
    accent: '#ec4899',
    accentD: '#be185d',
    viewport: '#180810',
    soft: '#500724',
  },
  slate: {
    label: 'Slate',
    bg: '#1e293b',
    text: '#f1f5f9',
    border: '#475569',
    brand: '#94a3b8',
    accent: '#3b82f6',
    accentD: '#1d4ed8',
    viewport: '#0f172a',
    soft: '#334155',
  },
  amber: {
    label: 'Amber',
    bg: '#292018',
    text: '#fef3c7',
    border: '#78552a',
    brand: '#fcd34d',
    accent: '#f59e0b',
    accentD: '#b45309',
    viewport: '#1a1208',
    soft: '#451a03',
  },
  nord: {
    label: 'Nord',
    bg: '#2e3440',
    text: '#eceff4',
    border: '#4c566a',
    brand: '#88c0d0',
    accent: '#5e81ac',
    accentD: '#4c566a',
    viewport: '#242933',
    soft: '#3b4252',
  },
  dracula: {
    label: 'Dracula',
    bg: '#282a36',
    text: '#f8f8f2',
    border: '#44475a',
    brand: '#bd93f9',
    accent: '#bd93f9',
    accentD: '#6272a4',
    viewport: '#1e1f29',
    soft: '#44475a',
  },
  sakura: {
    label: 'Sakura',
    bg: '#fdf2f8',
    text: '#500724',
    border: '#f9a8d4',
    brand: '#db2777',
    accent: '#ec4899',
    accentD: '#be185d',
    viewport: '#fce7f3',
    soft: '#fbcfe8',
    light: true,
  },
  terminal: {
    label: 'Terminal',
    bg: '#0d1117',
    text: '#39ff14',
    border: '#238636',
    brand: '#39ff14',
    accent: '#238636',
    accentD: '#196127',
    viewport: '#010409',
    soft: '#161b22',
  },
  coral: {
    label: 'Coral',
    bg: '#0a2e2a',
    text: '#ffe8e4',
    border: '#2d6a5f',
    brand: '#ff9a8b',
    accent: '#ff6f61',
    accentD: '#c94c3d',
    viewport: '#061f1c',
    soft: '#134a44',
  },
  arctic: {
    label: 'Arctic',
    bg: '#f0f9ff',
    text: '#0c4a6e',
    border: '#7dd3fc',
    brand: '#0284c7',
    accent: '#0ea5e9',
    accentD: '#0369a1',
    viewport: '#bae6fd',
    soft: '#e0f2fe',
    light: true,
  },
  espresso: {
    label: 'Espresso',
    bg: '#292018',
    text: '#fef3c7',
    border: '#6b5344',
    brand: '#d4a574',
    accent: '#b45309',
    accentD: '#78350f',
    viewport: '#1a1208',
    soft: '#422006',
  },
  neon: {
    label: 'Neon',
    bg: '#0a0a0f',
    text: '#00ffff',
    border: '#ff00ff',
    brand: '#00ffff',
    accent: '#ff00ff',
    accentD: '#cc00cc',
    viewport: '#050508',
    soft: '#1a0a1a',
  },
  mint: {
    label: 'Mint',
    bg: '#ecfdf5',
    text: '#064e3b',
    border: '#6ee7b7',
    brand: '#059669',
    accent: '#10b981',
    accentD: '#047857',
    viewport: '#d1fae5',
    soft: '#a7f3d0',
    light: true,
  },
  grape: {
    label: 'Grape',
    bg: '#2a1038',
    text: '#f5e0ff',
    border: '#8b2fa8',
    brand: '#f0b0ff',
    accent: '#d946ef',
    accentD: '#a21caf',
    viewport: '#180820',
    soft: '#4a1860',
  },
  /* —— New palettes (distinct from originals) —— */
  volcano: {
    label: 'Volcano',
    bg: '#2a0808',
    text: '#ffe4d6',
    border: '#dc2626',
    brand: '#fcd34d',
    accent: '#ef4444',
    accentD: '#991b1b',
    viewport: '#1a0404',
    soft: '#4a1010',
  },
  aurora: {
    label: 'Aurora',
    bg: '#041812',
    text: '#a7f3d0',
    border: '#047857',
    brand: '#6ee7b7',
    accent: '#10b981',
    accentD: '#059669',
    viewport: '#020c08',
    soft: '#064e3b',
  },
  sandstorm: {
    label: 'Sandstorm',
    bg: '#3d2f1f',
    text: '#fef3c7',
    border: '#92704a',
    brand: '#fcd34d',
    accent: '#d97706',
    accentD: '#92400e',
    viewport: '#2a1f14',
    soft: '#57402a',
  },
  cyberpunk: {
    label: 'Cyberpunk',
    bg: '#12061f',
    text: '#fef08a',
    border: '#ff00ff',
    brand: '#00ffff',
    accent: '#ffff00',
    accentD: '#ccaa00',
    viewport: '#0a0312',
    soft: '#280838',
  },
  paper: {
    label: 'Paper',
    bg: '#f5f0e6',
    text: '#1e293b',
    border: '#c4b5a0',
    brand: '#1d4ed8',
    accent: '#2563eb',
    accentD: '#1e40af',
    viewport: '#e8e0d0',
    soft: '#faf6ee',
    light: true,
  },
  inkwell: {
    label: 'Inkwell',
    bg: '#0c0c0c',
    text: '#f5f0e6',
    border: '#404040',
    brand: '#fca5a5',
    accent: '#dc2626',
    accentD: '#991b1b',
    viewport: '#050505',
    soft: '#1f1f1f',
  },
  bubblegum: {
    label: 'Bubblegum',
    bg: '#fff0f8',
    text: '#9d174d',
    border: '#ff85c0',
    brand: '#ff1493',
    accent: '#ff69b4',
    accentD: '#db2777',
    viewport: '#ffd6ec',
    soft: '#fff5fa',
    light: true,
  },
  rust: {
    label: 'Rust',
    bg: '#4a2818',
    text: '#fde8d0',
    border: '#a05030',
    brand: '#e8a060',
    accent: '#b85c28',
    accentD: '#7a3c18',
    viewport: '#321a0c',
    soft: '#6a3820',
  },
  glacier: {
    label: 'Glacier',
    bg: '#d8ecf4',
    text: '#0c4a6e',
    border: '#7dd3fc',
    brand: '#0ea5e9',
    accent: '#0891b2',
    accentD: '#0e7490',
    viewport: '#b8dce8',
    soft: '#ecf8fc',
    light: true,
  },
  honeycomb: {
    label: 'Honeycomb',
    bg: '#1a1400',
    text: '#fff8dc',
    border: '#ffc107',
    brand: '#ffeb3b',
    accent: '#ff9800',
    accentD: '#e65100',
    viewport: '#100c00',
    soft: '#3a3008',
  },
  toxic: {
    label: 'Toxic',
    bg: '#141a06',
    text: '#d9f99d',
    border: '#65a30d',
    brand: '#ccff00',
    accent: '#a3e635',
    accentD: '#4d7c0f',
    viewport: '#0a0e02',
    soft: '#2a3808',
  },
  royal: {
    label: 'Royal',
    bg: '#0f172a',
    text: '#fef3c7',
    border: '#854d0e',
    brand: '#fcd34d',
    accent: '#ca8a04',
    accentD: '#713f12',
    viewport: '#080f1f',
    soft: '#1e293b',
  },
  synthwave: {
    label: 'Synthwave',
    bg: '#1a0a2e',
    text: '#fce7f3',
    border: '#c026d3',
    brand: '#f0abfc',
    accent: '#e879f9',
    accentD: '#a21caf',
    viewport: '#0d0518',
    soft: '#4a044e',
  },
  moss: {
    label: 'Moss',
    bg: '#3a4a32',
    text: '#ecfccb',
    border: '#5c6b4a',
    brand: '#d9e8a8',
    accent: '#84a55a',
    accentD: '#5c7340',
    viewport: '#2a3824',
    soft: '#4a5c40',
  },
  bloodmoon: {
    label: 'Blood Moon',
    bg: '#1a0510',
    text: '#ffd0d8',
    border: '#991b1b',
    brand: '#f0a0a8',
    accent: '#dc2626',
    accentD: '#7f1d1d',
    viewport: '#0f0208',
    soft: '#3a0a18',
  },
  copper: {
    label: 'Copper',
    bg: '#2a1c14',
    text: '#ffedd5',
    border: '#8b5a3c',
    brand: '#d4a574',
    accent: '#b87333',
    accentD: '#2dd4bf',
    viewport: '#1a1008',
    soft: '#4a3020',
  },
  gameboy: {
    label: 'Game Boy',
    bg: '#8b956d',
    text: '#0f380f',
    border: '#306230',
    brand: '#8bac0f',
    accent: '#306230',
    accentD: '#0f380f',
    viewport: '#9bbc0f',
    soft: '#c4cfa1',
    light: true,
  },
  pastel: {
    label: 'Pastel Dream',
    bg: '#fff5eb',
    text: '#9a3412',
    border: '#fdba74',
    brand: '#fda4af',
    accent: '#fb7185',
    accentD: '#e11d48',
    viewport: '#ffe8d6',
    soft: '#fffaf5',
    light: true,
  },
  storm: {
    label: 'Storm',
    bg: '#1c1c28',
    text: '#e2e8f0',
    border: '#4a4a6a',
    brand: '#fde047',
    accent: '#a78bfa',
    accentD: '#7c3aed',
    viewport: '#101018',
    soft: '#2a2a3e',
  },
  savanna: {
    label: 'Savanna',
    bg: '#8b7355',
    text: '#fff8e8',
    border: '#a08060',
    brand: '#f0d8a8',
    accent: '#c4a060',
    accentD: '#8b7040',
    viewport: '#6a5840',
    soft: '#b8a080',
  },
  deepsea: {
    label: 'Deep Sea',
    bg: '#020818',
    text: '#b8fff8',
    border: '#006680',
    brand: '#00ffcc',
    accent: '#00b8d4',
    accentD: '#0077a8',
    viewport: '#000408',
    soft: '#042838',
  },
  cherrywood: {
    label: 'Cherrywood',
    bg: '#3e2720',
    text: '#ffecb3',
    border: '#6d4c41',
    brand: '#d4a574',
    accent: '#8d6e63',
    accentD: '#5d4037',
    viewport: '#2a1a14',
    soft: '#5c4030',
  },
  monochrome: {
    label: 'Monochrome',
    bg: '#171717',
    text: '#fafafa',
    border: '#737373',
    brand: '#d4d4d4',
    accent: '#a3a3a3',
    accentD: '#525252',
    viewport: '#0a0a0a',
    soft: '#262626',
  },
  vapor: {
    label: 'Vapor',
    bg: '#2d1b4e',
    text: '#fbcfe8',
    border: '#ec4899',
    brand: '#67e8f9',
    accent: '#22d3ee',
    accentD: '#0891b2',
    viewport: '#1a0f2e',
    soft: '#4c1d95',
  },
  ember: {
    label: 'Ember',
    bg: '#1a0800',
    text: '#ffd6a8',
    border: '#ff6b00',
    brand: '#ffaa00',
    accent: '#ff4500',
    accentD: '#cc2200',
    viewport: '#0f0400',
    soft: '#3a1808',
  },
  matrix: {
    label: 'Matrix',
    bg: '#000000',
    text: '#00ff41',
    border: '#003b00',
    brand: '#39ff14',
    accent: '#008f11',
    accentD: '#003b00',
    viewport: '#000000',
    soft: '#0d1a0d',
  },
  dusk: {
    label: 'Dusk',
    bg: '#3d2060',
    text: '#ffe4cc',
    border: '#9a5cb8',
    brand: '#fb923c',
    accent: '#f97316',
    accentD: '#c2410c',
    viewport: '#281440',
    soft: '#5a3080',
  },
  citrus: {
    label: 'Citrus',
    bg: '#fffbeb',
    text: '#713f12',
    border: '#fbbf24',
    brand: '#f59e0b',
    accent: '#ea580c',
    accentD: '#c2410c',
    viewport: '#fef3c7',
    soft: '#fff7ed',
    light: true,
  },
  steel: {
    label: 'Steel',
    bg: '#2a3038',
    text: '#e5e7eb',
    border: '#6b7280',
    brand: '#9ca3af',
    accent: '#64748b',
    accentD: '#475569',
    viewport: '#1a1e24',
    soft: '#374151',
  },
  lagoon: {
    label: 'Lagoon',
    bg: '#004d52',
    text: '#ccfbf1',
    border: '#00a8b5',
    brand: '#7fffd4',
    accent: '#00ced1',
    accentD: '#008b8b',
    viewport: '#003638',
    soft: '#006d77',
  },
  plum: {
    label: 'Plum',
    bg: '#4a044e',
    text: '#fae8ff',
    border: '#c026d3',
    brand: '#f0abfc',
    accent: '#e879f9',
    accentD: '#a21caf',
    viewport: '#2e0230',
    soft: '#701a75',
  },
  parchment: {
    label: 'Parchment',
    bg: '#e8dcc8',
    text: '#44403c',
    border: '#a8a29e',
    brand: '#78716c',
    accent: '#57534e',
    accentD: '#44403c',
    viewport: '#d6c4a8',
    soft: '#f5efe6',
    light: true,
  },
  infrared: {
    label: 'Infrared',
    bg: '#0a0a0a',
    text: '#ff6b00',
    border: '#ff4500',
    brand: '#00ff88',
    accent: '#ff2200',
    accentD: '#cc1100',
    viewport: '#050505',
    soft: '#1a1008',
  },
  blueprint: {
    label: 'Blueprint',
    bg: '#1e3a5f',
    text: '#dbeafe',
    border: '#3b82f6',
    brand: '#93c5fd',
    accent: '#60a5fa',
    accentD: '#2563eb',
    viewport: '#0f2744',
    soft: '#1e40af',
  },
  matcha: {
    label: 'Matcha',
    bg: '#dce8c8',
    text: '#3d5c2e',
    border: '#8faa6e',
    brand: '#6b8e4e',
    accent: '#9ccc65',
    accentD: '#689f38',
    viewport: '#c5d9a8',
    soft: '#eef4e4',
    light: true,
  },
  solarized: {
    label: 'Solarized',
    bg: '#002b36',
    text: '#839496',
    border: '#073642',
    brand: '#2aa198',
    accent: '#268bd2',
    accentD: '#205a7a',
    viewport: '#001f27',
    soft: '#073642',
  },
  cotton: {
    label: 'Cotton Candy',
    bg: '#ffe0f0',
    text: '#6b21a8',
    border: '#f9a8d4',
    brand: '#bae6fd',
    accent: '#f472b6',
    accentD: '#db2777',
    viewport: '#ffd0e8',
    soft: '#fff0f8',
    light: true,
  },
  obsidian: {
    label: 'Obsidian Gold',
    bg: '#0c0c0e',
    text: '#e7e5e4',
    border: '#44403c',
    brand: '#fcd34d',
    accent: '#eab308',
    accentD: '#a16207',
    viewport: '#050506',
    soft: '#1c1917',
  },
  wetland: {
    label: 'Wetland',
    bg: '#243830',
    text: '#d8e8c8',
    border: '#5a6b4a',
    brand: '#a8c878',
    accent: '#84a55a',
    accentD: '#5c7340',
    viewport: '#182820',
    soft: '#3a4a38',
  },
  /* —— Game systems & consoles —— */
  ps1: {
    label: 'PlayStation (PS1)',
    bg: '#9a9aaa',
    text: '#0a0a18',
    border: '#5c5c6e',
    brand: '#2e4bd4',
    accent: '#1a2a8c',
    accentD: '#0f1858',
    viewport: '#6e6e82',
    soft: '#c4c4d4',
    light: true,
  },
  ps2: {
    label: 'PlayStation 2',
    bg: '#1a2848',
    text: '#d8e4f8',
    border: '#3d5a8c',
    brand: '#8cb4e8',
    accent: '#4a7ac4',
    accentD: '#2a4a8c',
    viewport: '#0e1830',
    soft: '#243860',
  },
  ps3: {
    label: 'PlayStation 3',
    bg: '#141414',
    text: '#e8e8e8',
    border: '#3a3a3a',
    brand: '#a8c8f0',
    accent: '#5a8fd4',
    accentD: '#2a5080',
    viewport: '#080808',
    soft: '#242424',
  },
  psp: {
    label: 'PSP',
    bg: '#1c1c22',
    text: '#e4e4ec',
    border: '#48485a',
    brand: '#b8b8d0',
    accent: '#6a6a88',
    accentD: '#3a3a50',
    viewport: '#101014',
    soft: '#2a2a34',
  },
  n64: {
    label: 'Nintendo 64',
    bg: '#2a2820',
    text: '#fef08a',
    border: '#6b5c2e',
    brand: '#fde047',
    accent: '#dc2626',
    accentD: '#991b1b',
    viewport: '#181610',
    soft: '#3d3828',
  },
  snes: {
    label: 'Super Nintendo',
    bg: '#6b5b7a',
    text: '#f3e8ff',
    border: '#4a3d58',
    brand: '#e9d5ff',
    accent: '#7c3aed',
    accentD: '#5b21b6',
    viewport: '#4a3d58',
    soft: '#8b7a9a',
  },
  nes: {
    label: 'NES',
    bg: '#a8a8a8',
    text: '#1a1a1a',
    border: '#686868',
    brand: '#e60012',
    accent: '#b8000e',
    accentD: '#8c000a',
    viewport: '#8c8c8c',
    soft: '#c8c8c8',
    light: true,
  },
  dreamcast: {
    label: 'Dreamcast',
    bg: '#f0f0f0',
    text: '#1a1a1a',
    border: '#c0c0c0',
    brand: '#ff6c00',
    accent: '#e85d00',
    accentD: '#b84800',
    viewport: '#e0e0e0',
    soft: '#fafafa',
    light: true,
  },
  xbox: {
    label: 'Xbox',
    bg: '#0a0a0a',
    text: '#d4f4d4',
    border: '#107c10',
    brand: '#6ee76e',
    accent: '#107c10',
    accentD: '#0a5c0a',
    viewport: '#050505',
    soft: '#142814',
  },
  xbox360: {
    label: 'Xbox 360',
    bg: '#1a1a1a',
    text: '#e8e8e8',
    border: '#4a4a4a',
    brand: '#9cdc6e',
    accent: '#6cb42a',
    accentD: '#4a8c1a',
    viewport: '#0e0e0e',
    soft: '#2a2a2a',
  },
  sega: {
    label: 'Sega',
    bg: '#0a1830',
    text: '#e0f0ff',
    border: '#0050a0',
    brand: '#4da6ff',
    accent: '#0050a0',
    accentD: '#003070',
    viewport: '#040c18',
    soft: '#102848',
  },
  genesis: {
    label: 'Sega Genesis',
    bg: '#0a0a0a',
    text: '#f5f5f5',
    border: '#404040',
    brand: '#e8e8e8',
    accent: '#dc2626',
    accentD: '#991b1b',
    viewport: '#000000',
    soft: '#1a1a1a',
  },
  saturn: {
    label: 'Sega Saturn',
    bg: '#282828',
    text: '#d4d4d4',
    border: '#505050',
    brand: '#f0d878',
    accent: '#c8a830',
    accentD: '#8a7020',
    viewport: '#181818',
    soft: '#383838',
  },
  gamecube: {
    label: 'GameCube',
    bg: '#4a3d8c',
    text: '#ede9fe',
    border: '#6d5bd0',
    brand: '#c4b5fd',
    accent: '#7c3aed',
    accentD: '#5b21b6',
    viewport: '#2e2460',
    soft: '#5b4aa8',
  },
  wii: {
    label: 'Wii',
    bg: '#f8f8f8',
    text: '#1e3a5f',
    border: '#b0c4d8',
    brand: '#009ac7',
    accent: '#0078a8',
    accentD: '#005880',
    viewport: '#e8eef4',
    soft: '#ffffff',
    light: true,
  },
  nds: {
    label: 'Nintendo DS',
    bg: '#c8d0d8',
    text: '#1a2838',
    border: '#8898a8',
    brand: '#38bdf8',
    accent: '#0ea5e9',
    accentD: '#0369a1',
    viewport: '#a8b4c0',
    soft: '#e0e8f0',
    light: true,
  },
  n3ds: {
    label: 'Nintendo 3DS',
    bg: '#1a1a1a',
    text: '#f5f5f5',
    border: '#c8102e',
    brand: '#f87171',
    accent: '#e60012',
    accentD: '#a80010',
    viewport: '#0a0a0a',
    soft: '#2a1418',
  },
  arcade: {
    label: 'Arcade Cabinet',
    bg: '#0a0610',
    text: '#fef08a',
    border: '#ec4899',
    brand: '#22d3ee',
    accent: '#f472b6',
    accentD: '#be185d',
    viewport: '#050308',
    soft: '#1a1028',
  },
  c64: {
    label: 'Commodore 64',
    bg: '#6c5eb5',
    text: '#b8c8e8',
    border: '#4a4088',
    brand: '#dce8f8',
    accent: '#7b9ad0',
    accentD: '#4a6a98',
    viewport: '#4a4088',
    soft: '#8a7ec8',
  },
  amiga: {
    label: 'Amiga Workbench',
    bg: '#0050a0',
    text: '#ffffff',
    border: '#003870',
    brand: '#ff8800',
    accent: '#ff6600',
    accentD: '#cc4400',
    viewport: '#003060',
    soft: '#0068c8',
  },
  atari: {
    label: 'Atari 2600',
    bg: '#3d2814',
    text: '#fde68a',
    border: '#8b5a2b',
    brand: '#fb923c',
    accent: '#ea580c',
    accentD: '#9a3412',
    viewport: '#2a1a0c',
    soft: '#5c3d20',
  },
  neogeo: {
    label: 'Neo Geo',
    bg: '#121212',
    text: '#fef3c7',
    border: '#854d0e',
    brand: '#fcd34d',
    accent: '#ca8a04',
    accentD: '#713f12',
    viewport: '#080808',
    soft: '#2a2410',
  },
  turbografx: {
    label: 'TurboGrafx-16',
    text: '#fce7f3',
    bg: '#1a1028',
    border: '#f97316',
    brand: '#fdba74',
    accent: '#ea580c',
    accentD: '#c2410c',
    viewport: '#0e0818',
    soft: '#2a1838',
  },
  switch: {
    label: 'Nintendo Switch',
    bg: '#2a2a2e',
    text: '#f5f5f5',
    border: '#e60012',
    brand: '#4ade80',
    accent: '#e60012',
    accentD: '#a80010',
    viewport: '#1a1a1e',
    soft: '#3a3a40',
  },
  /* —— Extra color themes —— */
  peacock: {
    label: 'Peacock',
    bg: '#0a2838',
    text: '#e0f8f0',
    border: '#0d9488',
    brand: '#fcd34d',
    accent: '#0d9488',
    accentD: '#047857',
    viewport: '#041820',
    soft: '#134e4a',
  },
  wine: {
    label: 'Wine Cellar',
    bg: '#1f0a10',
    text: '#f5e6d8',
    border: '#6b1838',
    brand: '#e8c8a0',
    accent: '#722f37',
    accentD: '#4a1820',
    viewport: '#140608',
    soft: '#3a1420',
  },
  electric: {
    label: 'Electric Violet',
    bg: '#1a0a3a',
    text: '#fef08a',
    border: '#7c3aed',
    brand: '#fde047',
    accent: '#a855f7',
    accentD: '#6d28d9',
    viewport: '#0f0520',
    soft: '#3b0764',
  },
  mango: {
    label: 'Mango Sunset',
    bg: '#ff6b35',
    text: '#1a0a00',
    border: '#ff4500',
    brand: '#ffd700',
    accent: '#ff9500',
    accentD: '#cc5500',
    viewport: '#e85a28',
    soft: '#ffb088',
    light: true,
  },
  petroleum: {
    label: 'Petroleum',
    bg: '#0c1218',
    text: '#c4b5fd',
    border: '#4c1d95',
    brand: '#a78bfa',
    accent: '#7c3aed',
    accentD: '#5b21b6',
    viewport: '#060810',
    soft: '#1a1830',
  },
  holo: {
    label: 'Holographic',
    bg: '#181028',
    text: '#f0e8ff',
    border: '#ff6ec7',
    brand: '#5eead4',
    accent: '#f472b6',
    accentD: '#c026d3',
    viewport: '#100818',
    soft: '#2a2048',
  },
  frost: {
    label: 'Frostbite',
    bg: '#eef2ff',
    text: '#312e81',
    border: '#a5b4fc',
    brand: '#c7d2fe',
    accent: '#6366f1',
    accentD: '#4338ca',
    viewport: '#e0e7ff',
    soft: '#f5f7ff',
    light: true,
  },
  terracotta: {
    label: 'Terracotta',
    bg: '#5c3830',
    text: '#fff0e8',
    border: '#c4724e',
    brand: '#e8a090',
    accent: '#c45c3e',
    accentD: '#8b4028',
    viewport: '#402820',
    soft: '#7a5048',
  },
  lilac: {
    label: 'Lilac Mist',
    bg: '#e8dff5',
    text: '#5b4b8a',
    border: '#b8a8d8',
    brand: '#9f8fc8',
    accent: '#8b7ec8',
    accentD: '#6a5a9a',
    viewport: '#d8cce8',
    soft: '#f3eef8',
    light: true,
  },
  jade: {
    label: 'Jade',
    bg: '#022c22',
    text: '#a7f3d0',
    border: '#00a884',
    brand: '#5eecc8',
    accent: '#00d9a3',
    accentD: '#008866',
    viewport: '#011a14',
    soft: '#034d3d',
  },
  crimson: {
    label: 'Crimson Night',
    bg: '#1a0008',
    text: '#ffc0cb',
    border: '#ff1744',
    brand: '#ff6090',
    accent: '#ff1744',
    accentD: '#c40030',
    viewport: '#100004',
    soft: '#3a0018',
  },
  cobalt: {
    label: 'Cobalt',
    bg: '#002fa7',
    text: '#e8f0ff',
    border: '#1e4fd8',
    brand: '#80b0ff',
    accent: '#0047ab',
    accentD: '#002d70',
    viewport: '#001e70',
    soft: '#0038a0',
  },
  saffron: {
    label: 'Saffron',
    bg: '#4a1c0a',
    text: '#fff8e0',
    border: '#c2410c',
    brand: '#f4c430',
    accent: '#e8b923',
    accentD: '#b8860b',
    viewport: '#301008',
    soft: '#6a3018',
  },
  mintchip: {
    label: 'Mint Chip',
    bg: '#2d1f14',
    text: '#c8f0d8',
    border: '#5c4030',
    brand: '#98ff98',
    accent: '#7dffb3',
    accentD: '#4ade80',
    viewport: '#1a1208',
    soft: '#4a3828',
  },
  blackberry: {
    label: 'Blackberry',
    bg: '#120818',
    text: '#e8d0f0',
    border: '#9333ea',
    brand: '#c084fc',
    accent: '#9333ea',
    accentD: '#6b21a8',
    viewport: '#0a0408',
    soft: '#2a1040',
  },
};

function parseHex(hex) {
  const h = String(hex).replace('#', '');
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r, g, b) {
  return `#${[r, g, b]
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mix(a, b, t) {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Default material swatch per theme (Material panel + new face paint). */
/** @param {ThemeDef} t */
function materialDefault(t) {
  return mix(t.accent, t.brand, 0.35);
}

/** Original Classic viewport grid (pre-theme generator). */
const CLASSIC_VIEWPORT_GRID = {
  gridCell: '#7d8a9a',
  gridSection: '#a3b1c2',
  gridOrigin: '#dce4ee',
};

/** @param {ThemeDef} t @param {string} [themeId] */
function vp3d(t, themeId) {
  const light = !!t.light;
  const vp = t.viewport;
  /** @type {Record<string, string>} */
  let v;
  if (light) {
    v = {
      vpBg: vp,
      gridCell: mix(vp, '#000000', 0.14),
      gridSection: mix(vp, '#000000', 0.24),
      gridOrigin: mix(vp, t.accent, 0.5),
      axisPrimary: mix(vp, '#000000', 0.38),
      axisAccent: t.accent,
      axisX: mix(t.accent, '#d94848', 0.42),
      axisY: mix(t.accent, '#3da83d', 0.42),
      axisZ: mix(t.accent, '#3d7ad9', 0.42),
      vertex: t.accent,
      vertexSelected: t.accentD,
      vertexHover: mix(t.brand, t.accent, 0.5),
      vertexOutline: mix(vp, '#000000', 0.55),
      edge: mix(t.accent, vp, 0.45),
      edgeHover: t.brand,
      edgeSelected: t.accentD,
      faceFill: t.accent,
      faceHoverFill: t.brand,
      faceOutline: mix(t.accent, '#ffffff', 0.35),
      faceHoverOutline: mix(t.brand, '#ffffff', 0.55),
      knifeValid: mix(t.brand, '#ffffff', 0.2),
      knifeInvalid: '#ef4444',
    };
  } else {
    v = {
    vpBg: vp,
    gridCell: mix(vp, t.brand, 0.3),
    gridSection: mix(vp, t.brand, 0.44),
    gridOrigin: mix(vp, t.brand, 0.62),
    axisPrimary: mix(vp, t.brand, 0.58),
    axisAccent: t.brand,
    axisX: mix(t.accent, '#ff6b6b', 0.42),
    axisY: mix(t.accent, '#6bff8a', 0.42),
    axisZ: mix(t.accent, '#6babff', 0.42),
    vertex: mix(t.brand, '#ffffff', 0.12),
    vertexSelected: t.accent,
    vertexHover: mix(t.brand, '#ffffff', 0.42),
    vertexOutline: mix(vp, '#000000', 0.78),
    edge: mix(t.accent, vp, 0.55),
    edgeHover: mix(t.brand, '#ffffff', 0.22),
    edgeSelected: t.accent,
    faceFill: t.accent,
    faceHoverFill: t.brand,
    faceOutline: mix(t.brand, '#ffffff', 0.38),
    faceHoverOutline: mix(t.brand, '#ffffff', 0.58),
    knifeValid: mix(t.brand, '#ffffff', 0.38),
    knifeInvalid: '#ff6b6b',
    };
  }
  if (themeId === 'classic') {
    v = { ...v, ...CLASSIC_VIEWPORT_GRID };
  }
  return v;
}

/** @param {ThemeDef} t */
function ui(t) {
  const light = !!t.light;
  if (light) {
    return {
      heading: '#1f2937',
      muted: '#64748b',
      subtle: '#94a3b8',
      toolText: t.text,
      toolMuted: '#64748b',
      toolKbdBg: '#ffffff',
      toolKbdText: '#334155',
      toolKbdBorder: t.border,
      toolHoverBg: '#ffffff',
      toolHoverBorder: t.accent,
      accentSoft: t.soft,
      accentOn: '#ffffff',
      sceneMeta: t.accentD,
      dialogMuted: '#475569',
      surface: '#ffffff',
      surfaceHover: '#f8fafc',
      panel: t.soft,
      dropdown: '#ffffff',
    };
  }
  return {
    heading: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#cbd5e1',
    toolText: t.text,
    toolMuted: '#cbd5e1',
    toolKbdBg: t.soft,
    toolKbdText: '#e2e8f0',
    toolKbdBorder: t.border,
    toolHoverBg: t.soft,
    toolHoverBorder: t.brand,
    accentSoft: t.soft,
    accentOn: '#ffffff',
    sceneMeta: t.brand,
    dialogMuted: '#cbd5e1',
    surface: t.soft,
    surfaceHover: t.soft,
    panel: t.bg,
    dropdown: t.soft,
  };
}

/** @param {string} id @param {ThemeDef} t */
function themeBlock(id, t) {
  const u = ui(t);
  const v = vp3d(t, id);
  const light = !!t.light;
  const surfGrad = light
    ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
    : `linear-gradient(180deg, ${t.soft} 0%, ${t.bg} 100%)`;
  const menuGrad = light
    ? `linear-gradient(180deg, ${t.soft} 0%, #d6d2c2 100%)`
    : `linear-gradient(180deg, ${t.soft} 0%, ${t.bg} 100%)`;
  const panelGrad = light
    ? `linear-gradient(180deg, #efecdd 0%, ${t.soft} 100%)`
    : `linear-gradient(180deg, ${t.soft} 0%, ${t.bg} 100%)`;

  const selector =
    id === 'classic'
      ? `.khedApp,\nhtml[data-theme='classic'] .khedApp,\n.khedApp[data-theme='classic']`
      : `.khedApp[data-theme='${id}'],\nhtml[data-theme='${id}'] .khedApp`;

  return `${selector} {
  --t-font: Tahoma, 'Segoe UI', Verdana, sans-serif;
  --t-body-bg: ${t.bg};
  --t-body-text: ${t.text};
  --t-app-border: ${t.border};
  --t-menu-bg: ${menuGrad};
  --t-menu-border: ${t.border};
  --t-brand: ${t.brand};
  --t-brand-border: ${light ? '#a6a296' : t.border};
  --t-menu-hover: ${t.accent};
  --t-menu-hover-text: #ffffff;
  --t-dropdown-bg: ${u.dropdown};
  --t-dropdown-border: ${t.border};
  --t-dropdown-text: ${u.toolText};
  --t-panel-bg: ${u.panel};
  --t-panel-grad: ${panelGrad};
  --t-border: ${t.border};
  --t-border-light: ${light ? '#a6a296' : t.border};
  --t-border-muted: ${light ? '#c8c4b4' : t.border};
  --t-heading: ${u.heading};
  --t-muted: ${u.muted};
  --t-subtle: ${u.subtle};
  --t-link: ${light ? t.brand : t.brand};
  --t-accent: ${t.accent};
  --t-accent-dark: ${t.accentD};
  --t-accent-soft: ${u.accentSoft};
  --t-accent-on: ${u.accentOn};
  --t-accent-grad: linear-gradient(180deg, ${t.brand} 0%, ${t.accent} 100%);
  --t-surface: ${u.surface};
  --t-surface-grad: ${surfGrad};
  --t-surface-hover: ${u.surfaceHover};
  --t-surface-alt: ${t.soft};
  --t-input-border: ${t.border};
  --t-input-text: ${u.toolText};
  --t-viewport-bg: ${v.vpBg};
  --t-viewport-border: ${light ? '#4f5f72' : t.border};
  --t-vp-bg: ${v.vpBg};
  --t-vp-grid-cell: ${v.gridCell};
  --t-vp-grid-section: ${v.gridSection};
  --t-vp-grid-origin: ${v.gridOrigin};
  --t-vp-axis-primary: ${v.axisPrimary};
  --t-vp-axis-accent: ${v.axisAccent};
  --t-vp-axis-x: ${v.axisX};
  --t-vp-axis-y: ${v.axisY};
  --t-vp-axis-z: ${v.axisZ};
  --t-vp-vertex: ${v.vertex};
  --t-vp-vertex-selected: ${v.vertexSelected};
  --t-vp-vertex-hover: ${v.vertexHover};
  --t-vp-vertex-outline: ${v.vertexOutline};
  --t-vp-edge: ${v.edge};
  --t-vp-edge-hover: ${v.edgeHover};
  --t-vp-edge-selected: ${v.edgeSelected};
  --t-vp-face-fill: ${v.faceFill};
  --t-vp-face-hover-fill: ${v.faceHoverFill};
  --t-vp-face-outline: ${v.faceOutline};
  --t-vp-face-hover-outline: ${v.faceHoverOutline};
  --t-vp-knife-valid: ${v.knifeValid};
  --t-vp-knife-invalid: ${v.knifeInvalid};
  --t-material-default: ${materialDefault(t)};
  --t-split-bg: linear-gradient(180deg, ${t.border} 0%, ${t.accentD} 100%);
  --t-split-hover: ${t.accent};
  --t-scroll-track: ${u.panel};
  --t-scroll-border: ${t.border};
  --t-scroll-thumb: linear-gradient(180deg, ${t.accent} 0%, ${t.accentD} 100%);
  --t-scroll-thumb-hover: linear-gradient(180deg, ${t.brand} 0%, ${t.accent} 100%);
  --t-scene-meta: ${u.sceneMeta};
  --t-window-bg: ${light ? '#aebfbd' : t.soft};
  --t-window-border: ${light ? '#4f5d66' : t.border};
  --t-titlebar-bg: ${light ? '#f2f1ec' : u.panel};
  --t-titlebar-text: ${u.toolText};
  --t-toolbar-bg: ${light ? '#eeeeee' : u.panel};
  --t-pixel-bg: ${light ? '#9fb0b3' : t.soft};
  --t-pixel-checker-a: ${light ? '#d8d8d8' : mix(t.soft, '#ffffff', 0.08)};
  --t-pixel-checker-b: ${light ? '#a7a7a7' : mix(t.bg, '#000000', 0.22)};
  --t-dialog-bg: ${u.surface};
  --t-dialog-border: ${light ? '#4f5d66' : t.border};
  --t-dialog-backdrop: rgba(0, 0, 0, ${light ? 0.45 : 0.65});
  --t-dialog-text: ${u.toolText};
  --t-dialog-muted: ${u.dialogMuted};
  --t-danger-bg: ${light ? '#f8e8e8' : '#450a0a'};
  --t-danger-border: #ef4444;
  --t-danger-text: ${light ? '#7f1d1d' : '#fecaca'};
  --t-danger-hover: ${light ? '#fecaca' : '#7f1d1d'};
  --t-warning-bg: ${light ? mix(t.accent, '#ffffff', 0.88) : mix(t.accent, '#000000', 0.75)};
  --t-warning-solid: ${t.accent};
  --t-tool-active-bg: ${light ? '#cfe9ff' : t.soft};
  --t-tool-active-border: ${t.accent};
  --t-tool-text: ${u.toolText};
  --t-tool-muted: ${u.toolMuted};
  --t-tool-kbd-bg: ${u.toolKbdBg};
  --t-tool-kbd-text: ${u.toolKbdText};
  --t-tool-kbd-border: ${u.toolKbdBorder};
  --t-tool-hover-bg: ${u.toolHoverBg};
  --t-tool-hover-border: ${u.toolHoverBorder};
  --t-tool-active-kbd-bg: rgba(255, 255, 255, 0.18);
  --t-tool-active-kbd-text: #ffffff;
  --t-tool-active-kbd-border: rgba(255, 255, 255, 0.28);
  --t-icon: ${u.toolText};
  --t-layer-bg: ${light ? '#f8f7ef' : u.panel};
  --t-layer-active: ${light ? '#dcecff' : t.soft};
  --t-status-bg: ${u.panel};
  --t-status-border: ${t.border};
  --t-toggle-grad: linear-gradient(180deg, ${u.surface} 0%, ${u.panel} 100%);
  --t-toggle-text: ${u.toolText};
  --t-toggle-border: ${t.border};
  --t-toggle-active: linear-gradient(180deg, ${t.brand} 0%, ${t.accent} 100%);
  --t-poly-dash: ${t.accent};
  --t-badge-bg: ${t.soft};
  --t-badge-text: ${u.toolText};
  --t-badge-border: ${t.border};
  --t-help-bg: ${u.surface};
  --t-help-border: ${t.border};
  --t-close: #ef4444;
  --t-minimize: ${light ? '#d9d9d9' : t.border};
  --t-scene-item-text: ${u.toolText};
  --t-scene-item-meta: ${u.toolMuted};
  --t-scene-item-hover: ${u.surfaceHover};
}

html[data-theme='${id}']${id === 'classic' ? ",\nhtml:not([data-theme])" : ''} {
  background: ${t.bg};
  color: ${t.text};
}
`;
}

const order = [
  'classic',
  'midnight',
  'charcoal',
  'forest',
  'sunset',
  'ocean',
  'lavender',
  'rose',
  'slate',
  'amber',
  'nord',
  'dracula',
  'sakura',
  'terminal',
  'coral',
  'arctic',
  'espresso',
  'neon',
  'mint',
  'grape',
  // New palettes
  'obsidian',
  'volcano',
  'aurora',
  'sandstorm',
  'cyberpunk',
  'paper',
  'inkwell',
  'bubblegum',
  'rust',
  'glacier',
  'honeycomb',
  'toxic',
  'royal',
  'synthwave',
  'moss',
  'bloodmoon',
  'copper',
  'gameboy',
  'pastel',
  'storm',
  'savanna',
  'deepsea',
  'cherrywood',
  'monochrome',
  'vapor',
  'ember',
  'matrix',
  'dusk',
  'citrus',
  'steel',
  'lagoon',
  'plum',
  'parchment',
  'infrared',
  'blueprint',
  'matcha',
  'solarized',
  'cotton',
  'wetland',
  // Game systems
  'ps1',
  'ps2',
  'ps3',
  'psp',
  'n64',
  'snes',
  'nes',
  'dreamcast',
  'xbox',
  'xbox360',
  'sega',
  'genesis',
  'saturn',
  'gamecube',
  'wii',
  'nds',
  'n3ds',
  'arcade',
  'c64',
  'amiga',
  'atari',
  'neogeo',
  'turbografx',
  'switch',
  // Extra colors
  'peacock',
  'wine',
  'electric',
  'mango',
  'petroleum',
  'holo',
  'frost',
  'terracotta',
  'lilac',
  'jade',
  'crimson',
  'cobalt',
  'saffron',
  'mintchip',
  'blackberry',
];

for (const id of order) {
  if (!PALETTES[id]) throw new Error(`Missing palette: ${id}`);
}

const css = `/* Auto-generated theme tokens — run: node scripts/build-themes.mjs */

${order.map((id) => themeBlock(id, PALETTES[id])).join('\n')}
`;

const themesJs = `/** Auto-generated — run: node scripts/build-themes.mjs */
/** @typedef {{ id: string, label: string, preview: [string, string] }} ThemeOption */

/** @type {ThemeOption[]} */
export const THEMES = [
${order
  .map((id) => {
    const t = PALETTES[id];
    const label = t.label.replace(/'/g, "\\'");
    return `  { id: '${id}', label: '${label}', preview: ['${t.soft}', '${t.accent}'] },`;
  })
  .join('\n')}
];

export const DEFAULT_THEME_ID = 'classic';

const STORAGE_KEY = 'khed-theme';

export function readStoredThemeId() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function persistThemeId(themeId) {
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function themeLabel(themeId) {
  return THEMES.find((t) => t.id === themeId)?.label ?? 'Classic';
}
`;

const stylesDir = path.join('src', 'styles');
const libDir = path.join('src', 'lib');
fs.writeFileSync(path.join(stylesDir, 'themes.css'), css);
fs.writeFileSync(path.join(libDir, 'themes.js'), themesJs);
console.log(`Wrote ${order.length} themes to src/styles/themes.css and src/lib/themes.js`);
