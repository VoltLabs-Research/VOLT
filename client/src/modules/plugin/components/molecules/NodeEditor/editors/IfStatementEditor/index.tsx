import { useCallback } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { Plus } from 'lucide-react';
import useNodeCollectionForm from '@/modules/plugin/hooks/use-node-collection-form';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/use-node-reference-autocomplete';
import type { ICondition } from '@/modules/plugin/api/entities/workflow';
import type { ConditionType, ConditionHandler } from '@/modules/plugin/api/entities/workflow-enums';
import type { EditorProps } from '../types';

const CONDITION_TYPE_OPTIONS = [
    { value: 'and', title: 'AND' },
    { value: 'or', title: 'OR' }
];

const CONDITION_HANDLER_OPTIONS = [
    { value: 'is_equal_to', title: 'Is equal to' },
    { value: 'is_not_equal_to', title: 'Is not equal to' }
];

const createDefaultCondition = (): ICondition => ({
    type: 'and' as ConditionType,
    leftExpr: '',
    handler: 'is_equal_to' as ConditionHandler,
    rightExpr: ''
});

const IfStatementEditor = ({ node }: EditorProps) => {
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);
    const {
        items: conditions,
        addItem,
        removeItem,
        createFieldHandler
    } = useNodeCollectionForm<ICondition>(
        node,
        'ifStatement',
        'conditions',
        createDefaultCondition
    );

    const getConditionTitle = useCallback((_: ICondition, index: number) => {
        return `Condition ${index + 1}`;
    }, []);

    return (
        <>
            {conditions.map((condition, index) => (
                <CollapsibleSection
                    key={index}
                    title={getConditionTitle(condition, index)}
                    defaultExpanded={index === 0}
                    onDelete={() => removeItem(index)}
                >
                    {index > 0 && (
                        <FormFieldRHF
                            variant='inline'
                            label='Combine with previous'
                            name='type'
                            fieldType='select'
                            value={condition.type}
                            onChange={createFieldHandler(index, 'type')}
                            options={CONDITION_TYPE_OPTIONS}
                        />
                    )}

                    <FormFieldRHF
                        variant='inline'
                        label='Left Expression'
                        name='leftExpr'
                        fieldType='input'
                        value={condition.leftExpr}
                        onChange={createFieldHandler(index, 'leftExpr')}
                        placeholder='{{ node-id.property }}'
                        autocomplete={{ options: nodeReferenceOptions }}
                    />

                    <FormFieldRHF
                        variant='inline'
                        label='Operator'
                        name='handler'
                        fieldType='select'
                        value={condition.handler}
                        onChange={createFieldHandler(index, 'handler')}
                        options={CONDITION_HANDLER_OPTIONS}
                    />

                    <FormFieldRHF
                        variant='inline'
                        label='Right Expression'
                        name='rightExpr'
                        fieldType='input'
                        value={condition.rightExpr}
                        onChange={createFieldHandler(index, 'rightExpr')}
                        placeholder='{{ node-id.expected }}'
                        autocomplete={{ options: nodeReferenceOptions }}
                    />
                </CollapsibleSection>
            ))}

            <Container style={{ marginTop: conditions.length > 0 ? '0.5rem' : 0 }}>
                <Button
                    variant='outline'
                    intent='neutral'
                    size='sm'
                    className='w-max'
                    leftIcon={<Plus size={14} />}
                    onClick={addItem}
                >
                    Add Condition
                </Button>
            </Container>
        </>
    );
};

export default IfStatementEditor;
