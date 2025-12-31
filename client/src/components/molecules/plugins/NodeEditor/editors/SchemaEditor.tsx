import React, { useState, useCallback, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import CodeEditor from '@/components/atoms/common/CodeEditor';
import FormField from '@/components/molecules/form/FormField';
import { usePluginBuilderStore } from '@/stores/slices/plugin/builder-slice';
import Button from '@/components/primitives/Button';
import type { ISchemaData } from '@/types/plugin';
import Paragraph from '@/components/primitives/Paragraph';
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

    return (
        <>
            <CollapsibleSection title='Schema Definition' defaultExpanded>
                <div className="d-flex column gap-075 schema-editor">
                    <Paragraph className="schema-editor-description font-size-1 line-height-5">
                        Define the JSON structure of your output data. This schema describes the shape of results
                        from your analysis and enables downstream nodes to reference specific fields.
                    </Paragraph>

                    <div className="d-flex gap-05 schema-editor-toolbar">
                        <Button
                            variant='ghost'
                            intent='neutral'
                            size='sm'
                            leftIcon={<TbSparkles size={14} />}
                            onClick={() => setShowTemplates(!showTemplates)}
                            title="Use template"
                        >
                            Templates
                        </Button>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            size='sm'
                            leftIcon={<TbCheck size={14} />}
                            onClick={formatJson}
                            disabled={!isValidJson}
                            title="Format JSON"
                        >
                            Format
                        </Button>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            size='sm'
                            leftIcon={<TbCopy size={14} />}
                            onClick={copyToClipboard}
                            title="Copy to clipboard"
                        >
                            Copy
                        </Button>
                    </div>

                    {showTemplates && (
                        <div className="d-flex flex-wrap gap-05 schema-templates">
                            {SCHEMA_TEMPLATES.map((template, idx) => (
                                <Button
                                    key={idx}
                                    variant='soft'
                                    intent='neutral'
                                    size='sm'
                                    onClick={() => applyTemplate(template)}
                                >
                                    {template.name}
                                </Button>
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
                        <div className="d-flex items-center gap-05 schema-editor-status font-size-1">
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
