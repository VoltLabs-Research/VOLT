import { buildDeleteNodeConfirmOptions } from '@/modules/plugin/utilities/plugin/destructive-action-options';
import Container from '@/shared/presentation/components/Container';
import DangerZone from '@/shared/presentation/components/DangerZone';
import Paragraph from '@/shared/presentation/components/Paragraph';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { Trash2 } from 'lucide-react';
import type { Node } from '@xyflow/react';
import type { FC } from 'react';
import ModifierEditor from './editors/ModifierEditor';
import ArgumentsEditor from './editors/ArgumentsEditor';
import ContextEditor from './editors/ContextEditor';
import ForEachEditor from './editors/ForEachEditor';
import EntrypointEditor from './editors/EntrypointEditor';
import ExposureEditor from './editors/ExposureEditor';
import ExportEditor from './editors/ExportEditor';
import IfStatementEditor from './editors/IfStatementEditor';


interface NodeEditorProps {
    node: Node;
};

interface NodeEditorComponentProps {
    node: Node;
};

const EDITOR_COMPONENTS: Partial<Record<NodeType, FC<NodeEditorComponentProps>>> = {
    [NodeType.MODIFIER]: ModifierEditor,
    [NodeType.ARGUMENTS]: ArgumentsEditor,
    [NodeType.CONTEXT]: ContextEditor,
    [NodeType.FOREACH]: ForEachEditor,
    [NodeType.ENTRYPOINT]: EntrypointEditor,
    [NodeType.EXPOSURE]: ExposureEditor,
    [NodeType.EXPORT]: ExportEditor,
    [NodeType.IF_STATEMENT]: IfStatementEditor
};

const NodeEditor = ({ node }: NodeEditorProps) => {
    const { confirm } = useConfirm();
    const deleteNode = usePluginBuilderStore((state) => state.deleteNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);

    const nodeType = Object.values(NodeType).find((value) => value === node.type);
    const EditorComponent = nodeType ? EDITOR_COMPONENTS[nodeType] : undefined;

    const handleDelete = async () => {
        const isConfirmed = await confirm(buildDeleteNodeConfirmOptions(node));

        if (!isConfirmed) {
            return;
        }

        deleteNode(node.id);
        selectNode(null);
    };

    return (
        <Container className='node-editor-content d-flex column gap-1 p-1'>
            <Container className='node-editor-fields d-flex column gap-1'>
                {EditorComponent ? (
                    <EditorComponent node={node} />
                ) : (
                    <Container>
                        <Paragraph>No editor available for this node type.</Paragraph>
                    </Container>
                )}
            </Container>

            <Container className='node-editor-danger-zone mt-1 pt-1'>
                <DangerZone
                    title='Delete Node'
                    description='Remove this node and all of its connections after confirmation.'
                    actionLabel='Delete'
                    actionIcon={<Trash2 size={14} />}
                    onAction={handleDelete}
                />
            </Container>
        </Container>
    );
};

export default NodeEditor;
