import React, { useState, useCallback, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import usePluginBuilderStore from '@/stores/plugin-builder';
import type { ISchemaData } from '@/types/plugin';
import { TbAlertCircle, TbCheck, TbCopy, TbSparkles } from 'react-icons/tb';
import './SchemaEditor.css';

interface SchemaEditorProps {
    node: Node;
}

const SCHEMA_TEMPLATES = [
    {
        name: 'Atomic Data',
        schema: {
            atoms: { type: 'array', items: { type: 'object', properties: { x: 'number', y: 'number', z: 'number', type: 'number' } } },
            total_atoms: 'number',
            timestep: 'number'
        }
    },
    {
        name: 'Analysis Results',
        schema: {
            values: { type: 'array', items: 'number' },
            mean: 'number',
            std: 'number',
            min: 'number',
            max: 'number'
        }
    },
    {
        name: 'Mesh Data',
        schema: {
            vertices: { type: 'array', items: { x: 'number', y: 'number', z: 'number' } },
            faces: { type: 'array', items: { type: 'array', items: 'number' } },
            normals: { type: 'array', items: { x: 'number', y: 'number', z: 'number' } }
        }
    }
];

const SchemaEditor: React.FC<SchemaEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const schemaData = (node.data?.schema || { definition: {} }) as ISchemaData;
    
    const [jsonText, setJsonText] = useState(() => {
        return JSON.stringify(schemaData.definition || {}, null, 2);
    });
    const [error, setError] = useState<string | null>(null);
    const [showTemplates, setShowTemplates] = useState(false);

    const isValidJson = useMemo(() => {
        try {
            JSON.parse(jsonText);
            return true;
        } catch {
            return false;
        }
    }, [jsonText]);

    const handleJsonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setJsonText(newText);
        
        try {
            const parsed = JSON.parse(newText);
            setError(null);
            updateNodeData(node.id, { schema: { definition: parsed } });
        } catch (err: any) {
            setError(err.message);
        }
    }, [node.id, updateNodeData]);

    const formatJson = useCallback(() => {
        try {
            const parsed = JSON.parse(jsonText);
            const formatted = JSON.stringify(parsed, null, 2);
            setJsonText(formatted);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        }
    }, [jsonText]);

    const applyTemplate = useCallback((template: typeof SCHEMA_TEMPLATES[0]) => {
        const formatted = JSON.stringify(template.schema, null, 2);
        setJsonText(formatted);
        setError(null);
        updateNodeData(node.id, { schema: { definition: template.schema } });
        setShowTemplates(false);
    }, [node.id, updateNodeData]);

    const copyToClipboard = useCallback(() => {
        navigator.clipboard.writeText(jsonText);
    }, [jsonText]);

    return (
        <>
            <CollapsibleSection title='Schema Definition' defaultExpanded>
                <div className="schema-editor">
                    <p className="schema-editor-description">
                        Define the JSON structure of your output data. This schema describes the shape of results 
                        from your analysis and enables downstream nodes to reference specific fields.
                    </p>

                    <div className="schema-editor-toolbar">
                        <button 
                            className="schema-editor-btn"
                            onClick={() => setShowTemplates(!showTemplates)}
                            title="Use template"
                        >
                            <TbSparkles size={14} />
                            Templates
                        </button>
                        <button 
                            className="schema-editor-btn"
                            onClick={formatJson}
                            disabled={!isValidJson}
                            title="Format JSON"
                        >
                            <TbCheck size={14} />
                            Format
                        </button>
                        <button 
                            className="schema-editor-btn"
                            onClick={copyToClipboard}
                            title="Copy to clipboard"
                        >
                            <TbCopy size={14} />
                            Copy
                        </button>
                    </div>

                    {showTemplates && (
                        <div className="schema-templates">
                            {SCHEMA_TEMPLATES.map((template, idx) => (
                                <button
                                    key={idx}
                                    className="schema-template-item"
                                    onClick={() => applyTemplate(template)}
                                >
                                    {template.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={`schema-editor-container ${error ? 'schema-editor-container--error' : ''}`}>
                        <div className="schema-editor-line-numbers">
                            {jsonText.split('\n').map((_, i) => (
                                <span key={i}>{i + 1}</span>
                            ))}
                        </div>
                        <textarea
                            className="schema-editor-textarea"
                            value={jsonText}
                            onChange={handleJsonChange}
                            placeholder='{\n  "field_name": "type",\n  "array_field": {\n    "type": "array",\n    "items": "number"\n  }\n}'
                            spellCheck={false}
                        />
                    </div>

                    {error && (
                        <div className="schema-editor-error">
                            <TbAlertCircle size={14} />
                            <span>{error}</span>
                        </div>
                    )}

                    {isValidJson && !error && (
                        <div className="schema-editor-status">
                            <TbCheck size={14} />
                            <span>Valid JSON Schema</span>
                        </div>
                    )}
                </div>
            </CollapsibleSection>
        </>
    );
};

export default SchemaEditor;
