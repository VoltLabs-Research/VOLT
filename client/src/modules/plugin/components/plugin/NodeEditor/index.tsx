import { SegmentedTabs } from '@/shared/presentation/primitives';
import { useState } from 'react';
import type { FC } from 'react';
import type { Node } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import DangerZone from '@/shared/presentation/components/DangerZone';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import ModifierEditor from './editors/ModifierEditor';
import ArgumentsEditor from './editors/ArgumentsEditor';
import ContextEditor from './editors/ContextEditor';
import ForEachEditor from './editors/ForEachEditor';
import EntrypointEditor from './editors/EntrypointEditor';
import PluginNodeEditor from './editors/PluginNodeEditor';
import ExposureEditor from './editors/ExposureEditor';
import ExportEditor from './editors/ExportEditor';
import IfStatementEditor from './editors/IfStatementEditor';
import SwitchStatementEditor from './editors/SwitchStatementEditor';
import SwitchCaseEditor from './editors/SwitchCaseEditor';
import ConnectorLayoutEditor from './ConnectorLayoutEditor';


interface NodeEditorProps {
    node: Node;
};

type NodeEditorSection = 'details' | 'connectors';

const EDITOR_COMPONENTS: Partial<Record<NodeType, FC<{ node: Node }>>> = {
    [NodeType.MODIFIER]: ModifierEditor,
    [NodeType.ARGUMENTS]: ArgumentsEditor,
    [NodeType.CONTEXT]: ContextEditor,
    [NodeType.FOREACH]: ForEachEditor,
    [NodeType.ENTRYPOINT]: EntrypointEditor,
    [NodeType.PLUGIN]: PluginNodeEditor,
    [NodeType.EXPOSURE]: ExposureEditor,
    [NodeType.EXPORT]: ExportEditor,
    [NodeType.IF_STATEMENT]: IfStatementEditor,
    [NodeType.SWITCH_STATEMENT]: SwitchStatementEditor,
    [NodeType.SWITCH_CASE]: SwitchCaseEditor
};

const SECTION_TABS: ReadonlyArray<{ id: NodeEditorSection; label: string }> = [
    { id: 'details', label: 'Details' },
    { id: 'connectors', label: 'Connectors' }
];

const NodeEditor = ({ node }: NodeEditorProps) => {
    const deleteNode = usePluginBuilderStore((state) => state.deleteNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);
    const [activeSection, setActiveSection] = useState<NodeEditorSection>('details');

    const nodeType = node.type as NodeType;
    const EditorComponent = EDITOR_COMPONENTS[nodeType];

    const handleDelete = () => {
        deleteNode(node.id);
        selectNode(null);
    };

    return (
        <>
            <div className='floating-node-panel-tabs'>
                <SegmentedTabs
                    tabs={SECTION_TABS}
                    activeTab={activeSection}
                    onChange={setActiveSection}
                    ariaLabel='Node configuration sections'
                    size='sm'
                    fullWidth
                    layoutId={`node-editor-${node.id}`}
                />
            </div>

            <div className='floating-node-panel-body'>
                {activeSection === 'details' && (
                    EditorComponent ? (
                        <EditorComponent node={node} />
                    ) : (
                        <p className='font-size-2 color-muted'>
                            No editor available for this node type.
                        </p>
                    )
                )}

                {activeSection === 'connectors' && (
                    <ConnectorLayoutEditor node={node} />
                )}
            </div>

            <div className='floating-node-panel-footer'>
                <DangerZone
                    title='Delete Node'
                    description='Remove this node and its connections'
                    actionLabel='Delete'
                    actionIcon={<Trash2 size={14} />}
                    onAction={handleDelete}
                />
            </div>
        </>
    );
};

export default NodeEditor;
