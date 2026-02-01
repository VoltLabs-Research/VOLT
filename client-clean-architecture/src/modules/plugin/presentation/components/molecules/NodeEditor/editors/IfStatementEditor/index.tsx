import { useCallback, useMemo, ChangeEvent } from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { TbPlus } from 'react-icons/tb';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import type { IIfStatementData, ICondition, ConditionType, ConditionHandler } from '@/modules/plugin/domain/entities';

interface IfStatementEditorProps {
    node: Node;
};

const CONDITION_TYPE_OPTIONS = [
    { value: 'and', title: 'AND' },
    { value: 'or', title: 'OR' }
];

const CONDITION_HANDLER_OPTIONS = [
    { value: 'is_equal_to', title: 'Is equal to' },
    { value: 'is_not_equal_to', title: 'Is not equal to' }
];

const DEFAULT_CONDITION: ICondition = {
    type: 'and' as ConditionType,
    leftExpr: '',
    handler: 'is_equal_to' as ConditionHandler,
    rightExpr: ''
};

const IfStatementEditor = ({ node }: IfStatementEditorProps) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);

    const conditions = useMemo(() => {
        const storeNode = storeNodes.find((n) => n.id === node.id);
        const nodeData = storeNode?.data || node.data;
        const ifStatementData = (nodeData?.ifStatement || { conditions: [] }) as IIfStatementData;
        return ifStatementData.conditions || [];
    }, [storeNodes, node.id, node.data]);

    const updateCondition = useCallback((index: number, field: keyof ICondition, value: unknown) => {
        const updatedConditions = conditions.map((cond, i) =>
            i === index ? { ...cond, [field]: value } : cond
        );
        updateNodeData(node.id, { ifStatement: { conditions: updatedConditions } });
    }, [conditions, node.id, updateNodeData]);

    const createChangeHandler = useCallback((index: number, field: keyof ICondition) => {
        return (e: ChangeEvent<HTMLInputElement>) => {
            updateCondition(index, field, e.target.value);
        };
    }, [updateCondition]);

    const addCondition = useCallback(() => {
        updateNodeData(node.id, {
            ifStatement: {
                conditions: [...conditions, { ...DEFAULT_CONDITION }]
            }
        });
    }, [conditions, node.id, updateNodeData]);

    const removeCondition = useCallback((index: number) => {
        const updatedConditions = conditions.filter((_, i) => i !== index);
        updateNodeData(node.id, { ifStatement: { conditions: updatedConditions } });
    }, [conditions, node.id, updateNodeData]);

    return (
        <>
            {conditions.map((condition, index) => (
                <CollapsibleSection
                    key={index}
                    title={`Condition ${index + 1}`}
                    defaultExpanded={index === 0}
                    onDelete={() => removeCondition(index)}
                >
                    {index > 0 && (
                        <FormField
                            variant='inline'
                            label='Combine with previous'
                            name='type'
                            fieldType='select'
                            value={condition.type}
                            onChange={createChangeHandler(index, 'type')}
                            options={CONDITION_TYPE_OPTIONS}
                        />
                    )}

                    <FormField
                        variant='inline'
                        label='Left Expression'
                        name='leftExpr'
                        fieldType='input'
                        value={condition.leftExpr}
                        onChange={createChangeHandler(index, 'leftExpr')}
                        placeholder='{{ node-id.property }}'
                    />

                    <FormField
                        variant='inline'
                        label='Operator'
                        name='handler'
                        fieldType='select'
                        value={condition.handler}
                        onChange={createChangeHandler(index, 'handler')}
                        options={CONDITION_HANDLER_OPTIONS}
                    />

                    <FormField
                        variant='inline'
                        label='Right Expression'
                        name='rightExpr'
                        fieldType='input'
                        value={condition.rightExpr}
                        onChange={createChangeHandler(index, 'rightExpr')}
                        placeholder='{{ node-id.expected }}'
                    />
                </CollapsibleSection>
            ))}

            <Container style={{ marginTop: conditions.length > 0 ? '0.5rem' : 0 }}>
                <Button
                    variant='outline'
                    intent='neutral'
                    size='sm'
                    leftIcon={<TbPlus size={14} />}
                    onClick={addCondition}
                >
                    Add Condition
                </Button>
            </Container>
        </>
    );
};

export default IfStatementEditor;
