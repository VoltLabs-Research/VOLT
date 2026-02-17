import { useCallback } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { Plus } from 'lucide-react';
import { useNodeCollectionForm } from '@/modules/plugin/presentation/hooks';
import type { ICondition, ConditionType, ConditionHandler } from '@/modules/plugin/domain/entities';
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
                        <FormField
                            variant='inline'
                            label='Combine with previous'
                            name='type'
                            fieldType='select'
                            value={condition.type}
                            onChange={createFieldHandler(index, 'type')}
                            options={CONDITION_TYPE_OPTIONS}
                        />
                    )}

                    <FormField
                        variant='inline'
                        label='Left Expression'
                        name='leftExpr'
                        fieldType='input'
                        value={condition.leftExpr}
                        onChange={createFieldHandler(index, 'leftExpr')}
                        placeholder='{{ node-id.property }}'
                    />

                    <FormField
                        variant='inline'
                        label='Operator'
                        name='handler'
                        fieldType='select'
                        value={condition.handler}
                        onChange={createFieldHandler(index, 'handler')}
                        options={CONDITION_HANDLER_OPTIONS}
                    />

                    <FormField
                        variant='inline'
                        label='Right Expression'
                        name='rightExpr'
                        fieldType='input'
                        value={condition.rightExpr}
                        onChange={createFieldHandler(index, 'rightExpr')}
                        placeholder='{{ node-id.expected }}'
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
