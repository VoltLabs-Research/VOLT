import React, { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import useConfirm from '@/hooks/ui/use-confirm';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import { usePluginBuilderStore } from '@/stores/slices/plugin/builder-slice';
import Button from '@/components/primitives/Button';
import Container from '@/components/primitives/Container';
import { TbPlus } from 'react-icons/tb';
import type { IIfStatementData, ICondition, ConditionType, ConditionHandler } from '@/types/plugin';

interface IfStatementEditorProps {
    node: Node;
}

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

const IfStatementEditor: React.FC<IfStatementEditorProps> = ({ node }) => {
    const { confirm } = useConfirm();
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const ifStatementData = (node.data?.ifStatement || { conditions: [] }) as IIfStatementData;
    const conditions = ifStatementData.conditions || [];

    const updateCondition = useCallback((index: number, field: keyof ICondition, value: any) => {
        const updatedConditions = conditions.map((cond, i) =>
            i === index ? { ...cond, [field]: value } : cond
        );
        updateNodeData(node.id, { ifStatement: { conditions: updatedConditions } });
    }, [conditions, node.id, updateNodeData]);

    const addCondition = useCallback(() => {
        updateNodeData(node.id, {
            ifStatement: {
                conditions: [...conditions, { ...DEFAULT_CONDITION }]
            }
        });
    }, [conditions, node.id, updateNodeData]);

    const removeCondition = useCallback(async (index: number) => {
        if (!await confirm('Remove this condition?')) return;
        const updatedConditions = conditions.filter((_, i) => i !== index);
        updateNodeData(node.id, { ifStatement: { conditions: updatedConditions } });
    }, [conditions, node.id, updateNodeData, confirm]);

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
                            label='Combine with previous'
                            fieldKey='type'
                            fieldType='select'
                            fieldValue={condition.type}
                            onFieldChange={(_, value) => updateCondition(index, 'type', value)}
                            options={CONDITION_TYPE_OPTIONS}
                        />
                    )}

                    <FormField
                        label='Left Expression'
                        fieldKey='leftExpr'
                        fieldType='input'
                        fieldValue={condition.leftExpr}
                        onFieldChange={(_, value) => updateCondition(index, 'leftExpr', value)}
                        inputProps={{ placeholder: '{{ node-id.property }}' }}
                        expressionEnabled
                        expressionNodeId={node.id}
                    />

                    <FormField
                        label='Operator'
                        fieldKey='handler'
                        fieldType='select'
                        fieldValue={condition.handler}
                        onFieldChange={(_, value) => updateCondition(index, 'handler', value)}
                        options={CONDITION_HANDLER_OPTIONS}
                    />

                    <FormField
                        label='Right Expression'
                        fieldKey='rightExpr'
                        fieldType='input'
                        fieldValue={condition.rightExpr}
                        onFieldChange={(_, value) => updateCondition(index, 'rightExpr', value)}
                        inputProps={{ placeholder: '{{ node-id.expected }}' }}
                        expressionEnabled
                        expressionNodeId={node.id}
                    />
                </CollapsibleSection>
            ))}

            <Container style={{ marginTop: conditions.length > 0 ? '0.5rem' : 0 }}>
                <Button
                    variant='outline'
                    intent='neutral'
                    size='sm'
                    align='start'
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
