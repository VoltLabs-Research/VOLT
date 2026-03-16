import type { FC } from 'react';
import type { Node } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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


interface NodeEditorProps {
    node: Node;
};

const EDITOR_COMPONENTS: Partial<Record<NodeType, FC<{ node: Node }>>> = {
    [NodeType.MODIFIER]: ModifierEditor,
    [NodeType.ARGUMENTS]: ArgumentsEditor,
    [NodeType.CONTEXT]: ContextEditor,
    [NodeType.FOREACH]: ForEachEditor,
    [NodeType.ENTRYPOINT]: EntrypointEditor,
    [NodeType.PLUGIN]: PluginNodeEditor,
    [NodeType.EXPOSURE]: ExposureEditor,
    [NodeType.EXPORT]: ExportEditor,
    [NodeType.IF_STATEMENT]: IfStatementEditor
};

const NodeEditor = ({ node }: NodeEditorProps) => {
    const deleteNode = usePluginBuilderStore((state) => state.deleteNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);

    const nodeType = node.type as NodeType;
    const EditorComponent = EDITOR_COMPONENTS[nodeType];

    const handleDelete = () => {
        deleteNode(node.id);
        selectNode(null);
    };

    return (
        <Container className='p-1 y-auto'>
            <Container>
                {EditorComponent ? (
                    <EditorComponent node={node} />
                ) : (
                    <Container>
                        <Paragraph>No editor available for this node type.</Paragraph>
                    </Container>
                )}
            </Container>

            <Container className='mt-1'>
                <DangerZone
                    title='Delete Node'
                    description='Remove this node and its connections'
                    actionLabel='Delete'
                    actionIcon={<Trash2 size={14} />}
                    onAction={handleDelete}
                />
            </Container>
        </Container>
    );
};

export default NodeEditor;
