import React from 'react';
import type { Node } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import { TbTrash } from 'react-icons/tb';
import usePluginBuilderStore from '@/stores/plugin-builder';
import {
    ModifierEditor,
    ArgumentsEditor,
    ContextEditor,
    ForEachEditor,
    EntrypointEditor,
    ExposureEditor
} from './editors';
import './NodeEditor.css';

interface NodeEditorProps {
    node: Node;
}

const EDITOR_COMPONENTS: Partial<Record<NodeType, React.FC<{ node: Node }>>> = {
    [NodeType.MODIFIER]: ModifierEditor,
    [NodeType.ARGUMENTS]: ArgumentsEditor,
    [NodeType.CONTEXT]: ContextEditor,
    [NodeType.FOREACH]: ForEachEditor,
    [NodeType.ENTRYPOINT]: EntrypointEditor,
    [NodeType.EXPOSURE]: ExposureEditor
};

const NodeEditor: React.FC<NodeEditorProps> = ({ node }) => {
    const deleteNode = usePluginBuilderStore((state) => state.deleteNode);
    const selectNode = usePluginBuilderStore((state) => state.selectNode);

    const nodeType = node.type as NodeType;
    const config = NODE_CONFIGS[nodeType];
    const EditorComponent = EDITOR_COMPONENTS[nodeType];

    const handleDelete = () => {
        deleteNode(node.id);
        selectNode(null);
    };

    return (
        <div className='node-editor-container'>
            <div className='node-editor-section'>
                {EditorComponent ? (
                    <EditorComponent node={node} />
                ) : (
                    <div className='node-editor-empty'>
                        <p>No editor available for this node type.</p>
                    </div>
                )}
            </div>

            <button className='node-editor-delete-btn' onClick={handleDelete}>
                <TbTrash size={14} />
                Delete Node
            </button>
        </div>
    );
};

export default NodeEditor;
