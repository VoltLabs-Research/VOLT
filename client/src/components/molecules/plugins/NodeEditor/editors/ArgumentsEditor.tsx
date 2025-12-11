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
                    <FormField
                        label='Default Value'
                        fieldKey='default'
                        fieldType='input'
                        fieldValue={arg.default ?? ''}
                        onFieldChange={(_, value) => updateArgument(index, 'default', value)}
                        inputProps={{ placeholder: 'Default value' }}
                    />
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
