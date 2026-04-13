import {
    ArgumentType,
    ArgumentVisibilityOperator
} from '@/modules/plugin/api/entities/plugin/workflow-enums';
import {
    createDefaultArgumentDefinition,
    isPluginReferenceArgumentType
} from '@/modules/plugin/utilities/plugin/argument-values';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { ARGUMENT_TYPE_OPTIONS } from '@/modules/plugin/utilities/plugin/node-registry';
import Button from '@/shared/presentation/components/Button';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type {
    IArgumentDefinition,
    IArgumentOption,
    IArgumentVisibilityCondition
} from '@/modules/plugin/api/entities/plugin/workflow';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { ChangeEvent } from 'react';

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

const ARGUMENT_VISIBILITY_OPERATOR_OPTIONS = [{
    value: ArgumentVisibilityOperator.EQUALS,
    title: 'Equals'
}, {
    value: ArgumentVisibilityOperator.NOT_EQUALS,
    title: 'Does not equal'
}, {
    value: ArgumentVisibilityOperator.IN,
    title: 'Matches any of'
}, {
    value: ArgumentVisibilityOperator.NOT_IN,
    title: 'Matches none of'
}];

const BOOLEAN_ARGUMENT_VALUE_OPTIONS: SelectOption[] = [{
    value: '',
    title: 'Unset'
}, {
    value: 'true',
    title: 'true'
}, {
    value: 'false',
    title: 'false'
}];

const isMultiValueVisibilityOperator = (
    operator?: ArgumentVisibilityOperator
): boolean => {
    return operator === ArgumentVisibilityOperator.IN || operator === ArgumentVisibilityOperator.NOT_IN;
};

const getArgumentTitle = (argument: IArgumentDefinition, index: number): string => {
    return argument.label || argument.argument || `Argument ${index + 1}`;
};

const getArgumentFieldInputValue = (
    argument: IArgumentDefinition,
    field: 'default' | 'value'
): string => {
    const fieldValue = argument[field];
    if (fieldValue === undefined || fieldValue === null) {
        return '';
    }

    if (typeof fieldValue === 'string') {
        return fieldValue;
    }

    if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
        return String(fieldValue);
    }

    try {
        return JSON.stringify(fieldValue);
    } catch {
        return '';
    }
};

const parseScalarArgumentFieldValue = (
    argument: IArgumentDefinition,
    rawValue: string
): unknown => {
    if (rawValue === '') {
        return undefined;
    }

    if (argument.type === ArgumentType.BOOLEAN) {
        return rawValue === 'true';
    }

    if (argument.type === ArgumentType.NUMBER) {
        return Number(rawValue);
    }

    return rawValue;
};

const getArgumentType = (value: string): ArgumentType => {
    const resolvedType = Object.values(ArgumentType).find((type) => type === value);
    return resolvedType ?? ArgumentType.STRING;
};

const getVisibilityOperator = (value: string): ArgumentVisibilityOperator => {
    const resolvedOperator = Object.values(ArgumentVisibilityOperator).find((operator) => operator === value);
    return resolvedOperator ?? ArgumentVisibilityOperator.EQUALS;
};

const normalizeVisibilityComparisonValue = (
    rawValue: string,
    referenceArgument?: IArgumentDefinition
): string | number | boolean | undefined => {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue.length) {
        return undefined;
    }

    if (referenceArgument?.type === ArgumentType.NUMBER) {
        const parsedValue = Number(trimmedValue);
        return Number.isFinite(parsedValue) ? parsedValue : undefined;
    }

    if (referenceArgument?.type === ArgumentType.BOOLEAN) {
        return trimmedValue === 'true';
    }

    return trimmedValue;
};

const getVisibilityValueInput = (condition?: IArgumentVisibilityCondition): string => {
    if (!condition) {
        return '';
    }

    if (isMultiValueVisibilityOperator(condition.operator)) {
        return (condition.values ?? []).map(String).join(', ');
    }

    if (condition.value === undefined) {
        return '';
    }

    return String(condition.value);
};

const ArgumentDefinitionSection = ({
    arguments: argumentDefinitions,
    onAddArgument,
    onRemoveArgument,
    onUpdateArgument,
    level = 0
}: ArgumentDefinitionSectionProps) => {
    const { publishedPlugins } = usePluginSelectors();
    const handleArgumentChange = useCallback((index: number, nextArgument: IArgumentDefinition) => {
        onUpdateArgument(index, nextArgument);
    }, [onUpdateArgument]);
    const allowedPluginOptions = useMemo<SelectOption[]>(() => {
        return publishedPlugins.map((plugin) => ({
            value: plugin._id,
            title: plugin.modifier?.name?.trim() || plugin._id
        }));
    }, [publishedPlugins]);

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

                if (nextType !== ArgumentType.SELECT && !isPluginReferenceArgumentType(nextType)) {
                    delete nextArgument.multipleSelection;
                }

                if (nextType !== ArgumentType.LIST) {
                    delete nextArgument.listArguments;
                    if (Array.isArray(nextArgument.default)) {
                        delete nextArgument.default;
                    }
                    if (Array.isArray(nextArgument.value)) {
                        delete nextArgument.value;
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
                    delete nextArgument.value;
                }

                if (!isPluginReferenceArgumentType(nextType)) {
                    delete nextArgument.pluginReferenceFilter;
                    delete nextArgument.showPluginConfiguration;
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

            if (field === 'multipleSelection' || field === 'showPluginConfiguration') {
                handleArgumentChange(argumentIndex, {
                    ...currentArgument,
                    [field]: nextValue === 'true'
                });
                return;
            }

            if (field === 'default' || field === 'value') {
                handleArgumentChange(argumentIndex, {
                    ...currentArgument,
                    [field]: parseScalarArgumentFieldValue(currentArgument, nextValue)
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

    const handleVisibilityEnabledChange = useCallback((argumentIndex: number, enabled: boolean) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nextArgument: IArgumentDefinition = {
            ...currentArgument
        };

        if (!enabled) {
            delete nextArgument.visibleWhen;
            handleArgumentChange(argumentIndex, nextArgument);
            return;
        }

        const fallbackReference = argumentDefinitions.find((candidate, index) => {
            return index !== argumentIndex && candidate.argument.trim().length > 0;
        });

        nextArgument.visibleWhen = {
            argument: fallbackReference?.argument ?? '',
            operator: ArgumentVisibilityOperator.EQUALS
        };

        handleArgumentChange(argumentIndex, nextArgument);
    }, [argumentDefinitions, handleArgumentChange]);

    const handleVisibilityArgumentChange = useCallback((argumentIndex: number, value: string) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const currentVisibility = currentArgument.visibleWhen;
        if (!currentVisibility) {
            return;
        }

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            visibleWhen: {
                ...currentVisibility,
                argument: value
            }
        });
    }, [argumentDefinitions, handleArgumentChange]);

    const handleVisibilityOperatorChange = useCallback((argumentIndex: number, value: string) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const currentVisibility = currentArgument.visibleWhen;
        if (!currentVisibility) {
            return;
        }

        const nextOperator = getVisibilityOperator(value);
        const nextVisibility: IArgumentVisibilityCondition = {
            argument: currentVisibility.argument,
            operator: nextOperator
        };

        if (isMultiValueVisibilityOperator(nextOperator)) {
            if (Array.isArray(currentVisibility.values) && currentVisibility.values.length > 0) {
                nextVisibility.values = currentVisibility.values;
            } else if (currentVisibility.value !== undefined) {
                nextVisibility.values = [currentVisibility.value];
            }
        } else if (currentVisibility.value !== undefined) {
            nextVisibility.value = currentVisibility.value;
        } else if (Array.isArray(currentVisibility.values) && currentVisibility.values.length > 0) {
            nextVisibility.value = currentVisibility.values[0];
        }

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            visibleWhen: nextVisibility
        });
    }, [argumentDefinitions, handleArgumentChange]);

    const handleVisibilityValueChange = useCallback((argumentIndex: number, rawValue: string) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const currentVisibility = currentArgument.visibleWhen;
        if (!currentVisibility) {
            return;
        }

        const referenceArgument = argumentDefinitions.find((candidate, index) => {
            return index !== argumentIndex && candidate.argument === currentVisibility.argument;
        });

        const nextVisibility: IArgumentVisibilityCondition = {
            argument: currentVisibility.argument,
            operator: currentVisibility.operator
        };

        if (isMultiValueVisibilityOperator(currentVisibility.operator)) {
            const values = rawValue
                .split(',')
                .map((entry) => normalizeVisibilityComparisonValue(entry, referenceArgument))
                .filter((entry): entry is string | number | boolean => entry !== undefined);

            if (values.length > 0) {
                nextVisibility.values = values;
            }
        } else {
            const value = normalizeVisibilityComparisonValue(rawValue, referenceArgument);
            if (value !== undefined) {
                nextVisibility.value = value;
            }
        }

        handleArgumentChange(argumentIndex, {
            ...currentArgument,
            visibleWhen: nextVisibility
        });
    }, [argumentDefinitions, handleArgumentChange]);

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
                (() => {
                    const visibilityCondition = argument.visibleWhen;
                    const visibilityReferenceOptions = argumentDefinitions
                        .filter((candidate, candidateIndex) => candidateIndex !== index && candidate.argument.trim().length > 0)
                        .map((candidate) => ({
                            value: candidate.argument,
                            title: candidate.label?.trim() || candidate.argument
                        }));
                    const visibilityReferenceArgument = visibilityCondition?.argument
                        ? argumentDefinitions.find((candidate, candidateIndex) => {
                            return candidateIndex !== index && candidate.argument === visibilityCondition.argument;
                        })
                        : undefined;

                    return (
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
                            <FormFieldRHF
                                variant='inline'
                                label='Conditional visibility'
                                name={`visibility-enabled-${level}-${index}`}
                                fieldType='checkbox'
                                value={Boolean(visibilityCondition)}
                                onChange={(event) => {
                                    handleVisibilityEnabledChange(index, event.target.value === 'true');
                                }}
                            />
                            {visibilityCondition && (
                                <>
                                    <FormFieldRHF
                                        variant='inline'
                                        label='Depends on'
                                        name={`visibility-argument-${level}-${index}`}
                                        fieldType='select'
                                        value={visibilityCondition.argument}
                                        onChange={(event) => handleVisibilityArgumentChange(index, event.target.value)}
                                        options={visibilityReferenceOptions}
                                    />
                                    <FormFieldRHF
                                        variant='inline'
                                        label='Operator'
                                        name={`visibility-operator-${level}-${index}`}
                                        fieldType='select'
                                        value={visibilityCondition.operator}
                                        onChange={(event) => handleVisibilityOperatorChange(index, event.target.value)}
                                        options={ARGUMENT_VISIBILITY_OPERATOR_OPTIONS}
                                    />
                                    <FormFieldRHF
                                        variant='inline'
                                        label={isMultiValueVisibilityOperator(visibilityCondition.operator)
                                            ? 'Values (comma separated)'
                                            : 'Value'}
                                        name={`visibility-value-${level}-${index}`}
                                        fieldType='input'
                                        value={getVisibilityValueInput(visibilityCondition)}
                                        onChange={(event) => handleVisibilityValueChange(index, event.target.value)}
                                        placeholder={visibilityReferenceArgument?.type === ArgumentType.BOOLEAN
                                            ? 'true'
                                            : isMultiValueVisibilityOperator(visibilityCondition.operator)
                                                ? 'PTM, ACNA'
                                                : 'PTM'}
                                    />
                                </>
                            )}

                            {(argument.type === ArgumentType.SELECT || isPluginReferenceArgumentType(argument.type)) && (
                                <FormFieldRHF
                                    variant='inline'
                                    label='Multiple selection'
                                    name={`multiple-selection-${level}-${index}`}
                                    fieldType='checkbox'
                                    value={Boolean(argument.multipleSelection)}
                                    onChange={createArgumentFieldHandler(index, 'multipleSelection')}
                                />
                            )}

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
                                <Container key={optionIndex} className='d-flex column items-center gap-05'>
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
                        <>
                            <Container className='d-flex column gap-05'>
                                <Paragraph className='font-size-085 font-bold'>Allowed Plugins</Paragraph>
                                <Select
                                    id={`plugin-reference-filter-${level}-${index}`}
                                    options={allowedPluginOptions}
                                    isMulti
                                    selectedValues={argument.pluginReferenceFilter ?? []}
                                    onMultiChange={(pluginReferenceFilter) => {
                                        handleArgumentChange(index, {
                                            ...argument,
                                            pluginReferenceFilter: pluginReferenceFilter.length > 0
                                                ? pluginReferenceFilter
                                                : undefined
                                        });
                                    }}
                                    hasSearch
                                    placeholder='Select plugins'
                                    renderTriggerLabel={(selectedCount) => {
                                        if (selectedCount === 0) {
                                            return 'Select plugins';
                                        }

                                        if (selectedCount === 1) {
                                            const selectedPluginId = argument.pluginReferenceFilter?.[0];
                                            return allowedPluginOptions.find((option) => option.value === selectedPluginId)?.title ?? '1 selected';
                                        }

                                        return `${selectedCount} selected`;
                                    }}
                                />
                            </Container>
                            <FormFieldRHF
                                variant='inline'
                                label='Show config for selected plugins'
                                name={`plugin-reference-config-${level}-${index}`}
                                fieldType='checkbox'
                                value={Boolean(argument.showPluginConfiguration)}
                                onChange={createArgumentFieldHandler(index, 'showPluginConfiguration')}
                            />
                        </>
                            )}

                            {argument.type !== ArgumentType.LIST && !isPluginReferenceArgumentType(argument.type) && (
                                <>
                                    <FormFieldRHF
                                        variant='inline'
                                        label='Value'
                                        name={`value-${level}-${index}`}
                                        fieldType={argument.type === ArgumentType.BOOLEAN ? 'select' : 'input'}
                                        value={getArgumentFieldInputValue(argument, 'value')}
                                        onChange={createArgumentFieldHandler(index, 'value')}
                                        options={argument.type === ArgumentType.BOOLEAN ? BOOLEAN_ARGUMENT_VALUE_OPTIONS : undefined}
                                        placeholder='Preset hidden value'
                                    />
                                    <FormFieldRHF
                                        variant='inline'
                                        label='Default Value'
                                        name={`default-${level}-${index}`}
                                        fieldType={argument.type === ArgumentType.BOOLEAN ? 'select' : 'input'}
                                        value={getArgumentFieldInputValue(argument, 'default')}
                                        onChange={createArgumentFieldHandler(index, 'default')}
                                        options={argument.type === ArgumentType.BOOLEAN ? BOOLEAN_ARGUMENT_VALUE_OPTIONS : undefined}
                                        placeholder='Default value'
                                    />
                                </>
                            )}
                        </CollapsibleSection>
                    );
                })()
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
