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
import { useMemo, useState } from 'react';
import type {
    IArgumentDefinition,
    IArgumentOption,
    IPluginReferenceArgumentMapping,
    IArgumentVisibilityCondition
} from '@/modules/plugin/api/entities/plugin/workflow';
import type { FormFieldChangeHandler } from '@/shared/presentation/components/FormFieldRHF/FormFieldRHF.types';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import type { ChangeEvent, InputHTMLAttributes } from 'react';

interface ArgumentDefinitionSectionProps {
    arguments: IArgumentDefinition[];
    onAddArgument: () => void;
    onRemoveArgument: (index: number) => void;
    onUpdateArgument: (index: number, nextArgument: IArgumentDefinition) => void;
    level?: number;
}

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

const ANY_PLUGIN_OPTION: SelectOption = {
    value: '',
    title: 'Any plugin'
};

const ANY_PLUGIN_KEY_OPTION: SelectOption = {
    value: '',
    title: 'Any key'
};

type ArgumentFieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

interface ArgumentFieldProps {
    label: string;
    name: string;
    fieldType?: 'input' | 'select' | 'checkbox' | 'textarea';
    value?: string | number | boolean;
    onChange?: FormFieldChangeHandler;
    options?: SelectOption[];
    placeholder?: string;
    inputProps?: InputHTMLAttributes<HTMLInputElement>;
    rows?: number;
}

const ArgumentField = (props: ArgumentFieldProps) => (
    <FormFieldRHF {...props} variant='inline' />
);

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

const formatValueMapInput = (valueMap?: Record<string, unknown>): string => {
    if (!valueMap) {
        return '';
    }

    try {
        return JSON.stringify(valueMap);
    } catch {
        return '';
    }
};

const parseValueMapInput = (rawValue: string): Record<string, unknown> | undefined => {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
        return undefined;
    }

    try {
        const parsedValue = JSON.parse(trimmedValue) as unknown;
        if (typeof parsedValue === 'object' && parsedValue !== null && !Array.isArray(parsedValue)) {
            return parsedValue as Record<string, unknown>;
        }
    } catch {
        return undefined;
    }

    return undefined;
};

const getMultiSelectTriggerLabel = (
    selectedCount: number,
    selectedValues: string[] | undefined,
    options: SelectOption[],
    emptyLabel: string,
    selectedSuffix: string
): string => {
    if (selectedCount === 0) {
        return emptyLabel;
    }

    if (selectedCount === 1) {
        const selectedValue = selectedValues?.[0];
        return options.find((option) => option.value === selectedValue)?.title ?? '1 selected';
    }

    return `${selectedCount} ${selectedSuffix}`;
};

const ArgumentDefinitionSection = ({
    arguments: argumentDefinitions,
    onAddArgument,
    onRemoveArgument,
    onUpdateArgument,
    level = 0
}: ArgumentDefinitionSectionProps) => {
    const { publishedPlugins, getPluginArguments } = usePluginSelectors();
    const [expandedIndex, setExpandedIndex] = useState<number>(-1);

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

    const handleAddArgument = () => {
        onAddArgument();
        setExpandedIndex(argumentDefinitions.length);
    };

    const handleRemoveArgument = (index: number) => {
        onRemoveArgument(index);
        setExpandedIndex((current) => {
            if (current === index) return -1;
            if (current > index) return current - 1;
            return current;
        });
    };

    const toggleExpanded = (index: number) => {
        setExpandedIndex((current) => (current === index ? -1 : index));
    };

    const handleOptionsChange = (argumentIndex: number, nextOptions: IArgumentOption[]) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nextArgument: IArgumentDefinition = {
            ...currentArgument,
            options: nextOptions
        };

        const defaultValue = currentArgument.default;
        if (typeof defaultValue === 'string' && !nextOptions.some((option) => option.key === defaultValue)) {
            delete nextArgument.default;
        }

        onUpdateArgument(argumentIndex, nextArgument);
    };

    const createArgumentFieldHandler = (argumentIndex: number, field: keyof IArgumentDefinition) => {
        return (event: ArgumentFieldChangeEvent) => {
            const nextValue = event.target.value;
            const currentArgument = argumentDefinitions[argumentIndex];

            if (field === 'type') {
                const nextType = nextValue as ArgumentType;
                const isPluginReferenceType = isPluginReferenceArgumentType(nextType);
                const nextArgument: IArgumentDefinition = {
                    ...currentArgument,
                    type: nextType
                };

                if (nextType !== ArgumentType.SELECT) {
                    delete nextArgument.options;
                }

                if (nextType !== ArgumentType.SELECT && !isPluginReferenceType) {
                    delete nextArgument.multipleSelection;
                }

                if (nextType === ArgumentType.LIST) {
                    nextArgument.listArguments ??= [];
                } else {
                    delete nextArgument.listArguments;
                    if (Array.isArray(nextArgument.default)) {
                        delete nextArgument.default;
                    }
                    if (Array.isArray(nextArgument.value)) {
                        delete nextArgument.value;
                    }
                }

                if (isPluginReferenceType) {
                    delete nextArgument.options;
                    delete nextArgument.min;
                    delete nextArgument.max;
                    delete nextArgument.step;
                    delete nextArgument.listArguments;
                    delete nextArgument.value;
                }

                if (!isPluginReferenceType) {
                    delete nextArgument.pluginReferenceFilter;
                    delete nextArgument.pluginReferenceFilterKeys;
                    delete nextArgument.showPluginConfiguration;
                    delete nextArgument.pluginReferenceMappings;
                }

                if (nextType !== ArgumentType.NUMBER) {
                    delete nextArgument.min;
                    delete nextArgument.max;
                    delete nextArgument.step;
                }

                onUpdateArgument(argumentIndex, nextArgument);
                return;
            }

            if (field === 'min' || field === 'max' || field === 'step') {
                onUpdateArgument(argumentIndex, {
                    ...currentArgument,
                    [field]: nextValue === '' ? undefined : Number(nextValue)
                });
                return;
            }

            if (field === 'multipleSelection' || field === 'showPluginConfiguration' || field === 'required') {
                onUpdateArgument(argumentIndex, {
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

                onUpdateArgument(argumentIndex, {
                    ...currentArgument,
                    [field]: nextScalarValue
                });
                return;
            }

            onUpdateArgument(argumentIndex, {
                ...currentArgument,
                [field]: nextValue
            });
        };
    };

    const handleVisibilityEnabledChange = (argumentIndex: number, enabled: boolean) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nextArgument: IArgumentDefinition = {
            ...currentArgument
        };

        if (!enabled) {
            delete nextArgument.visibleWhen;
            onUpdateArgument(argumentIndex, nextArgument);
            return;
        }

        const fallbackReference = argumentDefinitions.find((candidate, index) => {
            return index !== argumentIndex && candidate.argument.trim().length > 0;
        });

        nextArgument.visibleWhen = {
            argument: fallbackReference?.argument ?? '',
            operator: ArgumentVisibilityOperator.EQUALS
        };

        onUpdateArgument(argumentIndex, nextArgument);
    };

    const handleVisibilityArgumentChange = (argumentIndex: number, value: string) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const currentVisibility = currentArgument.visibleWhen;
        if (!currentVisibility) {
            return;
        }

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            visibleWhen: {
                ...currentVisibility,
                argument: value
            }
        });
    };

    const handleVisibilityOperatorChange = (argumentIndex: number, value: string) => {
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

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            visibleWhen: nextVisibility
        });
    };

    const handleVisibilityValueChange = (argumentIndex: number, rawValue: string) => {
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

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            visibleWhen: nextVisibility
        });
    };

    const handleNestedArgumentAdd = (argumentIndex: number) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nestedArguments = currentArgument.listArguments ?? [];

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            listArguments: [...nestedArguments, createDefaultArgumentDefinition()]
        });
    };

    const handleNestedArgumentRemove = (argumentIndex: number, nestedIndex: number) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nestedArguments = currentArgument.listArguments ?? [];

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            listArguments: nestedArguments.filter((_, index) => index !== nestedIndex)
        });
    };

    const handleNestedArgumentUpdate = (
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

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            listArguments: nextNestedArguments
        });
    };

    const createDefaultPluginReferenceMapping = (argumentIndex: number): IPluginReferenceArgumentMapping => {
        const sourceArgument = argumentDefinitions.find((candidate, index) => {
            return index !== argumentIndex && candidate.argument.trim().length > 0;
        })?.argument ?? '';

        return {
            sourceArgument,
            targetArgument: ''
        };
    };

    const handlePluginReferenceMappingAdd = (argumentIndex: number) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const currentMappings = currentArgument.pluginReferenceMappings ?? [];

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            pluginReferenceMappings: [
                ...currentMappings,
                createDefaultPluginReferenceMapping(argumentIndex)
            ]
        });
    };

    const handlePluginReferenceMappingRemove = (argumentIndex: number, mappingIndex: number) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nextMappings = (currentArgument.pluginReferenceMappings ?? [])
            .filter((_, index) => index !== mappingIndex);

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            pluginReferenceMappings: nextMappings.length > 0 ? nextMappings : undefined
        });
    };

    const handlePluginReferenceMappingUpdate = (
        argumentIndex: number,
        mappingIndex: number,
        patch: Partial<IPluginReferenceArgumentMapping>
    ) => {
        const currentArgument = argumentDefinitions[argumentIndex];
        const nextMappings = (currentArgument.pluginReferenceMappings ?? [])
            .map((mapping, index) => {
                if (index !== mappingIndex) {
                    return mapping;
                }

                const nextMapping: IPluginReferenceArgumentMapping = {
                    ...mapping,
                    ...patch
                };

                if (!nextMapping.targetPluginId) {
                    delete nextMapping.targetPluginId;
                }
                if (!nextMapping.targetPluginKey) {
                    delete nextMapping.targetPluginKey;
                }
                if (!nextMapping.valueMap) {
                    delete nextMapping.valueMap;
                }

                return nextMapping;
            });

        onUpdateArgument(argumentIndex, {
            ...currentArgument,
            pluginReferenceMappings: nextMappings
        });
    };

    const createMappingFieldHandler = (
        argumentIndex: number,
        mappingIndex: number,
        field: keyof IPluginReferenceArgumentMapping,
        mapValue: (value: string) => unknown = (value) => value
    ) => {
        return (event: ArgumentFieldChangeEvent) => {
            handlePluginReferenceMappingUpdate(argumentIndex, mappingIndex, {
                [field]: mapValue(event.target.value)
            } as Partial<IPluginReferenceArgumentMapping>);
        };
    };

    const getTargetArgumentOptions = (mapping: IPluginReferenceArgumentMapping): SelectOption[] => {
        const targetPluginIds = new Set<string>();
        const targetPluginId = mapping.targetPluginId?.trim();
        const targetPluginKey = mapping.targetPluginKey?.trim();

        if (targetPluginId) {
            targetPluginIds.add(targetPluginId);
        }

        if (targetPluginKey) {
            for (const plugin of publishedPlugins) {
                if (plugin.modifier?.key?.trim() === targetPluginKey) {
                    targetPluginIds.add(plugin._id);
                }
            }
        }

        const optionsByArgument = new Map<string, SelectOption>();
        for (const pluginId of targetPluginIds) {
            for (const definition of getPluginArguments(pluginId)) {
                if (!definition.argument?.trim() || optionsByArgument.has(definition.argument)) {
                    continue;
                }

                optionsByArgument.set(definition.argument, {
                    value: definition.argument,
                    title: definition.label?.trim()
                        ? `${definition.label} (${definition.argument})`
                        : definition.argument
                });
            }
        }

        return Array.from(optionsByArgument.values());
    };

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
                                    <ArgumentField
                                        label='Key'
                                        name={`argument-${level}-${index}`}
                                        value={argument.argument}
                                        onChange={createArgumentFieldHandler(index, 'argument')}
                                        placeholder='my_argument'
                                    />
                                    <ArgumentField
                                        label='Label'
                                        name={`label-${level}-${index}`}
                                        value={argument.label}
                                        onChange={createArgumentFieldHandler(index, 'label')}
                                        placeholder='My Argument'
                                    />
                                    <ArgumentField
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
                                        <ArgumentField
                                            label='Min'
                                            name={`min-${level}-${index}`}
                                            value={argument.min ?? ''}
                                            onChange={createArgumentFieldHandler(index, 'min')}
                                            placeholder='0'
                                            inputProps={{ type: 'number' }}
                                        />
                                        <ArgumentField
                                            label='Max'
                                            name={`max-${level}-${index}`}
                                            value={argument.max ?? ''}
                                            onChange={createArgumentFieldHandler(index, 'max')}
                                            placeholder='100'
                                            inputProps={{ type: 'number' }}
                                        />
                                        <ArgumentField
                                            label='Step'
                                            name={`step-${level}-${index}`}
                                            value={argument.step ?? ''}
                                            onChange={createArgumentFieldHandler(index, 'step')}
                                            placeholder='1'
                                            inputProps={{ type: 'number' }}
                                        />
                                    </FormSection>
                                )}

                                {(argument.type === ArgumentType.SELECT || isPluginReferenceArgumentType(argument.type)) && (
                                    <FormSection title='Selection'>
                                        <ArgumentField
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
                                        <ArgumentField
                                            label='Value'
                                            name={`value-${level}-${index}`}
                                            fieldType={scalarFieldType}
                                            value={getArgumentFieldInputValue(argument, 'value')}
                                            onChange={createArgumentFieldHandler(index, 'value')}
                                            options={scalarOptions}
                                            placeholder='Preset hidden value'
                                        />
                                        <ArgumentField
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
                                    <ArgumentField
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
                                            <ArgumentField
                                                label='Depends on'
                                                name={`visibility-argument-${level}-${index}`}
                                                fieldType='select'
                                                value={visibilityCondition.argument}
                                                onChange={(event) => handleVisibilityArgumentChange(index, event.target.value)}
                                                options={visibilityReferenceOptions}
                                            />
                                            <ArgumentField
                                                label='Operator'
                                                name={`visibility-operator-${level}-${index}`}
                                                fieldType='select'
                                                value={visibilityCondition.operator}
                                                onChange={(event) => handleVisibilityOperatorChange(index, event.target.value)}
                                                options={ARGUMENT_VISIBILITY_OPERATOR_OPTIONS}
                                            />
                                            <ArgumentField
                                                label={isMultiValueVisibilityOperator(visibilityCondition.operator) ? 'Values' : 'Value'}
                                                name={`visibility-value-${level}-${index}`}
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
                                                        onUpdateArgument(index, {
                                                            ...argument,
                                                            pluginReferenceFilter: pluginReferenceFilter.length > 0
                                                                ? pluginReferenceFilter
                                                                : undefined
                                                        });
                                                    }}
                                                    hasSearch
                                                    placeholder='Select plugins'
                                                    renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                                        selectedCount,
                                                        argument.pluginReferenceFilter,
                                                        allowedPluginOptions,
                                                        'Select plugins',
                                                        'selected'
                                                    )}
                                                />
                                                <Select
                                                    id={`plugin-reference-filter-keys-${level}-${index}`}
                                                    options={allowedPluginKeyOptions}
                                                    isMulti
                                                    selectedValues={argument.pluginReferenceFilterKeys ?? []}
                                                    onMultiChange={(pluginReferenceFilterKeys) => {
                                                        onUpdateArgument(index, {
                                                            ...argument,
                                                            pluginReferenceFilterKeys: pluginReferenceFilterKeys.length > 0
                                                                ? pluginReferenceFilterKeys
                                                                : undefined
                                                        });
                                                    }}
                                                    hasSearch
                                                    placeholder='Select portable keys'
                                                    renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                                        selectedCount,
                                                        argument.pluginReferenceFilterKeys,
                                                        allowedPluginKeyOptions,
                                                        'Select portable keys',
                                                        'keys selected'
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        <FormSection title='Plugin Reference'>
                                            <ArgumentField
                                                label='Required'
                                                name={`plugin-reference-required-${level}-${index}`}
                                                fieldType='checkbox'
                                                value={Boolean(argument.required)}
                                                onChange={createArgumentFieldHandler(index, 'required')}
                                            />
                                            <ArgumentField
                                                label='Show config'
                                                name={`plugin-reference-config-${level}-${index}`}
                                                fieldType='checkbox'
                                                value={Boolean(argument.showPluginConfiguration)}
                                                onChange={createArgumentFieldHandler(index, 'showPluginConfiguration')}
                                            />
                                        </FormSection>
                                        <h4 className='argument-row-subheading text-eyebrow'>Argument Mappings</h4>
                                        <div className='argument-row-subblock'>
                                            <div className='d-flex column gap-05'>
                                                {(argument.pluginReferenceMappings ?? []).map((mapping, mappingIndex) => {
                                                    const targetArgumentOptions = getTargetArgumentOptions(mapping);
                                                    const hasCurrentTargetArgument = targetArgumentOptions.some((option) => option.value === mapping.targetArgument);
                                                    const targetOptions = hasCurrentTargetArgument || !mapping.targetArgument?.trim()
                                                        ? targetArgumentOptions
                                                        : [{
                                                            value: mapping.targetArgument,
                                                            title: mapping.targetArgument
                                                        }, ...targetArgumentOptions];
                                                    const hasTargetOptions = targetOptions.length > 0;

                                                    return (
                                                        <div key={`${level}-${index}-mapping-${mappingIndex}`} className='argument-row-subblock argument-row-nested'>
                                                            <div className='d-flex content-between items-center gap-05 mb-05'>
                                                                <span className='font-size-1 color-muted'>Mapping {mappingIndex + 1}</span>
                                                                <button
                                                                    type='button'
                                                                    className='argument-row-delete'
                                                                    onClick={() => handlePluginReferenceMappingRemove(index, mappingIndex)}
                                                                    aria-label={`Delete mapping ${mappingIndex + 1}`}
                                                                    title='Delete mapping'
                                                                >
                                                                    <Trash2 size={14} aria-hidden='true' />
                                                                </button>
                                                            </div>
                                                            <ArgumentField
                                                                label='Source'
                                                                name={`plugin-reference-mapping-source-${level}-${index}-${mappingIndex}`}
                                                                fieldType='select'
                                                                value={mapping.sourceArgument}
                                                                onChange={createMappingFieldHandler(index, mappingIndex, 'sourceArgument')}
                                                                options={visibilityReferenceOptions}
                                                            />
                                                            <ArgumentField
                                                                label='Target plugin'
                                                                name={`plugin-reference-mapping-plugin-${level}-${index}-${mappingIndex}`}
                                                                fieldType='select'
                                                                value={mapping.targetPluginId ?? ''}
                                                                onChange={createMappingFieldHandler(index, mappingIndex, 'targetPluginId', (value) => value || undefined)}
                                                                options={[ANY_PLUGIN_OPTION, ...allowedPluginOptions]}
                                                            />
                                                            <ArgumentField
                                                                label='Target key'
                                                                name={`plugin-reference-mapping-key-${level}-${index}-${mappingIndex}`}
                                                                fieldType='select'
                                                                value={mapping.targetPluginKey ?? ''}
                                                                onChange={createMappingFieldHandler(index, mappingIndex, 'targetPluginKey', (value) => value || undefined)}
                                                                options={[ANY_PLUGIN_KEY_OPTION, ...allowedPluginKeyOptions]}
                                                            />
                                                            <ArgumentField
                                                                label='Target argument'
                                                                name={`plugin-reference-mapping-target-${level}-${index}-${mappingIndex}`}
                                                                fieldType={hasTargetOptions ? 'select' : 'input'}
                                                                value={mapping.targetArgument}
                                                                onChange={createMappingFieldHandler(index, mappingIndex, 'targetArgument')}
                                                                options={targetOptions}
                                                                placeholder={hasTargetOptions ? undefined : 'crystalStructure'}
                                                            />
                                                            <ArgumentField
                                                                label='Value map'
                                                                name={`plugin-reference-mapping-value-map-${level}-${index}-${mappingIndex}`}
                                                                fieldType='textarea'
                                                                value={formatValueMapInput(mapping.valueMap)}
                                                                onChange={createMappingFieldHandler(index, mappingIndex, 'valueMap', parseValueMapInput)}
                                                                placeholder='{"fcc":"FCC"}'
                                                                rows={2}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                                <DashedActionBox
                                                    icon={<Plus size={14} aria-hidden='true' />}
                                                    label='Add Mapping'
                                                    size='sm'
                                                    block
                                                    onClick={() => handlePluginReferenceMappingAdd(index)}
                                                />
                                            </div>
                                        </div>
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
