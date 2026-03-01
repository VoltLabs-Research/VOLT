import { useState, useCallback, useMemo } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import CodeEditor from '@/shared/presentation/components/CodeEditor';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { TbCheck, TbCopy, TbSparkles } from 'react-icons/tb';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import type { ISchemaData } from '@/modules/plugin/domain/entities';
import { sileo } from 'sileo';
import type { EditorProps } from '../types';

const SCHEMA_TEMPLATES = [
    {
        name: 'Atomic Data',
        schema: {
            metadata: { total_atoms: 'int', timestep: 'int' },
            data: {
                type: 'array',
                items: { x: 'float', y: 'float', z: 'float', type: 'int' }
            }
        }
    },
    {
        name: 'Analysis Results',
        schema: {
            metadata: { count: 'int' },
            summary: { mean: 'float', std: 'float', min: 'float', max: 'float' },
            data: { type: 'array', items: 'float' }
        }
    },
    {
        name: 'Mesh Data',
        schema: {
            metadata: { vertex_count: 'int', face_count: 'int' },
            vertices: { type: 'array', items: { x: 'float', y: 'float', z: 'float' } },
            faces: { type: 'array', items: { type: 'array', items: 'int' } }
        }
    }
];

const SchemaEditor = ({ node }: EditorProps) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);

    const schemaData = useMemo((): ISchemaData => {
        const storeNode = storeNodes.find((n) => n.id === node.id);
        const data = storeNode?.data ?? node.data;
        return (data.schema ?? { definition: {} }) as ISchemaData;
    }, [storeNodes, node.id, node.data]);

    const [jsonText, setJsonText] = useState(() => {
        return JSON.stringify(schemaData.definition ?? {}, null, 2);
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

    const handleJsonChange = useCallback((value: string) => {
        setJsonText(value);

        try {
            const parsed = JSON.parse(value);
            setError(null);
            updateNodeData(node.id, { schema: { definition: parsed } });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid JSON');
        }
    }, [node.id, updateNodeData]);

    const formatJson = useCallback(() => {
        try {
            const parsed = JSON.parse(jsonText);
            const formatted = JSON.stringify(parsed, null, 2);
            setJsonText(formatted);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid JSON');
        }
    }, [jsonText]);

    const applyTemplate = useCallback((template: typeof SCHEMA_TEMPLATES[0]) => {
        const formatted = JSON.stringify(template.schema, null, 2);
        setJsonText(formatted);
        setError(null);
        updateNodeData(node.id, { schema: { definition: template.schema } });
        setShowTemplates(false);
    }, [node.id, updateNodeData]);

    const copyToClipboard = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(jsonText);
            sileo.success({ title: 'Copied to clipboard' });
        } catch {
            sileo.error({ title: 'Failed to copy to clipboard' });
        }
    }, [jsonText]);

    return (
        <CollapsibleSection title='Schema Definition' defaultExpanded>
            <Container className='d-flex column gap-075'>
                <Paragraph className='font-size-1 line-height-5 color-secondary'>
                    Define the JSON structure of your output data.
                </Paragraph>

                <Container className='d-flex gap-05'>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        leftIcon={<TbSparkles size={14} />}
                        onClick={() => setShowTemplates(!showTemplates)}
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
                    >
                        Format
                    </Button>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        leftIcon={<TbCopy size={14} />}
                        onClick={copyToClipboard}
                    >
                        Copy
                    </Button>
                </Container>

                {showTemplates && (
                    <Container className='d-flex flex-wrap gap-05'>
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
                    </Container>
                )}

                <CodeEditor
                    value={jsonText}
                    onChange={handleJsonChange}
                    rows={10}
                    error={error ?? undefined}
                />

                {isValidJson && !error && (
                    <Container className='d-flex items-center gap-05 font-size-1 color-success'>
                        <TbCheck size={14} />
                        <span>Valid JSON Schema</span>
                    </Container>
                )}
            </Container>
        </CollapsibleSection>
    );
};

export default SchemaEditor;
