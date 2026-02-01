import type { FC } from 'react';
import type { Node } from '@xyflow/react';
import { TbTrash } from 'react-icons/tb';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import { NodeType } from '@/modules/plugin/domain/entities';
import ModifierEditor from './editors/ModifierEditor';
import ArgumentsEditor from './editors/ArgumentsEditor';
import ContextEditor from './editors/ContextEditor';
import ForEachEditor from './editors/ForEachEditor';
import EntrypointEditor from './editors/EntrypointEditor';
import ExposureEditor from './editors/ExposureEditor';
import SchemaEditor from './editors/SchemaEditor';
import VisualizersEditor from './editors/VisualizersEditor';
import ExportEditor from './editors/ExportEditor';
import IfStatementEditor from './editors/IfStatementEditor';
import './NodeEditor.css';

interface NodeEditorProps {
    node: Node;
};

const EDITOR_COMPONENTS: Partial<Record<NodeType, FC<{ node: Node }>>> = {
    [NodeType.MODIFIER]: ModifierEditor,
    [NodeType.ARGUMENTS]: ArgumentsEditor,
    [NodeType.CONTEXT]: ContextEditor,
    [NodeType.FOREACH]: ForEachEditor,
    [NodeType.ENTRYPOINT]: EntrypointEditor,
    [NodeType.EXPOSURE]: ExposureEditor,
    [NodeType.SCHEMA]: SchemaEditor,
    [NodeType.VISUALIZERS]: VisualizersEditor,
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
        <Container className='p-2 node-editor-container y-auto'>
            <Container>
                {EditorComponent ? (
                    <EditorComponent node={node} />
                ) : (
                    <Container>
                        <Paragraph>No editor available for this node type.</Paragraph>
                    </Container>
                )}
            </Container>

            <Button
                variant='ghost'
                intent='danger'
                size='sm'
                leftIcon={<TbTrash size={14} />}
                onClick={handleDelete}
                style={{ marginTop: '1rem' }}
            >
                Delete Node
            </Button>
        </Container>
    );
};

export default NodeEditor;
