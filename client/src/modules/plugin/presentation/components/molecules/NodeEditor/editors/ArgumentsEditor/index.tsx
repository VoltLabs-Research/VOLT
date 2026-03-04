import { useCallback, type ChangeEvent } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import IconButton from '@/shared/presentation/components/IconButton';
import { Plus, Trash2 } from 'lucide-react';
import { useNodeCollectionForm } from '@/modules/plugin/presentation/hooks';
import { ARGUMENT_TYPE_OPTIONS } from '@/modules/plugin/presentation/utilities/node-types';
import { ArgumentType } from '@/modules/plugin/domain/entities';
import type { IArgumentDefinition, IArgumentOption } from '@/modules/plugin/domain/entities';
import type { EditorProps } from '../types';

const ARGUMENT_TYPE_SELECT_OPTIONS = ARGUMENT_TYPE_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const createDefaultArgument = (): IArgumentDefinition => ({
    argument: '',
    type: ArgumentType.STRING,
    label: ''
});

const ArgumentsEditor = ({ node }: EditorProps) => {
    const {
        items: args,
        addItem,
        removeItem,
        updateItem,
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

    const handleAddOption = useCallback((argIndex: number) => {
        const currentOptions = args[argIndex].options ?? [];
        const newOption: IArgumentOption = { key: '', label: '' };
        updateItem(argIndex, 'options', [...currentOptions, newOption]);
    }, [args, updateItem]);

    const handleRemoveOption = useCallback((argIndex: number, optionIndex: number) => {
        const currentOptions = args[argIndex].options ?? [];
        updateItem(argIndex, 'options', currentOptions.filter((_, i) => i !== optionIndex));
    }, [args, updateItem]);

    const handleOptionChange = useCallback((
        argIndex: number,
        optionIndex: number,
        field: keyof IArgumentOption,
        value: string
    ) => {
        const currentOptions = args[argIndex].options ?? [];
        const updatedOptions = currentOptions.map((opt, i) => {
            if (i !== optionIndex) return opt;
            return { ...opt, [field]: value };
        });
        updateItem(argIndex, 'options', updatedOptions);
    }, [args, updateItem]);

    const createOptionFieldHandler = useCallback((
        argIndex: number,
        optionIndex: number,
        field: keyof IArgumentOption
    ) => {
        return (e: ChangeEvent<HTMLInputElement>) => {
            handleOptionChange(argIndex, optionIndex, field, e.target.value);
        };
    }, [handleOptionChange]);

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

                    {arg.type === ArgumentType.NUMBER && (
                        <>
                            <FormField
                                variant='inline'
                                label='Min'
                                name='min'
                                fieldType='input'
                                value={arg.min ?? ''}
                                onChange={createFieldHandler(index, 'min')}
                                placeholder='0'
                                inputProps={{ type: 'number' }}
                            />
                            <FormField
                                variant='inline'
                                label='Max'
                                name='max'
                                fieldType='input'
                                value={arg.max ?? ''}
                                onChange={createFieldHandler(index, 'max')}
                                placeholder='100'
                                inputProps={{ type: 'number' }}
                            />
                            <FormField
                                variant='inline'
                                label='Step'
                                name='step'
                                fieldType='input'
                                value={arg.step ?? ''}
                                onChange={createFieldHandler(index, 'step')}
                                placeholder='1'
                                inputProps={{ type: 'number' }}
                            />
                        </>
                    )}

                    {arg.type === ArgumentType.SELECT && (
                        <Container className='d-flex column gap-05 mt-05'>
                            <Paragraph className='font-size-085 font-bold'>Options</Paragraph>
                            {(arg.options ?? []).map((option, optIndex) => (
                                <Container key={optIndex} className='d-flex items-center gap-05'>
                                    <FormField
                                        variant='inline'
                                        label='Key'
                                        name={`option-key-${optIndex}`}
                                        fieldType='input'
                                        value={option.key}
                                        onChange={createOptionFieldHandler(index, optIndex, 'key')}
                                        placeholder='option_key'
                                    />
                                    <FormField
                                        variant='inline'
                                        label='Label'
                                        name={`option-label-${optIndex}`}
                                        fieldType='input'
                                        value={option.label}
                                        onChange={createOptionFieldHandler(index, optIndex, 'label')}
                                        placeholder='Option Label'
                                    />
                                    <IconButton
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => handleRemoveOption(index, optIndex)}
                                        aria-label='Remove option'
                                    >
                                        <Trash2 size={14} />
                                    </IconButton>
                                </Container>
                            ))}
                            <Button
                                variant='outline'
                                intent='neutral'
                                size='sm'
                                leftIcon={<Plus size={12} />}
                                onClick={() => handleAddOption(index)}
                            >
                                Add Option
                            </Button>
                        </Container>
                    )}

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
