import React from 'react';
import type { Node } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import { TbTrash } from 'react-icons/tb';
import Container from '@/components/primitives/Container';
import usePluginBuilderStore from '@/stores/plugins/plugin-builder';
import {
    ModifierEditor,
    ArgumentsEditor,
    ContextEditor,
    ForEachEditor,
    EntrypointEditor,
    ExposureEditor,
    SchemaEditor,
    VisualizersEditor,
    ExportEditor
} from './editors';

interface NodeEditorProps {
    node: Node;
}

const EDITOR_COMPONENTS: Partial<Record<NodeType, React.FC<{ node: Node }>>> = {
    [NodeType.MODIFIER]: ModifierEditor,
    [NodeType.ARGUMENTS]: ArgumentsEditor,
    [NodeType.CONTEXT]: ContextEditor,
    [NodeType.FOREACH]: ForEachEditor,
    [NodeType.ENTRYPOINT]: EntrypointEditor,
    [NodeType.EXPOSURE]: ExposureEditor,
    [NodeType.SCHEMA]: SchemaEditor,
    [NodeType.VISUALIZERS]: VisualizersEditor,
    [NodeType.EXPORT]: ExportEditor
};

const NodeEditor: React.FC<NodeEditorProps> = ({ node }) => {
    const deleteNode = usePluginBuilderStore((state) => state.deleteNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);

    const nodeType = node.type as NodeType;
    const EditorComponent = EDITOR_COMPONENTS[nodeType];

    const handleDelete = () => {
        deleteNode(node.id);
        selectNode(null);
    };

    return(
        <Container className='p-2'>
            <Container>
                {EditorComponent ? (
                    <EditorComponent node={node} />
                ) : (
                    <Container>
                        <p>No editor available for this node type.</p>
                    </Container>
                )}
            </Container>

            <button className='node-editor-delete-btn' onClick={handleDelete}>
                <TbTrash size={14} />
                Delete Node
            </button>
        </Container>
    );
};

export default NodeEditor;
