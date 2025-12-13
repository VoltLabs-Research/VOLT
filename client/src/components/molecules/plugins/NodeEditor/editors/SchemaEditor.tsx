import React, { useState, useCallback, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import CodeEditor from '@/components/atoms/common/CodeEditor';
import usePluginBuilderStore from '@/stores/plugins/plugin-builder';
import type { ISchemaData } from '@/types/plugin';
import { TbCheck, TbCopy, TbSparkles } from 'react-icons/tb';
import './SchemaEditor.css';

interface SchemaEditorProps {
    node: Node;
}

const SCHEMA_TEMPLATES = [
    {
        name: 'Atomic Data',
        schema: {
            metadata: {
                total_atoms: 'int',
                timestep: 'int'
            },
            data: {
                type: 'array',
                items: {
                    x: 'float',
                    y: 'float',
                    z: 'float',
                    type: 'int'
                }
            }
        }
    },
    {
        name: 'Analysis Results',
        schema: {
            metadata: {
                count: 'int'
            },
            summary: {
                mean: 'float',
                std: 'float',
                min: 'float',
                max: 'float'
            },
            data: {
                type: 'array',
                items: 'float'
            }
        }
    },
    {
        name: 'Dislocation Segments',
        schema: {
            metadata: {
                count: 'int'
            },
            summary: {
                total_length: 'float',
                average_segment_length: 'float',
                max_segment_length: 'float',
                min_segment_length: 'float'
            },
            data: {
                type: 'array',
                items: {
                    segment_id: 'int',
                    length: 'float',
                    num_points: 'int',
                    burgers: {
                        vector: { type: 'array', items: 'float' },
                        magnitude: 'float',
                        fractional: 'string'
                    }
                }
            }
        }
    },
    {
        name: 'Mesh Data',
        schema: {
            metadata: {
                vertex_count: 'int',
                face_count: 'int'
            },
            vertices: {
                type: 'array',
                items: { x: 'float', y: 'float', z: 'float' }
            },
            faces: {
                type: 'array',
                items: { type: 'array', items: 'int' }
            },
            normals: {
                type: 'array',
                items: { x: 'float', y: 'float', z: 'float' }
            }
        }
    },
    {
        name: 'Structure Analysis',
        schema: {
            total_atoms: 'int',
            analysis_method: 'string',
            structure_types: {
                type: 'object',
                schema: {
                    count: 'int',
                    percentage: 'float',
                    type_id: 'int'
                },
                keys: ['OTHER', 'FCC', 'HCP', 'BCC', 'ICO', 'SC', 'CUBIC_DIAMOND', 'HEX_DIAMOND', 'GRAPHENE', 'UNKNOWN']
            }
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
        try{
            JSON.parse(jsonText);
            return true;
        } catch {
            return false;
        }
    }, [jsonText]);

    const handleJsonChange = useCallback((newText: string) => {
        setJsonText(newText);

        try{
            const parsed = JSON.parse(newText);
            setError(null);
            updateNodeData(node.id, { schema: { definition: parsed } });
        }catch(err: any){
            setError(err.message);
        }
    }, [node.id, updateNodeData]);

    const formatJson = useCallback(() => {
        try{
            const parsed = JSON.parse(jsonText);
            const formatted = JSON.stringify(parsed, null, 2);
            setJsonText(formatted);
            setError(null);
        }catch(err: any){
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

    return(
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

                    <CodeEditor
                        value={jsonText}
                        onChange={handleJsonChange}
                        language="json"
                        height={200}
                        error={error}
                    />

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
