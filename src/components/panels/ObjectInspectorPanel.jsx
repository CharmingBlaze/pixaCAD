import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore.js';
import { PropertiesPanel } from './PropertiesPanel.jsx';
import { MaterialPropertiesPanel } from './MaterialPropertiesPanel.jsx';

export function ObjectInspectorPanel() {
  const [tab, setTab] = useState('properties');
  const editMode = useEditorStore((s) => s.editMode);
  const materialTabLabel = editMode === 'face' ? 'Face Color' : 'Material';

  return (
    <aside className="inspectorPanel" data-testid="object-inspector">
      <div className="inspectorTabs" role="tablist" aria-label="Object inspector">
        <button
          type="button"
          role="tab"
          id="inspector-tab-properties"
          aria-selected={tab === 'properties'}
          aria-controls="inspector-panel-properties"
          className={tab === 'properties' ? 'inspectorTab active' : 'inspectorTab'}
          onClick={() => setTab('properties')}
        >
          Properties
        </button>
        <button
          type="button"
          role="tab"
          id="inspector-tab-material"
          aria-selected={tab === 'material'}
          aria-controls="inspector-panel-material"
          className={tab === 'material' ? 'inspectorTab active' : 'inspectorTab'}
          onClick={() => setTab('material')}
        >
          {materialTabLabel}
        </button>
      </div>
      <div className="inspectorTabPanels">
        {tab === 'properties' ? (
          <div
            role="tabpanel"
            id="inspector-panel-properties"
            aria-labelledby="inspector-tab-properties"
            className="inspectorTabPane propsPanel"
          >
            <PropertiesPanel />
          </div>
        ) : (
          <div
            role="tabpanel"
            id="inspector-panel-material"
            aria-labelledby="inspector-tab-material"
            className="inspectorTabPane materialPanel"
          >
            <MaterialPropertiesPanel />
          </div>
        )}
      </div>
    </aside>
  );
}
