import { useMemo, useState } from 'react';
import { useEditorStore } from '../../store/editorStore.js';
import { hasSelectedGroup, isObjectSelected, selectedObjectCount } from '../../store/objectSelection.js';
import { selectModeFromEvent } from '../../store/selection.js';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';

function buildTree(objects) {
  const byParent = new Map();
  for (const o of objects) {
    const pid = o.parentId ?? '__root__';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(o);
  }
  return byParent;
}

function SceneTreeNode({
  obj,
  depth,
  expanded,
  onToggleExpand,
  byParent,
  orderMap,
  onDragStart,
  onDragOver,
  onDrop,
  draggingId,
  dragOverId,
}) {
  const isSelected = useEditorStore((s) => isObjectSelected(s, obj.id));
  const selectObject = useEditorStore((s) => s.selectObject);
  const updateObject = useEditorStore((s) => s.updateObject);
  const toggleObjectLock = useEditorStore((s) => s.toggleObjectLock);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(obj.name);

  const children = byParent.get(obj.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expanded[obj.id] !== false;
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const commitRename = () => {
    const name = draftName.trim() || obj.name;
    if (name !== obj.name) pushHistory();
    updateObject(obj.id, { name }, { skipHistory: true });
    setRenaming(false);
  };

  return (
    <>
      <li
        className={dragOverId === obj.id ? 'sceneTreeRow dragOver' : 'sceneTreeRow'}
        style={{ paddingLeft: depth * 12 }}
        onDragOver={(e) => onDragOver(e, obj.id)}
        onDrop={(e) => onDrop(e, obj.id)}
      >
        <div className="sceneTreeRowInner">
          {hasChildren ? (
            <button
              type="button"
              className="iconBtn tiny sceneTreeToggle"
              onClick={() => onToggleExpand(obj.id)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : null}

          <div className="sceneRowActions">
            <button
              type="button"
              className="sceneIconBtn"
              title={obj.visible ? 'Hide layer' : 'Show layer'}
              onClick={() => updateObject(obj.id, { visible: !obj.visible })}
            >
              {obj.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              type="button"
              className="sceneIconBtn"
              title={obj.locked ? 'Unlock object' : 'Lock object'}
              onClick={() => toggleObjectLock(obj.id)}
            >
              {obj.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>

          <button
            type="button"
            data-testid={`scene-item-${obj.id}`}
            className={[
              isSelected ? 'sceneItem active' : 'sceneItem',
              obj.locked ? 'locked' : '',
              draggingId === obj.id ? 'dragging' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable
            onDragStart={(e) => onDragStart(e, obj.id)}
            onClick={(e) => {
              const mode = selectModeFromEvent(e);
              if (mode === 'replace') selectObject(obj.id);
              else if (mode === 'add') selectObject(obj.id, { additive: true });
              else selectObject(obj.id, { remove: true });
            }}
            onDoubleClick={() => {
              setDraftName(obj.name);
              setRenaming(true);
            }}
          >
            <span className="sceneItemBody">
              {renaming ? (
                <input
                  className="sceneRenameInput"
                  value={draftName}
                  autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenaming(false);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="sceneItemName">{obj.name}</span>
              )}
            </span>
          </button>
        </div>
      </li>

      {hasChildren &&
        isExpanded &&
        children.map((child) => (
          <SceneTreeNode
            key={child.id}
            obj={child}
            depth={depth + 1}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            byParent={byParent}
            orderMap={orderMap}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            draggingId={draggingId}
            dragOverId={dragOverId}
          />
        ))}
    </>
  );
}

export function ScenePanel() {
  const objects = useEditorStore((s) => s.objects);
  const addGroup = useEditorStore((s) => s.addGroup);
  const groupSelectedObjects = useEditorStore((s) => s.groupSelectedObjects);
  const ungroupSelected = useEditorStore((s) => s.ungroupSelected);
  const moveObjectToIndex = useEditorStore((s) => s.moveObjectToIndex);
  const selectionCount = useEditorStore((s) => selectedObjectCount(s));
  const hasGroupSelected = useEditorStore((s) => hasSelectedGroup(s));
  const [expanded, setExpanded] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const byParent = useMemo(() => buildTree(objects), [objects]);
  const orderMap = useMemo(() => new Map(objects.map((o, i) => [o.id, i])), [objects]);
  const roots = byParent.get('__root__') ?? [];

  const onToggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: prev[id] === false }));
  };

  const onDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const onDragOver = (e, id) => {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    setDragOverId(id);
  };

  const onDrop = (e, id) => {
    e.preventDefault();
    const sourceId = draggingId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === id) {
      setDragOverId(null);
      setDraggingId(null);
      return;
    }
    const targetIndex = objects.findIndex((o) => o.id === id);
    if (targetIndex >= 0) moveObjectToIndex(sourceId, targetIndex);
    setDragOverId(null);
    setDraggingId(null);
  };

  return (
    <aside className="scenePanel">
      <div className="scenePanelHead">
        <h2>Scene</h2>
        <div className="scenePanelActions">
          <button
            type="button"
            className="textBtn"
            onClick={() => (selectionCount >= 2 ? groupSelectedObjects() : addGroup())}
            title={selectionCount >= 2 ? 'Group selected objects (Shift-click to multi-select)' : 'Add empty group'}
          >
            {selectionCount >= 2 ? 'Group' : '+ Group'}
          </button>
          <button
            type="button"
            className="textBtn"
            disabled={!hasGroupSelected}
            onClick={() => ungroupSelected()}
            title="Ungroup selected group(s)"
          >
            Ungroup
          </button>
        </div>
      </div>

      {objects.length === 0 ? (
        <p className="panelHint">No objects. Use Create tools on the left.</p>
      ) : (
        <>
        <ul className="sceneTree">
          {roots.map((obj) => (
            <SceneTreeNode
              key={obj.id}
              obj={obj}
              depth={0}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              byParent={byParent}
              orderMap={orderMap}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              draggingId={draggingId}
              dragOverId={dragOverId}
            />
          ))}
        </ul>
        </>
      )}

    </aside>
  );
}
