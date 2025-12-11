import React, { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import KeyValueEditor from '@/components/molecules/plugins/KeyValueEditor';
import usePluginBuilderStore from '@/stores/plugin-builder';
import { ARGUMENT_TYPE_OPTIONS } from '@/utilities/plugins/node-types';
import type { IArgumentsData, IArgumentDefinition, ArgumentType } from '@/types/plugin';
import { TbPlus, TbTrash } from 'react-icons/tb';

interface ArgumentsEditorProps {
    node: Node;
}

// Convert to SelectOption format (value, title)
const ARGUMENT_TYPE_SELECT_OPTIONS = ARGUMENT_TYPE_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const BOOLEAN_OPTIONS = [
    { value: 'true', title: 'True' },
    { value: 'false', title: 'False' }
];

const ArgumentsEditor: React.FC<ArgumentsEditorProps> = ({ node }) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const argumentsData = (node.data?.arguments || { arguments: [] }) as IArgumentsData;
    const args = argumentsData.arguments || [];

    const updateArgument = useCallback((index: number, field: string, value: any) => {
        const updatedArgs = args.map((arg, i) => 
            i === index ? { ...arg, [field]: value } : arg
        );
        updateNodeData(node.id, { arguments: { arguments: updatedArgs } });
    }, [args, node.id, updateNodeData]);

    // Helpers to convert between array of {key, label} and [string, string][]
    const optionsToEntries = (options: Array<{ key: string; label: string }> = []): [string, string][] => 
        options.map(opt => [opt.key, opt.label]);

    const entriesToOptions = (entries: [string, string][]): Array<{ key: string; label: string }> =>
        entries.map(([key, label]) => ({ key, label }));

    const handleOptionKeyChange = useCallback((argIndex: number, options: Array<{ key: string; label: string }>) => 
        (oldKey: string, newKey: string) => {
            const updated = options.map(opt => 
                opt.key === oldKey ? { ...opt, key: newKey } : opt
            );
            updateArgument(argIndex, 'options', updated);
        }, [updateArgument]);

    const handleOptionValueChange = useCallback((argIndex: number, options: Array<{ key: string; label: string }>) => 
        (key: string, value: string) => {
            const updated = options.map(opt => 
                opt.key === key ? { ...opt, label: value } : opt
            );
            updateArgument(argIndex, 'options', updated);
        }, [updateArgument]);

    const handleAddOption = useCallback((argIndex: number, options: Array<{ key: string; label: string }>) => 
        () => {
            const newOption = { key: `option_${options.length + 1}`, label: `Option ${options.length + 1}` };
            updateArgument(argIndex, 'options', [...options, newOption]);
        }, [updateArgument]);

    const handleRemoveOption = useCallback((argIndex: number, options: Array<{ key: string; label: string }>) => 
        (key: string) => {
            updateArgument(argIndex, 'options', options.filter(opt => opt.key !== key));
        }, [updateArgument]);

    const addArgument = useCallback(() => {
        const newArg: IArgumentDefinition = {
            argument: `arg_${args.length + 1}`,
            type: 'string' as ArgumentType,
            label: `Argument ${args.length + 1}`
        };
        updateNodeData(node.id, { arguments: { arguments: [...args, newArg] } });
    }, [args, node.id, updateNodeData]);

    const removeArgument = useCallback((index: number) => {
        const updatedArgs = args.filter((_, i) => i !== index);
        updateNodeData(node.id, { arguments: { arguments: updatedArgs } });
    }, [args, node.id, updateNodeData]);

    return (
        <>
            {args.map((arg, index) => (
                <CollapsibleSection 
                    key={index}
                    title={arg.label || arg.argument || `Argument ${index + 1}`}
                    defaultExpanded={index === 0}
                >
                    <FormField
                        label='Argument Key'
                        fieldKey='argument'
                        fieldType='input'
                        fieldValue={arg.argument || ''}
                        onFieldChange={(_, value) => updateArgument(index, 'argument', value)}
                        inputProps={{ placeholder: 'my_argument' }}
                    />
                    <FormField
                        label='Label'
                        fieldKey='label'
                        fieldType='input'
                        fieldValue={arg.label || ''}
                        onFieldChange={(_, value) => updateArgument(index, 'label', value)}
                        inputProps={{ placeholder: 'My Argument' }}
                    />
                    <FormField
                        label='Type'
                        fieldKey='type'
                        fieldType='select'
                        fieldValue={arg.type || 'string'}
                        onFieldChange={(_, value) => updateArgument(index, 'type', value)}
                        options={ARGUMENT_TYPE_SELECT_OPTIONS}
                    />
                    
                    {/* Default Value - conditional based on type */}
                    {arg.type === 'boolean' ? (
                        <FormField
                            label='Default Value'
                            fieldKey='default'
                            fieldType='select'
                            fieldValue={String(arg.default ?? 'false')}
                            onFieldChange={(_, value) => updateArgument(index, 'default', value === 'true')}
                            options={BOOLEAN_OPTIONS}
                        />
                    ) : arg.type === 'select' && arg.options && arg.options.length > 0 ? (
                        <FormField
                            label='Default Value'
                            fieldKey='default'
                            fieldType='select'
                            fieldValue={String(arg.default ?? '')}
                            onFieldChange={(_, value) => updateArgument(index, 'default', value)}
                            options={arg.options.map(opt => ({ value: opt.key, title: opt.label }))}
                        />
                    ) : (
                        <FormField
                            label='Default Value'
                            fieldKey='default'
                            fieldType='input'
                            fieldValue={arg.default ?? ''}
                            onFieldChange={(_, value) => updateArgument(index, 'default', arg.type === 'number' ? Number(value) : value)}
                            inputProps={{ 
                                placeholder: 'Default value',
                                type: arg.type === 'number' ? 'number' : 'text'
                            }}
                            expressionEnabled
                            expressionNodeId={node.id}
                        />
                    )}

                    {/* Value - conditional based on type */}
                    {arg.type === 'select' && arg.options && arg.options.length > 0 ? (
                        <FormField
                            label='Value'
                            fieldKey='value'
                            fieldType='select'
                            fieldValue={String(arg.value ?? '')}
                            onFieldChange={(_, value) => updateArgument(index, 'value', value)}
                            options={[
                                { value: '', title: '-- No value --' },
                                ...arg.options.map(opt => ({ value: opt.key, title: opt.label }))
                            ]}
                        />
                    ) : (
                        <FormField
                            label='Value'
                            fieldKey='value'
                            fieldType='input'
                            fieldValue={arg.value ?? ''}
                            onFieldChange={(_, value) => updateArgument(index, 'value', arg.type === 'number' ? Number(value) : value)}
                            inputProps={{ 
                                placeholder: 'Optional value',
                                type: arg.type === 'number' ? 'number' : 'text'
                            }}
                            expressionEnabled
                            expressionNodeId={node.id}
                        />
                    )}

                    {/* Number-specific fields */}
                    {(arg.type === 'number') && (
                        <>
                            <FormField
                                label='Min'
                                fieldKey='min'
                                fieldType='input'
                                fieldValue={arg.min ?? ''}
                                onFieldChange={(_, value) => updateArgument(index, 'min', Number(value))}
                                inputProps={{ type: 'number' }}
                            />
                            <FormField
                                label='Max'
                                fieldKey='max'
                                fieldType='input'
                                fieldValue={arg.max ?? ''}
                                onFieldChange={(_, value) => updateArgument(index, 'max', Number(value))}
                                inputProps={{ type: 'number' }}
                            />
                            <FormField
                                label='Step'
                                fieldKey='step'
                                fieldType='input'
                                fieldValue={arg.step ?? ''}
                                onFieldChange={(_, value) => updateArgument(index, 'step', Number(value))}
                                inputProps={{ type: 'number' }}
                            />
                        </>
                    )}

                    {/* Select-specific fields - options */}
                    {arg.type === 'select' && (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--gray-50)', borderRadius: '6px' }}>
                            <h5 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.5rem' }}>Options</h5>
                            <KeyValueEditor
                                entries={optionsToEntries(arg.options || [])}
                                onAdd={handleAddOption(index, arg.options || [])}
                                onRemove={handleRemoveOption(index, arg.options || [])}
                                onKeyChange={handleOptionKeyChange(index, arg.options || [])}
                                onValueChange={handleOptionValueChange(index, arg.options || [])}
                                keyLabel="Key"
                                valueLabel="Label"
                                keyPlaceholder="option_key"
                                valuePlaceholder="Option Label"
                                addButtonText="Add Option"
                            />
                        </div>
                    )}

                    <button 
                        className='node-editor-delete-btn' 
                        onClick={() => removeArgument(index)}
                        style={{ marginTop: '0.5rem' }}
                    >
                        <TbTrash size={14} />
                        Remove Argument
                    </button>
                </CollapsibleSection>
            ))}

            <button 
                className='node-editor-delete-btn' 
                onClick={addArgument}
                style={{ 
                    background: 'var(--gray-100)', 
                    borderColor: 'var(--gray-300)',
                    color: 'var(--gray-700)'
                }}
            >
                <TbPlus size={14} />
                Add Argument
            </button>
        </>
    );
};

export default ArgumentsEditor;
