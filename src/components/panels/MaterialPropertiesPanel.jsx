import { useEditorStore } from '../../store/editorStore.js';
import { FaceColorControls } from './FaceColorControls.jsx';

export function MaterialPropertiesPanel() {
  const editMode = useEditorStore((s) => s.editMode);

  return (
    <aside className="materialPanel">
      <h2>{editMode === 'face' ? 'Face Color' : 'Material'}</h2>
      <div className="propBlock">
        <FaceColorControls showHint />
      </div>
    </aside>
  );
}
