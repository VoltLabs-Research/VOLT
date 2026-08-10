import { Button } from '@heroui/react';
import CollapsibleSection from '@/modules/plugin/components/plugin/CollapsibleSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Plus } from 'lucide-react';
import useNodeCollectionForm from '@/modules/plugin/hooks/plugin/use-node-collection-form';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import type { ICondition } from '@volt/contracts/modules/plugin/workflow';
import type { ConditionType, ConditionHandler } from '@volt/contracts/modules/plugin/enums';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';

const CONDITION_TYPE_OPTIONS = [
    {
        value: 'and',
        title: 'AND'
    },
    {
        value: 'or',
        title: 'OR'
    }
];

const CONDITION_HANDLER_OPTIONS = [
    {
        value: 'is_equal_to',
        title: 'Is equal to'
    },
    {
        value: 'is_not_equal_to',
        title: 'Is not equal to'
    }
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

    return (
        <>
            {conditions.map((condition, index) => (
                <CollapsibleSection
                    key={index}
                    title={`Condition ${index + 1}`}
                    defaultExpanded={index === 0}
                    onDelete={() => removeItem(index)}
                    deleteActionLabel={`Delete condition ${index + 1}`}
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

            <div className={conditions.length > 0 ? 'mt-2' : 'mt-0'}>
                <Button
                    variant='outline'
                    size='sm'
                    fullWidth
                    onPress={addItem}
                >
                    <Plus size={14} aria-hidden='true' />
                    Add Condition
                </Button>
            </div>
        </>
    );
};

export default IfStatementEditor;
