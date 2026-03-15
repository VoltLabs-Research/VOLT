import { buildDeleteConditionConfirmOptions } from '@/modules/plugin/utilities/plugin/destructive-action-options';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import useConfirm from '@/shared/presentation/hooks/use-confirm';
import useNodeCollectionForm from '@/modules/plugin/hooks/plugin/use-node-collection-form';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import { Plus } from 'lucide-react';
import { useCallback, useId } from 'react';
import type { ICondition } from '@/modules/plugin/api/entities/plugin/workflow';
import { ConditionHandler, ConditionType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { EditorProps } from '../types';

interface ConditionOption {
    value: ConditionHandler | ConditionType;
    title: string;
};

const CONDITION_TYPE_OPTIONS: ConditionOption[] = [
    { value: ConditionType.AND, title: 'AND' },
    { value: ConditionType.OR, title: 'OR' }
];

const CONDITION_HANDLER_OPTIONS: ConditionOption[] = [
    { value: ConditionHandler.IS_EQUAL_TO, title: 'Is equal to' },
    { value: ConditionHandler.IS_NOT_EQUAL_TO, title: 'Is not equal to' }
];

const createDefaultCondition = (): ICondition => ({
    type: ConditionType.AND,
    leftExpr: '',
    handler: ConditionHandler.IS_EQUAL_TO,
    rightExpr: ''
});

const IfStatementEditor = ({ node }: EditorProps) => {
    const { confirm } = useConfirm();
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);
    const guidanceId = useId();
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

    const handleDeleteCondition = useCallback(async (index: number) => {
        const isConfirmed = await confirm(buildDeleteConditionConfirmOptions(index));

        if (!isConfirmed) {
            return;
        }

        removeItem(index);
    }, [confirm, removeItem]);

    let guidanceText = 'Add at least one comparison. The True branch runs when your conditions match; otherwise the False branch runs.';
    if (conditions.length === 1) {
        guidanceText = 'This node checks one comparison. When it matches, the True branch runs. When it does not, the False branch runs.';
    }

    if (conditions.length > 1) {
        guidanceText = 'Conditions are checked from top to bottom. Use AND to require this condition together with the previous ones. Use OR to let either side keep the True branch active.';
    }

    return (
        <>
            <Container className='if-statement-editor-guidance d-flex column gap-05 p-1 radius-sm' role='note'>
                <Paragraph id={guidanceId} className='font-size-1 color-secondary m-0'>
                    {guidanceText}
                </Paragraph>
                <Container className='d-flex column gap-025'>
                    <Paragraph className='font-size-1 color-secondary m-0'>True branch: continues when the condition set matches.</Paragraph>
                    <Paragraph className='font-size-1 color-secondary m-0'>False branch: continues when the condition set does not match.</Paragraph>
                </Container>
            </Container>

            {conditions.length === 0 && (
                <Container className='if-statement-editor-empty-state d-flex column gap-05 p-1 radius-sm' role='status' aria-live='polite'>
                    <Paragraph className='font-size-2 font-weight-6 m-0'>No conditions yet</Paragraph>
                    <Paragraph className='font-size-1 color-secondary m-0'>Start with a left expression, choose an operator, then compare it to a right expression.</Paragraph>
                </Container>
            )}

            {conditions.map((condition, index) => (
                <CollapsibleSection
                    key={index}
                    title={getConditionTitle(condition, index)}
                    defaultExpanded={index === 0}
                    onDelete={() => {
                        handleDeleteCondition(index);
                    }}
                    deleteActionLabel={`Delete condition ${index + 1}`}
                    deleteActionAlwaysVisible
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
                            inputProps={{
                                'aria-describedby': guidanceId
                            }}
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
                        inputProps={{
                            'aria-describedby': guidanceId
                        }}
                    />

                    <FormFieldRHF
                        variant='inline'
                        label='Operator'
                        name='handler'
                        fieldType='select'
                        value={condition.handler}
                        onChange={createFieldHandler(index, 'handler')}
                        options={CONDITION_HANDLER_OPTIONS}
                        inputProps={{
                            'aria-describedby': guidanceId
                        }}
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
                        inputProps={{
                            'aria-describedby': guidanceId
                        }}
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
