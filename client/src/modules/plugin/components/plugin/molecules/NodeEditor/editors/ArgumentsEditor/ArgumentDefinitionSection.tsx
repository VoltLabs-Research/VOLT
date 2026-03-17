import { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import {
    createDefaultArgumentDefinition,
    isPluginReferenceArgumentType
} from '@/modules/plugin/utilities/plugin/argument-values';
import { ARGUMENT_TYPE_OPTIONS } from '@/modules/plugin/utilities/plugin/node-registry';
import Button from '@/shared/presentation/components/Button';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { Plus, Trash2 } from 'lucide-react';
import { useCallback, type ChangeEvent } from 'react';
import type { IArgumentDefinition, IArgumentOption } from '@/modules/plugin/api/entities/plugin/workflow';

interface ArgumentDefinitionSectionProps {
    arguments: IArgumentDefinition[];
    onAddArgument: () => void;
    onRemoveArgument: (index: number) => void;
    onUpdateArgument: (index: number, nextArgument: IArgumentDefinition) => void;
    level?: number;
};

const ARGUMENT_TYPE_SELECT_OPTIONS = ARGUMENT_TYPE_OPTIONS.map((option) => ({
    value: option.value,
    title: option.label
}));

const getArgumentTitle = (argument: IArgumentDefinition, index: number): string => {
    return argument.label || argument.argument || `Argument ${index + 1}`;
};

const getDefaultValueInputValue = (argument: IArgumentDefinition): string => {
    if (argument.default === undefined || argument.default === null) {
        return '';
    }

    if (typeof argument.default === 'string') {
        return argument.default;
    }

    if (typeof argument.default === 'number' || typeof argument.default === 'boolean') {
        return String(argument.default);
    }

    try {
        return JSON.stringify(argument.default);
    } catch {
        return '';
    }
};

const getArgumentType = (value: string): ArgumentType => {
    const resolvedType = Object.values(ArgumentType).find((type) => type === value);
    return resolvedType ?? ArgumentType.STRING;
};

const ArgumentDefinitionSection = ({
    arguments: argumentDefinitions,
    onAddArgument,
    onRemoveArgument,
    onUpdateArgument,
    level = 0
}: ArgumentDefinitionSectionProps) => {
    const handleArgumentChange = useCallback((index: number, nextArgument: IArgumentDefinition) => {
        onUpdateArgument(index, nextArgument);
    }, [onUpdateArgument]);

    const handleAddOption = useCallback((argumentIndex: number) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const currentOptions = currentArgument.options ?? [];
        const nextOption: IArgumentOption = {
            key: '',
            label: ''
        };

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            options: [...currentOptions, nextOption]
        });
    }, [argumentDefinitions, handleArgumentChange]);

    const handleRemoveOption = useCallback((argumentIndex: number, optionIndex: number) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const currentOptions = currentArgument.options ?? [];

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            options: currentOptions.filter((_, index) => index !== optionIndex)
        });
    }, [argumentDefinitions, handleArgumentChange]);

    const handleOptionChange = useCallback((
        argumentIndex: number,
        optionIndex: number,
        field: keyof IArgumentOption,
        value: string
    ) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const currentOptions = currentArgument.options ?? [];
        const nextOptions = currentOptions.map((option, index) => {
            if (index !== optionIndex) {
                return option;
            }

            return {
                ...option,
                [field]: value
            };
        });

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            options: nextOptions
        });
    }, [argumentDefinitions, handleArgumentChange]);

    const createArgumentFieldHandler = useCallback((argumentIndex: number, field: keyof IArgumentDefinition) => {
        return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const nextValue = event.target.value;
            const currentArgument = argumentDefinitions[argumentIndex];

            if (field === 'type') {
                const nextType = getArgumentType(nextValue);
                const nextArgument: IArgumentDefinition = {
                    ...currentArgument,
                    type: nextType
                };

                if (nextType !== ArgumentType.SELECT) {
                    delete nextArgument.options;
                }

                if (nextType !== ArgumentType.LIST) {
                    delete nextArgument.listArguments;
                    if (Array.isArray(nextArgument.default)) {
                        delete nextArgument.default;
                    }
                }

                if (nextType === ArgumentType.LIST && !nextArgument.listArguments) {
                    nextArgument.listArguments = [];
                }

                if (isPluginReferenceArgumentType(nextType)) {
                    delete nextArgument.options;
                    delete nextArgument.min;
                    delete nextArgument.max;
                    delete nextArgument.step;
                    delete nextArgument.listArguments;
                }

                if (!isPluginReferenceArgumentType(nextType)) {
                    delete nextArgument.pluginReferenceFilter;
                }

                if (nextType !== ArgumentType.NUMBER) {
                    delete nextArgument.min;
                    delete nextArgument.max;
                    delete nextArgument.step;
                }

                handleArgumentChange(argumentIndex, nextArgument);
                return;
            }

            if (field === 'min' || field === 'max' || field === 'step') {
                handleArgumentChange(argumentIndex, {
                    ...currentArgument,
                    [field]: nextValue === '' ? undefined : Number(nextValue)
                });
                return;
            }

            if (field === 'default') {
                let parsedDefault: unknown = nextValue === '' ? undefined : nextValue;
                if (currentArgument.type === ArgumentType.BOOLEAN) {
                    parsedDefault = nextValue === 'true';
                }
                if (currentArgument.type === ArgumentType.NUMBER) {
                    parsedDefault = nextValue === '' ? undefined : Number(nextValue);
                }

                handleArgumentChange(argumentIndex, {
                    ...currentArgument,
                    default: parsedDefault
                });
                return;
            }

            handleArgumentChange(argumentIndex, {
                ...currentArgument,
                [field]: nextValue
            });
        };
    }, [argumentDefinitions, handleArgumentChange]);

    const createOptionFieldHandler = useCallback((
        argumentIndex: number,
        optionIndex: number,
        field: keyof IArgumentOption
    ) => {
        return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            handleOptionChange(argumentIndex, optionIndex, field, event.target.value);
        };
    }, [handleOptionChange]);

    const handleNestedArgumentAdd = useCallback((argumentIndex: number) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nestedArguments = currentArgument.listArguments ?? [];

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            listArguments: [...nestedArguments, createDefaultArgumentDefinition()]
        });
    }, [argumentDefinitions, handleArgumentChange]);

    const handleNestedArgumentRemove = useCallback((argumentIndex: number, nestedIndex: number) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nestedArguments = currentArgument.listArguments ?? [];

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            listArguments: nestedArguments.filter((_, index) => index !== nestedIndex)
        });
    }, [argumentDefinitions, handleArgumentChange]);

    const handleNestedArgumentUpdate = useCallback((
        argumentIndex: number,
        nestedIndex: number,
        nextNestedArgument: IArgumentDefinition
    ) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nestedArguments = currentArgument.listArguments ?? [];
        const nextNestedArguments = nestedArguments.map((nestedArgument, index) => {
            if (index !== nestedIndex) {
                return nestedArgument;
            }

            return nextNestedArgument;
        });

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            listArguments: nextNestedArguments
        });
    }, [argumentDefinitions, handleArgumentChange]);

    return (
        <Container className='d-flex column gap-05'>
            {argumentDefinitions.map((argument, index) => (
                <CollapsibleSection
                    key={`${level}-${index}`}
                    title={getArgumentTitle(argument, index)}
                    defaultExpanded={index === 0}
                    onDelete={() => onRemoveArgument(index)}
                >
                    <FormFieldRHF
                        variant='inline'
                        label='Argument Key'
                        name={`argument-${level}-${index}`}
                        fieldType='input'
                        value={argument.argument}
                        onChange={createArgumentFieldHandler(index, 'argument')}
                        placeholder='my_argument'
                    />
                    <FormFieldRHF
                        variant='inline'
                        label='Label'
                        name={`label-${level}-${index}`}
                        fieldType='input'
                        value={argument.label}
                        onChange={createArgumentFieldHandler(index, 'label')}
                        placeholder='My Argument'
                    />
                    <FormFieldRHF
                        variant='inline'
                        label='Type'
                        name={`type-${level}-${index}`}
                        fieldType='select'
                        value={argument.type}
                        onChange={createArgumentFieldHandler(index, 'type')}
                        options={ARGUMENT_TYPE_SELECT_OPTIONS}
                    />

                    {argument.type === ArgumentType.NUMBER && (
                        <>
                            <FormFieldRHF
                                variant='inline'
                                label='Min'
                                name={`min-${level}-${index}`}
                                fieldType='input'
                                value={argument.min ?? ''}
                                onChange={createArgumentFieldHandler(index, 'min')}
                                placeholder='0'
                                inputProps={{ type: 'number' }}
                            />
                            <FormFieldRHF
                                variant='inline'
                                label='Max'
                                name={`max-${level}-${index}`}
                                fieldType='input'
                                value={argument.max ?? ''}
                                onChange={createArgumentFieldHandler(index, 'max')}
                                placeholder='100'
                                inputProps={{ type: 'number' }}
                            />
                            <FormFieldRHF
                                variant='inline'
                                label='Step'
                                name={`step-${level}-${index}`}
                                fieldType='input'
                                value={argument.step ?? ''}
                                onChange={createArgumentFieldHandler(index, 'step')}
                                placeholder='1'
                                inputProps={{ type: 'number' }}
                            />
                        </>
                    )}

                    {argument.type === ArgumentType.SELECT && (
                        <Container className='d-flex column gap-05 mt-05'>
                            <Paragraph className='font-size-085 font-bold'>Options</Paragraph>
                            {(argument.options ?? []).map((option, optionIndex) => (
                                <Container key={optionIndex} className='d-flex items-center gap-05'>
                                    <FormFieldRHF
                                        variant='inline'
                                        label='Key'
                                        name={`option-key-${level}-${index}-${optionIndex}`}
                                        fieldType='input'
                                        value={option.key}
                                        onChange={createOptionFieldHandler(index, optionIndex, 'key')}
                                        placeholder='option_key'
                                    />
                                    <FormFieldRHF
                                        variant='inline'
                                        label='Label'
                                        name={`option-label-${level}-${index}-${optionIndex}`}
                                        fieldType='input'
                                        value={option.label}
                                        onChange={createOptionFieldHandler(index, optionIndex, 'label')}
                                        placeholder='Option Label'
                                    />
                                    <IconButton
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => handleRemoveOption(index, optionIndex)}
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

                    {argument.type === ArgumentType.LIST && (
                        <Container className='d-flex column gap-05 mt-05'>
                            <Paragraph className='font-size-085 font-bold'>Nested Arguments</Paragraph>
                            <ArgumentDefinitionSection
                                arguments={argument.listArguments ?? []}
                                onAddArgument={() => handleNestedArgumentAdd(index)}
                                onRemoveArgument={(nestedIndex) => handleNestedArgumentRemove(index, nestedIndex)}
                                onUpdateArgument={(nestedIndex, nextNestedArgument) => handleNestedArgumentUpdate(index, nestedIndex, nextNestedArgument)}
                                level={level + 1}
                            />
                        </Container>
                    )}

                    {isPluginReferenceArgumentType(argument.type) && (
                        <FormFieldRHF
                            variant='inline'
                            label='Allowed Plugin IDs'
                            name={`plugin-reference-filter-${level}-${index}`}
                            fieldType='input'
                            value={(argument.pluginReferenceFilter ?? []).join(',')}
                            onChange={(event) => {
                                const pluginReferenceFilter = event.target.value
                                    .split(',')
                                    .map((value) => value.trim())
                                    .filter(Boolean);

                                handleArgumentChange(index, {
                                    ...argument,
                                    pluginReferenceFilter: pluginReferenceFilter.length > 0
                                        ? pluginReferenceFilter
                                        : undefined
                                });
                            }}
                            placeholder='plugin-id-1,plugin-id-2'
                        />
                    )}

                    {argument.type !== ArgumentType.LIST && !isPluginReferenceArgumentType(argument.type) && (
                        <FormFieldRHF
                            variant='inline'
                            label='Default Value'
                            name={`default-${level}-${index}`}
                            fieldType='input'
                            value={getDefaultValueInputValue(argument)}
                            onChange={createArgumentFieldHandler(index, 'default')}
                            placeholder='Default value'
                        />
                    )}
                </CollapsibleSection>
            ))}

            <Container>
                <Button
                    variant='outline'
                    intent='neutral'
                    size='sm'
                    className='w-max'
                    leftIcon={<Plus size={14} />}
                    onClick={onAddArgument}
                >
                    Add Argument
                </Button>
            </Container>
        </Container>
    );
};

export default ArgumentDefinitionSection;
