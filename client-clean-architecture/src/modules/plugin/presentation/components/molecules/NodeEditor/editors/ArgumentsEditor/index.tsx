import { useCallback, useMemo, ChangeEvent } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { TbPlus } from 'react-icons/tb';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import { ARGUMENT_TYPE_OPTIONS } from '@/modules/plugin/presentation/utilities/node-types';
import type { IArgumentsData, IArgumentDefinition, ArgumentType } from '@/modules/plugin/domain/entities';

interface ArgumentsEditorProps {
    node: Node;
};

const ARGUMENT_TYPE_SELECT_OPTIONS = ARGUMENT_TYPE_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const ArgumentsEditor = ({ node }: ArgumentsEditorProps) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);
    
    const args = useMemo(() => {
        const storeNode = storeNodes.find((n) => n.id === node.id);
        const nodeData = storeNode?.data || node.data;
        const argumentsData = (nodeData?.arguments || { arguments: [] }) as IArgumentsData;
        return argumentsData.arguments || [];
    }, [storeNodes, node.id, node.data]);

    const updateArgument = useCallback((index: number, field: string, value: unknown) => {
        const updatedArgs = args.map((arg, i) =>
            i === index ? { ...arg, [field]: value } : arg
        );
        updateNodeData(node.id, { arguments: { arguments: updatedArgs } });
    }, [args, node.id, updateNodeData]);

    const createChangeHandler = useCallback((index: number, field: string) => {
        return (e: ChangeEvent<HTMLInputElement>) => {
            updateArgument(index, field, e.target.value);
        };
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
                    onDelete={() => removeArgument(index)}
                >
                    <FormField
                        variant='inline'
                        label='Argument Key'
                        name='argument'
                        fieldType='input'
                        value={arg.argument || ''}
                        onChange={createChangeHandler(index, 'argument')}
                        placeholder='my_argument'
                    />
                    <FormField
                        variant='inline'
                        label='Label'
                        name='label'
                        fieldType='input'
                        value={arg.label || ''}
                        onChange={createChangeHandler(index, 'label')}
                        placeholder='My Argument'
                    />
                    <FormField
                        variant='inline'
                        label='Type'
                        name='type'
                        fieldType='select'
                        value={arg.type || 'string'}
                        onChange={createChangeHandler(index, 'type')}
                        options={ARGUMENT_TYPE_SELECT_OPTIONS}
                    />
                    <FormField
                        variant='inline'
                        label='Default Value'
                        name='default'
                        fieldType='input'
                        value={arg.default as string ?? ''}
                        onChange={createChangeHandler(index, 'default')}
                        placeholder='Default value'
                    />
                </CollapsibleSection>
            ))}

            <Container>
                <Button
                    variant='outline'
                    intent='neutral'
                    size='sm'
                    leftIcon={<TbPlus size={14} />}
                    onClick={addArgument}
                >
                    Add Argument
                </Button>
            </Container>
        </>
    );
};

export default ArgumentsEditor;
