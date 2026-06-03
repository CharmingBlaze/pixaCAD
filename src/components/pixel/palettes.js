export const PRESET_COLORS = [
  '#000000', '#ffffff', '#7c7c7c', '#c8c8c8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436',
  '#29adff', '#83769c', '#ff77a8', '#ab5236',
  '#5f574f', '#c2c3c7', '#008751', '#1d2b53',
];

export const PALETTES = {
  pico: { label: 'PICO-8', colors: PRESET_COLORS },
  endesga32: {
    label: 'Endesga 32',
    colors: [
      '#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
      '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
      '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
      '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569',
    ],
  },
  lospec500: {
    label: 'LoSpec 500',
    colors: [
      '#10121c', '#2c1e31', '#6b2643', '#ac2847', '#ec273f', '#94493a', '#de5d3a', '#e98537',
      '#f3a833', '#4d3533', '#6e4c30', '#a26d3f', '#ce9248', '#dab163', '#e8d282', '#f7f3b7',
      '#1e4044', '#006554', '#26854c', '#5ab552', '#9de64e', '#008b8b', '#62a477', '#a6cb96',
      '#d3eed3', '#3e3b65', '#3859b3', '#3388de', '#36c5f4', '#6dead6', '#5e5b8c', '#8c78a5',
    ],
  },
  material: {
    label: 'Material',
    colors: [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
      '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
      '#795548', '#9e9e9e', '#607d8b', '#ffffff', '#212121', '#f5f5f5', '#bdbdbd', '#757575',
    ],
  },
  gameboy: { label: 'Game Boy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  gameboyPocket: { label: 'Game Boy Pocket', colors: ['#1f1f1f', '#5a5a5a', '#a1a1a1', '#e0e0e0'] },
  nes: {
    label: 'NES Basic',
    colors: [
      '#000000', '#fcfcfc', '#f8f8f8', '#bcbcbc', '#7c7c7c', '#a4e4fc', '#3cbcfc', '#0078f8',
      '#0000fc', '#b8b8f8', '#6888fc', '#0058f8', '#0000bc', '#d8b8f8', '#9878f8', '#6844fc',
      '#4428bc', '#f8b8f8', '#f878f8', '#d800cc', '#940084', '#f8a4c0', '#f85898', '#e40058',
      '#a80020', '#f0d0b0', '#f87858', '#f83800', '#a81000', '#fce0a8', '#fca044', '#e45c10',
      '#881400', '#f8d878', '#f8b800', '#ac7c00', '#503000', '#d8f878', '#b8f818', '#00b800',
      '#007800', '#b8f8b8', '#58d854', '#00a800', '#006800', '#b8f8d8', '#58f898', '#00a844',
    ],
  },
  c64: {
    label: 'Commodore 64',
    colors: [
      '#000000', '#ffffff', '#883932', '#67b6bd', '#8b3f96', '#55a049', '#40318d', '#bfce72',
      '#8b5429', '#574200', '#b86962', '#505050', '#787878', '#94e089', '#7869c4', '#9f9f9f',
    ],
  },
  sweetie16: {
    label: 'Sweetie 16',
    colors: [
      '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
      '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
    ],
  },
  dawnbringer16: {
    label: 'DawnBringer 16',
    colors: [
      '#140c1c', '#442434', '#30346d', '#4e4a4e', '#854c30', '#346524', '#d04648', '#757161',
      '#597dce', '#d27d2c', '#8595a1', '#6daa2c', '#d2aa99', '#6dc2ca', '#dad45e', '#deeed6',
    ],
  },
  dawnbringer32: {
    label: 'DawnBringer 32',
    colors: [
      '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
      '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
      '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
      '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30',
    ],
  },
  arne16: {
    label: 'Arne 16',
    colors: [
      '#000000', '#1b2632', '#493c2b', '#5f574f', '#a46422', '#eb8931', '#f7e26b', '#2f484e',
      '#44891a', '#a3ce27', '#1b5a82', '#0099db', '#4d65b4', '#9d9d9d', '#ffffff', '#be2633',
    ],
  },
  appleII: {
    label: 'Apple II',
    colors: [
      '#000000', '#722640', '#40337f', '#e434fe', '#0e5940', '#808080', '#1b9afe', '#bfb3ff',
      '#404c00', '#e46501', '#808080', '#f1a6bf', '#1bc234', '#bfbf80', '#8ddafe', '#ffffff',
    ],
  },
  zxSpectrum: {
    label: 'ZX Spectrum',
    colors: [
      '#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700', '#d7d7d7',
      '#000000', '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00', '#ffffff',
    ],
  },
  msx: {
    label: 'MSX',
    colors: [
      '#000000', '#010101', '#3eb849', '#74d07d', '#5955e0', '#8076f1', '#b95e51', '#65dbef',
      '#db6559', '#ff897d', '#ccc35e', '#ded087', '#3aa241', '#b766b5', '#cccccc', '#ffffff',
    ],
  },
  ega: {
    label: 'EGA',
    colors: [
      '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
      '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
    ],
  },
  fantasy24: {
    label: 'Fantasy 24',
    colors: [
      '#0f0f1b', '#25283d', '#3e415f', '#5a5d7e', '#8d8fa3', '#f6f6f6', '#ffbf81', '#e67e55',
      '#b85b56', '#8b3f5d', '#512b52', '#2b1f3a', '#f7e26b', '#a6d96a', '#4bb36f', '#237a57',
      '#154f55', '#2c6c8f', '#3aa7d8', '#78dff2', '#b86fbf', '#e68acb', '#ffb3c8', '#ff6b8a',
    ],
  },
  paper8: { label: 'Paper 8', colors: ['#2b2b2b', '#f5f0dc', '#b8a88a', '#7a6a53', '#3f5d4a', '#7fa35c', '#c9b458', '#b85c38'] },
  autumn: {
    label: 'Autumn',
    colors: [
      '#1f130f', '#3b1f16', '#61291c', '#8f3f24', '#bf6f32', '#e39f45', '#f1cf6b', '#fff4a3',
      '#2b2118', '#55402a', '#82613c', '#ad8350', '#d4ad6a', '#713f2a', '#a7472f', '#d6542f',
    ],
  },
  forest: {
    label: 'Forest',
    colors: [
      '#07130d', '#12291c', '#1d4429', '#2e633b', '#46824a', '#69a75a', '#9acb72', '#d3e89a',
      '#102c36', '#1d4e5f', '#2f7580', '#58a08f', '#8bc2a0', '#4f3829', '#795840', '#b68a5b',
    ],
  },
  ocean: {
    label: 'Ocean',
    colors: [
      '#07111f', '#0c2440', '#123a63', '#18537f', '#1f78a5', '#2ba7cc', '#5bd7e8', '#b8f3ff',
      '#0a3f4a', '#116b6d', '#1a9a92', '#53c9b5', '#9de6d4', '#174070', '#3c63a8', '#8aa8e8',
    ],
  },
  desert: {
    label: 'Desert',
    colors: [
      '#211510', '#4a2a1d', '#75452c', '#9c663d', '#c68a4a', '#e3b75f', '#f7dc8b', '#fff1bd',
      '#6f4a31', '#9d7150', '#c99b70', '#e4c198', '#846b43', '#b49a5d', '#d8c878', '#f4e7a0',
    ],
  },
  ice: {
    label: 'Ice',
    colors: [
      '#101820', '#1e3440', '#2f5266', '#4b748c', '#6d9ab2', '#9dc4d8', '#d5eef7', '#ffffff',
      '#16243a', '#273f66', '#4269a0', '#6b99d1', '#a7cdf2', '#d5e8ff', '#c5d4df', '#8fa7b8',
    ],
  },
  lava: {
    label: 'Lava',
    colors: [
      '#120707', '#2a0d0d', '#4a1111', '#751c16', '#a62d1f', '#d94b29', '#ff7a2e', '#ffb347',
      '#ffe66d', '#fff7bd', '#3b1710', '#6b2d1c', '#944728', '#c66b32', '#f79c3d', '#ffd166',
    ],
  },
  neon: {
    label: 'Neon',
    colors: [
      '#050014', '#12002f', '#270052', '#3f0073', '#00f5ff', '#00ff85', '#faff00', '#ff8a00',
      '#ff005c', '#d000ff', '#7a00ff', '#ffffff', '#202040', '#3050ff', '#00b3ff', '#ff3df2',
    ],
  },
  pastel: {
    label: 'Pastel',
    colors: [
      '#2b2d42', '#8d99ae', '#edf2f4', '#ffb3c1', '#ffc2d1', '#ffe5ec', '#cdb4db', '#bde0fe',
      '#a2d2ff', '#caffbf', '#fdffb6', '#ffd6a5', '#ffadad', '#d0f4de', '#e4c1f9', '#fcf6bd',
    ],
  },
  muted: {
    label: 'Muted',
    colors: [
      '#1f2421', '#3c4741', '#58685f', '#7a8b80', '#a7b5aa', '#d8ded9', '#6f4e37', '#936f4d',
      '#b69062', '#d3b37a', '#4d5d53', '#6f7f63', '#9aa675', '#45535f', '#687b8d', '#97a8b8',
    ],
  },
  uiDark: {
    label: 'UI Dark',
    colors: [
      '#09090b', '#18181b', '#27272a', '#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#e4e4e7',
      '#f4f4f5', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#a855f7',
    ],
  },
  skin: {
    label: 'Skin Tones',
    colors: [
      '#2b160f', '#3d2116', '#59301f', '#75452c', '#8f563b', '#a96d4a', '#c2855c', '#d8a06d',
      '#e4b784', '#f1cd9a', '#f6d7b0', '#fae3c6', '#fff0dc', '#6b3f2a', '#9c5f3e', '#c98255',
    ],
  },
  metals: {
    label: 'Metals',
    colors: [
      '#111111', '#252525', '#3f3f3f', '#5c5c5c', '#858585', '#b8b8b8', '#e6e6e6', '#ffffff',
      '#2b261b', '#5c4b28', '#9a7b32', '#d6ae45', '#ffe08a', '#23313d', '#49657a', '#9bb3c4',
    ],
  },
  clay: {
    label: 'Clay',
    colors: [
      '#211819', '#3a2420', '#563329', '#764735', '#9a6044', '#bd7d58', '#d99e72', '#f0c092',
      '#5b3431', '#83453e', '#ad5b4e', '#d77761', '#e9a17f', '#704f3b', '#9b7754', '#c9a878',
    ],
  },
  candy: {
    label: 'Candy',
    colors: [
      '#2a103d', '#6b1e78', '#b22a8f', '#ff5ca8', '#ffa6d1', '#fff0f8', '#2d1b69', '#5d55d9',
      '#56b8ff', '#b5ecff', '#19d3a2', '#a8ff78', '#fff36b', '#ffb34f', '#ff6b4a', '#ffffff',
    ],
  },
  twilight: {
    label: 'Twilight',
    colors: [
      '#0b1026', '#161b3f', '#24295c', '#393b7a', '#5a4d91', '#8b64a8', '#c080b8', '#f0a6c2',
      '#f7c48b', '#ffe082', '#2d4263', '#3f668c', '#5d92b5', '#8fc4d9', '#d6f2f5', '#ffffff',
    ],
  },
  vaporwave: {
    label: 'Vaporwave',
    colors: [
      '#120458', '#291073', '#4f1b9f', '#7a2bc4', '#b03ad9', '#f047d9', '#ff6ad5', '#ffb8e8',
      '#00b8ff', '#00e5ff', '#6fffe9', '#f8f7ff', '#fffb85', '#ff9f1c', '#ff3864', '#2de2e6',
    ],
  },
  terminal: {
    label: 'Terminal',
    colors: [
      '#000000', '#1e1e1e', '#303030', '#5f5f5f', '#875f00', '#d75f00', '#ffd75f', '#ffffaf',
      '#005f00', '#00af00', '#87ff5f', '#d7ffd7', '#005f87', '#0087d7', '#5fd7ff', '#ffffff',
    ],
  },
  grayscale: {
    label: 'Grayscale',
    colors: ['#000000', '#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777', '#888888', '#999999', '#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#eeeeee', '#ffffff'],
  },
};
