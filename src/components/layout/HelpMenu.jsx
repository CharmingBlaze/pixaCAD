import { Keyboard } from 'lucide-react';
import {
  MAIN_EDITOR_SHORTCUTS,
  UV_EDITOR_SHORTCUTS,
  PIXEL_EDITOR_SHORTCUTS,
  displayShortcutKeys,
  modKeyLabel,
} from '../../lib/keyboardShortcuts.js';

function ShortcutKeys({ keys }) {
  const parts = displayShortcutKeys(keys);
  return (
    <span className="helpShortcutKeys" aria-label={parts.join(' plus ')}>
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="helpKbd">
          {part}
        </span>
      ))}
    </span>
  );
}

function ShortcutSection({ sectionId, title, items }) {
  return (
    <section className="helpSection">
      <h3 className="helpSectionTitle">{title}</h3>
      <ul className="helpShortcutList">
        {items.map((item) => (
          <li key={`${sectionId}-${item.keys.join('+')}`} className="helpShortcutRow">
            <ShortcutKeys keys={item.keys} />
            <span className="helpShortcutDesc">
              {item.description}
              {item.hint ? <span className="helpShortcutHint"> — {item.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShortcutPanel({ sections }) {
  return (
    <div className="helpShortcutPanel">
      {sections.map((section) => (
        <ShortcutSection key={section.id} sectionId={section.id} title={section.title} items={section.items} />
      ))}
    </div>
  );
}

export function HelpMenu() {
  const mod = modKeyLabel();

  return (
    <div className="menuGroup menuGroup--help">
      <span className="menuLabel helpMenuLabel">
        <Keyboard size={14} strokeWidth={2.2} aria-hidden />
        Help
      </span>
      <div className="menuDropdown menuDropdown--help" role="region" aria-label="Keyboard shortcuts">
        <div className="helpDropdownHeader">
          <div className="helpDropdownTitle">Keyboard shortcuts</div>
          <p className="helpDropdownIntro">
            Shortcuts work when focus is not in a text field. Modifier keys use{' '}
            <kbd className="helpKbd helpKbd--inline">{mod}</kbd> on this system.
          </p>
        </div>
        <div className="helpDropdownBody">
          <ShortcutPanel sections={MAIN_EDITOR_SHORTCUTS} />
          <ShortcutPanel sections={UV_EDITOR_SHORTCUTS} />
          <ShortcutPanel sections={PIXEL_EDITOR_SHORTCUTS} />
        </div>
        <div className="helpDropdownFooter">
          Use the menu bar for file I/O, themes, and viewport layout.
        </div>
      </div>
    </div>
  );
}
