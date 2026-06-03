import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore.js';
import { PALETTES, PRESET_COLORS } from '../pixel/palettes.js';

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  return ok;
}

/**
 * Color picker for mesh face colors (face mode paints selection; other modes paint whole object).
 * @param {{ showPalette?: boolean, showHint?: boolean }} props
 */
export function FaceColorControls({ showPalette = true, showHint = false }) {
  const paintColor = useEditorStore((s) => s.paintColor);
  const editMode = useEditorStore((s) => s.editMode);
  const selectedFaces = useEditorStore((s) => s.selectedFaces);
  const setPaintColor = useEditorStore((s) => s.setPaintColor);
  const setObjectMaterialColor = useEditorStore((s) => s.setObjectMaterialColor);
  const clearMaterialColor = useEditorStore((s) => s.clearMaterialColor);
  const paintAllFaces = useEditorStore((s) => s.paintAllFaces);
  const [paletteName, setPaletteName] = useState('pico');
  const [customColors, setCustomColors] = useState([]);
  const [recentColors, setRecentColors] = useState(PRESET_COLORS.slice(0, 8));
  const [hexCopied, setHexCopied] = useState(false);
  const setStatus = useEditorStore((s) => s.setStatus);
  const paletteColors = [...(PALETTES[paletteName]?.colors ?? PRESET_COLORS), ...customColors];

  const faceMode = editMode === 'face';
  const hasFaceSelection = faceMode && selectedFaces.length > 0;

  const applyColor = (hex) => {
    if (faceMode) {
      setPaintColor(hex);
    } else {
      setObjectMaterialColor(hex);
    }
    setRecentColors((current) => [hex, ...current.filter((c) => c !== hex)].slice(0, 12));
  };

  const hexDisplay = paintColor.toUpperCase();

  const copyHex = async () => {
    try {
      const ok = await copyTextToClipboard(hexDisplay);
      if (!ok) throw new Error('copy failed');
      setHexCopied(true);
      setStatus(`Copied ${hexDisplay}`);
      window.setTimeout(() => setHexCopied(false), 1200);
    } catch {
      setStatus('Could not copy color code');
    }
  };

  return (
    <>
      <div className={`materialColorRow${faceMode ? ' materialColorRowHexOnly' : ''}`}>
        {!faceMode && <span className="materialColorLabel">Object color</span>}
        <button
          type="button"
          className="materialColorHex"
          data-testid="face-color-hex-copy"
          title="Copy hex to clipboard"
          aria-label={`Copy color ${hexDisplay} to clipboard`}
          onClick={() => {
            void copyHex();
          }}
        >
          {hexCopied ? 'Copied' : hexDisplay}
        </button>
      </div>
      <label className="colorPick" title={`Pick ${faceMode ? 'face' : 'object'} color`}>
        <input
          type="color"
          data-testid="face-color-input"
          value={paintColor}
          aria-label={faceMode ? 'Face color' : 'Object color'}
          onChange={(e) => applyColor(e.target.value)}
        />
      </label>
      {showHint && faceMode && (
        <p className="panelHint">
          {hasFaceSelection
            ? 'Colors apply to selected faces immediately.'
            : 'Select one or more faces, then pick a color (or Shift+F).'}
        </p>
      )}
      {faceMode && (
        <div className="materialPaletteActions">
          <button type="button" className="materialActionBtn" data-testid="paint-all-faces" onClick={() => paintAllFaces()}>
            Paint all faces
          </button>
        </div>
      )}
      <div className="materialPaletteActions">
        <button type="button" className="materialActionBtn" onClick={() => clearMaterialColor()}>
          No color
        </button>
      </div>
      {showPalette && (
        <>
          <select
            className="materialPaletteSelect"
            value={paletteName}
            onChange={(e) => setPaletteName(e.target.value)}
          >
            {Object.entries(PALETTES).map(([id, palette]) => (
              <option key={id} value={id}>
                {palette.label}
              </option>
            ))}
          </select>
          <div className="materialSwatchGrid" role="group" aria-label="Face color palette">
            {paletteColors.map((hex, index) => (
              <button
                key={`${hex}-${index}`}
                type="button"
                className={paintColor.toLowerCase() === hex ? 'materialSwatch active' : 'materialSwatch'}
                title={hex}
                aria-label={`Set color ${hex}`}
                style={{ '--swatch': hex }}
                onClick={() => applyColor(hex)}
              />
            ))}
          </div>
          <div className="materialPaletteActions">
            <button
              type="button"
              onClick={() =>
                setCustomColors((current) =>
                  [paintColor, ...current.filter((c) => c !== paintColor)].slice(0, 32),
                )
              }
            >
              Add color
            </button>
          </div>
          <div className="materialRecentTitle">Recent</div>
          <div className="materialSwatchGrid materialSwatchGrid--recent" role="group" aria-label="Recent colors">
            {recentColors.map((hex, index) => (
              <button
                key={`${hex}-recent-${index}`}
                type="button"
                className={paintColor.toLowerCase() === hex ? 'materialSwatch active' : 'materialSwatch'}
                title={hex}
                aria-label={`Set color ${hex}`}
                style={{ '--swatch': hex }}
                onClick={() => applyColor(hex)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
