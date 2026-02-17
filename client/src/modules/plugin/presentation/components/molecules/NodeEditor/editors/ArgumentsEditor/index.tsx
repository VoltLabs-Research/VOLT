import { useCallback } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { Plus } from 'lucide-react';
import { useNodeCollectionForm } from '@/modules/plugin/presentation/hooks';
import { ARGUMENT_TYPE_OPTIONS } from '@/modules/plugin/presentation/utilities/node-types';
import type { IArgumentDefinition, ArgumentType } from '@/modules/plugin/domain/entities';
import type { EditorProps } from '../types';

const ARGUMENT_TYPE_SELECT_OPTIONS = ARGUMENT_TYPE_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const createDefaultArgument = (): IArgumentDefinition => ({
    argument: '',
    type: 'string' as ArgumentType,
    label: ''
});

const ArgumentsEditor = ({ node }: EditorProps) => {
    const {
        items: args,
        addItem,
        removeItem,
        createFieldHandler
    } = useNodeCollectionForm<IArgumentDefinition>(
        node,
        'arguments',
        'arguments',
        createDefaultArgument
    );

    const getArgumentTitle = useCallback((arg: IArgumentDefinition, index: number) => {
        return arg.label || arg.argument || `Argument ${index + 1}`;
    }, []);

    return (
        <>
            {args.map((arg, index) => (
                <CollapsibleSection
                    key={index}
                    title={getArgumentTitle(arg, index)}
                    defaultExpanded={index === 0}
                    onDelete={() => removeItem(index)}
                >
                    <FormField
                        variant='inline'
                        label='Argument Key'
                        name='argument'
                        fieldType='input'
                        value={arg.argument}
                        onChange={createFieldHandler(index, 'argument')}
                        placeholder='my_argument'
                    />
                    <FormField
                        variant='inline'
                        label='Label'
                        name='label'
                        fieldType='input'
                        value={arg.label}
                        onChange={createFieldHandler(index, 'label')}
                        placeholder='My Argument'
                    />
                    <FormField
                        variant='inline'
                        label='Type'
                        name='type'
                        fieldType='select'
                        value={arg.type}
                        onChange={createFieldHandler(index, 'type')}
                        options={ARGUMENT_TYPE_SELECT_OPTIONS}
                    />
                    <FormField
                        variant='inline'
                        label='Default Value'
                        name='default'
                        fieldType='input'
                        value={arg.default as string ?? ''}
                        onChange={createFieldHandler(index, 'default')}
                        placeholder='Default value'
                    />
                </CollapsibleSection>
            ))}

            <Container>
                <Button
                    variant='outline'
                    intent='neutral'
                    size='sm'
                    className='w-max'
                    leftIcon={<Plus size={14} />}
                    onClick={addItem}
                >
                    Add Argument
                </Button>
            </Container>
        </>
    );
};

export default ArgumentsEditor;
