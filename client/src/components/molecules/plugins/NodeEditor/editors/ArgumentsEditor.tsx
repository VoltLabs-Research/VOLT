import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
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

    const updateArgument = (index: number, field: string, value: any) => {
        const updatedArgs = args.map((arg, i) => 
            i === index ? { ...arg, [field]: value } : arg
        );
        updateNodeData(node.id, { arguments: { arguments: updatedArgs } });
    };

    const updateArgumentOption = (argIndex: number, optionIndex: number, field: 'key' | 'label', value: string) => {
        const arg = args[argIndex];
        const options = arg.options || [];
        const updatedOptions = options.map((opt, i) => 
            i === optionIndex ? { ...opt, [field]: value } : opt
        );
        updateArgument(argIndex, 'options', updatedOptions);
    };

    const addOption = (argIndex: number) => {
        const arg = args[argIndex];
        const options = arg.options || [];
        const newOption = { key: `option_${options.length + 1}`, label: `Option ${options.length + 1}` };
        updateArgument(argIndex, 'options', [...options, newOption]);
    };

    const removeOption = (argIndex: number, optionIndex: number) => {
        const arg = args[argIndex];
        const options = arg.options || [];
        updateArgument(argIndex, 'options', options.filter((_, i) => i !== optionIndex));
    };

    const addArgument = () => {
        const newArg: IArgumentDefinition = {
            argument: `arg_${args.length + 1}`,
            type: 'string' as ArgumentType,
            label: `Argument ${args.length + 1}`
        };
        updateNodeData(node.id, { arguments: { arguments: [...args, newArg] } });
    };

    const removeArgument = (index: number) => {
        const updatedArgs = args.filter((_, i) => i !== index);
        updateNodeData(node.id, { arguments: { arguments: updatedArgs } });
    };

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
                        />
                    )}

                    {/* Value - always show */}
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
                    />

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
                            {(arg.options || []).map((option, optIndex) => (
                                <div key={optIndex} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 1 }}>
                                        <FormField
                                            label='Key'
                                            fieldKey='key'
                                            fieldType='input'
                                            fieldValue={option.key || ''}
                                            onFieldChange={(_, value) => updateArgumentOption(index, optIndex, 'key', value)}
                                            inputProps={{ placeholder: 'option_key' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <FormField
                                            label='Label'
                                            fieldKey='label'
                                            fieldType='input'
                                            fieldValue={option.label || ''}
                                            onFieldChange={(_, value) => updateArgumentOption(index, optIndex, 'label', value)}
                                            inputProps={{ placeholder: 'Option Label' }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeOption(index, optIndex)}
                                        style={{
                                            padding: '0.5rem',
                                            background: 'var(--red-50)',
                                            border: '1px solid var(--red-200)',
                                            borderRadius: '4px',
                                            color: 'var(--red-600)',
                                            cursor: 'pointer',
                                            marginBottom: '0.25rem'
                                        }}
                                    >
                                        <TbTrash size={14} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => addOption(index)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    background: 'var(--gray-100)',
                                    border: '1px solid var(--gray-300)',
                                    borderRadius: '4px',
                                    color: 'var(--gray-700)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                <TbPlus size={12} />
                                Add Option
                            </button>
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
