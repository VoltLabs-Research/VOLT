import type { FC } from 'react';
import type { Node } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import DangerZone from '@/shared/presentation/components/DangerZone';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import { ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
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

interface NodeDisplayData {
    label?: string;
};

const EDITOR_COMPONENTS: Partial<Record<NodeType, FC<{ node: Node }>>> = {
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
    const nodeData = typeof node.data === 'object' && node.data !== null ? node.data as NodeDisplayData : null;
    const nodeLabel = nodeData?.label?.trim() || nodeType || 'node';

    const handleDelete = async () => {
        const isConfirmed = await confirm({
            title: 'Delete node?',
            description: `Remove ${nodeLabel} and its connections. This action cannot be undone.`,
            confirmText: 'Delete node',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

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
