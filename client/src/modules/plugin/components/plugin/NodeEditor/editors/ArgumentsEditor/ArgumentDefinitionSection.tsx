import './ArgumentDefinitionSection.css';
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
import ArgumentOptionsEditor from './ArgumentOptionsEditor';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import FormSection from '@/shared/presentation/components/FormSection';
import DashedActionBox from '@/shared/presentation/primitives/DashedActionBox';
import Select from '@/shared/presentation/primitives/Select';
import Tag from '@/shared/presentation/primitives/Tag';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type {
    IArgumentDefinition,
    IArgumentOption,
    IArgumentVisibilityCondition
} from '@/modules/plugin/api/entities/plugin/workflow';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import type { ChangeEvent } from 'react';

interface ArgumentDefinitionSectionProps {
    arguments: IArgumentDefinition[];
    onAddArgument: () => void;
    onRemoveArgument: (index: number) => void;
    onUpdateArgument: (index: number, nextArgument: IArgumentDefinition) => void;
    level?: number;
};

const ARGUMENT_TYPE_LABELS: Record<string, string> = ARGUMENT_TYPE_OPTIONS.reduce<Record<string, string>>(
    (accumulator, option) => {
        accumulator[option.value] = option.label;
        return accumulator;
    },
    {}
);

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

const getArgumentLabel = (argument: IArgumentDefinition): string => {
    return argument.label?.trim() || argument.argument?.trim() || '';
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
    const [expandedIndex, setExpandedIndex] = useState<number>(-1);

    const handleArgumentChange = useCallback((index: number, nextArgument: IArgumentDefinition) => {
        onUpdateArgument(index, nextArgument);
    }, [onUpdateArgument]);

    const allowedPluginOptions = useMemo<SelectOption[]>(() => {
        return publishedPlugins.map((plugin) => ({
            value: plugin._id,
            title: plugin.modifier?.name?.trim() || plugin._id
        }));
    }, [publishedPlugins]);

    const allowedPluginKeyOptions = useMemo<SelectOption[]>(() => {
        const optionsByKey = new Map<string, SelectOption>();

        for (const plugin of publishedPlugins) {
            const key = plugin.modifier?.key?.trim();
            if (!key || optionsByKey.has(key)) {
                continue;
            }

            optionsByKey.set(key, {
                value: key,
                title: `${plugin.modifier?.name?.trim() || plugin._id} (${key})`
            });
        }

        return Array.from(optionsByKey.values());
    }, [publishedPlugins]);

    const handleAddArgument = useCallback(() => {
        onAddArgument();
        setExpandedIndex(argumentDefinitions.length);
    }, [onAddArgument, argumentDefinitions.length]);

    const handleRemoveArgument = useCallback((index: number) => {
        onRemoveArgument(index);
        setExpandedIndex((current) => {
            if (current === index) return -1;
            if (current > index) return current - 1;
            return current;
        });
    }, [onRemoveArgument]);

    const toggleExpanded = useCallback((index: number) => {
        setExpandedIndex((current) => (current === index ? -1 : index));
    }, []);

    const handleOptionsChange = useCallback((argumentIndex: number, nextOptions: IArgumentOption[]) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nextArgument: IArgumentDefinition = {
            ...currentArgument,
            options: nextOptions
        };

        const defaultValue = currentArgument.default;
        if (typeof defaultValue === 'string' && !nextOptions.some((option) => option.key === defaultValue)) {
            delete nextArgument.default;
        }

        handleArgumentChange(argumentIndex, nextArgument);
    }, [argumentDefinitions, handleArgumentChange]);

    const createArgumentFieldHandler = useCallback((argumentIndex: number, field: keyof IArgumentDefinition) => {
        return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const nextValue = event.target.value;
            const currentArgument = argumentDefinitions[argumentIndex];

            if (field === 'type') {
                const nextType = nextValue as ArgumentType;
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
                    delete nextArgument.pluginReferenceFilterKeys;
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

            if (field === 'multipleSelection' || field === 'showPluginConfiguration' || field === 'required') {
                handleArgumentChange(argumentIndex, {
                    ...currentArgument,
                    [field]: nextValue === 'true'
                });
                return;
            }

            if (field === 'default' || field === 'value') {
                const nextScalarValue = nextValue === ''
                    ? undefined
                    : currentArgument.type === ArgumentType.BOOLEAN
                        ? nextValue === 'true'
                        : currentArgument.type === ArgumentType.NUMBER
                            ? Number(nextValue)
                            : nextValue;

                handleArgumentChange(argumentIndex, {
                    ...currentArgument,
                    [field]: nextScalarValue
                });
                return;
            }

            handleArgumentChange(argumentIndex, {
                ...currentArgument,
                [field]: nextValue
            });
        };
    }, [argumentDefinitions, handleArgumentChange]);

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

        const nextOperator = value as ArgumentVisibilityOperator;
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

        const parseVisibilityValue = (entry: string): string | number | boolean | undefined => {
            const trimmedEntry = entry.trim();
            if (!trimmedEntry) {
                return undefined;
            }

            if (referenceArgument?.type === ArgumentType.NUMBER) {
                const parsedEntry = Number(trimmedEntry);
                return Number.isFinite(parsedEntry) ? parsedEntry : undefined;
            }

            if (referenceArgument?.type === ArgumentType.BOOLEAN) {
                return trimmedEntry === 'true';
            }

            return trimmedEntry;
        };

        if (isMultiValueVisibilityOperator(currentVisibility.operator)) {
            const values = rawValue
                .split(',')
                .map(parseVisibilityValue)
                .filter((entry): entry is string | number | boolean => entry !== undefined);

            if (values.length > 0) {
                nextVisibility.values = values;
            }
        } else {
            const value = parseVisibilityValue(rawValue);
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
        <div className='argument-definition-list'>
            {argumentDefinitions.length === 0 && (
                <div className='argument-definition-empty'>
                    No arguments yet. Add one to define user input.
                </div>
            )}

            {argumentDefinitions.map((argument, index) => {
                const visibilityCondition = argument.visibleWhen;
                const isExpanded = expandedIndex === index;
                const argumentLabel = getArgumentLabel(argument);
                const displayLabel = argumentLabel || `Argument ${index + 1}`;
                const typeBadge = ARGUMENT_TYPE_LABELS[argument.type] ?? argument.type;

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

                const showValueSection = argument.type !== ArgumentType.LIST && !isPluginReferenceArgumentType(argument.type);
                const scalarOptions: SelectOption[] | undefined = argument.type === ArgumentType.BOOLEAN
                    ? BOOLEAN_ARGUMENT_VALUE_OPTIONS
                    : argument.type === ArgumentType.SELECT
                        ? (argument.options ?? [])
                            .filter((option) => option.key.trim().length > 0)
                            .map((option) => ({
                                value: option.key,
                                title: option.label?.trim() ? `${option.label} (${option.key})` : option.key
                            }))
                        : undefined;
                const scalarFieldType: 'input' | 'select' = argument.type === ArgumentType.BOOLEAN || argument.type === ArgumentType.SELECT
                    ? 'select'
                    : 'input';

                return (
                    <div
                        key={`${level}-${index}`}
                        className={`argument-row ${isExpanded ? 'is-expanded' : ''}`}
                    >
                        <div className='argument-row-header'>
                            <button
                                type='button'
                                className='argument-row-toggle'
                                onClick={() => toggleExpanded(index)}
                                aria-expanded={isExpanded}
                                aria-controls={`argument-row-body-${level}-${index}`}
                            >
                                <ChevronRight size={14} className='argument-row-chevron' aria-hidden='true' />
                                <span className={`argument-row-title ${argumentLabel ? '' : 'argument-row-title--placeholder'}`}>
                                    {displayLabel}
                                </span>
                                <Tag size='xs' className='argument-row-type-badge'>{typeBadge}</Tag>
                            </button>
                            <button
                                type='button'
                                className='argument-row-delete'
                                onClick={() => handleRemoveArgument(index)}
                                aria-label={`Delete ${displayLabel}`}
                                title='Delete argument'
                            >
                                <Trash2 size={14} aria-hidden='true' />
                            </button>
                        </div>

                        {isExpanded && (
                            <div className='argument-row-body' id={`argument-row-body-${level}-${index}`}>
                                <FormSection title='General'>
                                    <FormFieldRHF
                                        variant='inline'
                                        label='Key'
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
                                </FormSection>

                                {argument.type === ArgumentType.NUMBER && (
                                    <FormSection title='Constraints'>
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
                                    </FormSection>
                                )}

                                {(argument.type === ArgumentType.SELECT || isPluginReferenceArgumentType(argument.type)) && (
                                    <FormSection title='Selection'>
                                        <FormFieldRHF
                                            variant='inline'
                                            label='Multiple'
                                            name={`multiple-selection-${level}-${index}`}
                                            fieldType='checkbox'
                                            value={Boolean(argument.multipleSelection)}
                                            onChange={createArgumentFieldHandler(index, 'multipleSelection')}
                                        />
                                    </FormSection>
                                )}

                                {showValueSection && (
                                    <FormSection title='Values'>
                                        <FormFieldRHF
                                            variant='inline'
                                            label='Value'
                                            name={`value-${level}-${index}`}
                                            fieldType={scalarFieldType}
                                            value={getArgumentFieldInputValue(argument, 'value')}
                                            onChange={createArgumentFieldHandler(index, 'value')}
                                            options={scalarOptions}
                                            placeholder='Preset hidden value'
                                        />
                                        <FormFieldRHF
                                            variant='inline'
                                            label='Default'
                                            name={`default-${level}-${index}`}
                                            fieldType={scalarFieldType}
                                            value={getArgumentFieldInputValue(argument, 'default')}
                                            onChange={createArgumentFieldHandler(index, 'default')}
                                            options={scalarOptions}
                                            placeholder='Default value'
                                        />
                                    </FormSection>
                                )}

                                <FormSection title='Visibility'>
                                    <FormFieldRHF
                                        variant='inline'
                                        label='Conditional'
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
                                                label={isMultiValueVisibilityOperator(visibilityCondition.operator) ? 'Values' : 'Value'}
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
                                </FormSection>

                                {argument.type === ArgumentType.SELECT && (
                                    <>
                                        <h4 className='argument-row-subheading text-eyebrow'>Options</h4>
                                        <div className='argument-row-subblock'>
                                            <ArgumentOptionsEditor
                                                options={argument.options ?? []}
                                                onOptionsChange={(nextOptions) => handleOptionsChange(index, nextOptions)}
                                            />
                                        </div>
                                    </>
                                )}

                                {argument.type === ArgumentType.LIST && (
                                    <>
                                        <h4 className='argument-row-subheading text-eyebrow'>Nested Arguments</h4>
                                        <div className='argument-row-subblock argument-row-nested'>
                                            <ArgumentDefinitionSection
                                                arguments={argument.listArguments ?? []}
                                                onAddArgument={() => handleNestedArgumentAdd(index)}
                                                onRemoveArgument={(nestedIndex) => handleNestedArgumentRemove(index, nestedIndex)}
                                                onUpdateArgument={(nestedIndex, nextNestedArgument) => handleNestedArgumentUpdate(index, nestedIndex, nextNestedArgument)}
                                                level={level + 1}
                                            />
                                        </div>
                                    </>
                                )}

                                {isPluginReferenceArgumentType(argument.type) && (
                                    <>
                                        <h4 className='argument-row-subheading text-eyebrow'>Allowed Plugins</h4>
                                        <div className='argument-row-subblock'>
                                            <div className='d-flex column gap-05'>
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
                                                <Select
                                                    id={`plugin-reference-filter-keys-${level}-${index}`}
                                                    options={allowedPluginKeyOptions}
                                                    isMulti
                                                    selectedValues={argument.pluginReferenceFilterKeys ?? []}
                                                    onMultiChange={(pluginReferenceFilterKeys) => {
                                                        handleArgumentChange(index, {
                                                            ...argument,
                                                            pluginReferenceFilterKeys: pluginReferenceFilterKeys.length > 0
                                                                ? pluginReferenceFilterKeys
                                                                : undefined
                                                        });
                                                    }}
                                                    hasSearch
                                                    placeholder='Select portable keys'
                                                    renderTriggerLabel={(selectedCount) => {
                                                        if (selectedCount === 0) {
                                                            return 'Select portable keys';
                                                        }

                                                        if (selectedCount === 1) {
                                                            const selectedPluginKey = argument.pluginReferenceFilterKeys?.[0];
                                                            return allowedPluginKeyOptions.find((option) => option.value === selectedPluginKey)?.title ?? '1 selected';
                                                        }

                                                        return `${selectedCount} keys selected`;
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <FormSection title='Plugin Reference'>
                                            <FormFieldRHF
                                                variant='inline'
                                                label='Required'
                                                name={`plugin-reference-required-${level}-${index}`}
                                                fieldType='checkbox'
                                                value={Boolean(argument.required)}
                                                onChange={createArgumentFieldHandler(index, 'required')}
                                            />
                                            <FormFieldRHF
                                                variant='inline'
                                                label='Show config'
                                                name={`plugin-reference-config-${level}-${index}`}
                                                fieldType='checkbox'
                                                value={Boolean(argument.showPluginConfiguration)}
                                                onChange={createArgumentFieldHandler(index, 'showPluginConfiguration')}
                                            />
                                        </FormSection>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            <DashedActionBox
                icon={<Plus size={14} aria-hidden='true' />}
                label='Add Argument'
                size='sm'
                block
                className='add-argument-button'
                onClick={handleAddArgument}
            />
        </div>
    );
};

export default ArgumentDefinitionSection;
