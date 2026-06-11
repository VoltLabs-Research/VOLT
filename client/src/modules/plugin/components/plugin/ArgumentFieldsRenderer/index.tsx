import { Button, CollapsibleSection, Row, Select, Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import {
    coerceArgumentInputValue,
    createDefaultListItem,
    getUserConfigurableArguments,
    getArgumentDefaultValue,
    getListArgumentValue,
    getSelectArgumentValue,
    getPrimitiveArgumentFieldValue,
    isPluginReferenceArgumentType
} from '@/modules/plugin/utilities/plugin/argument-values';
import { getVisibleArguments } from '@/modules/plugin/utilities/plugin/argument-visibility';
import PluginConfigField from '@/modules/plugin/components/plugin/PluginConfigField';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF/FormFieldRHF.types';
import { getMultiSelectTriggerLabel } from '@/shared/presentation/utilities/multi-select-trigger-label';
import { isRecord } from '@/shared/utils/type-guards';
import './ArgumentFieldsRenderer.css';

interface ArgumentFieldsRendererProps {
    arguments: IArgumentDefinition[];
    values: Record<string, unknown>;
    rootValues?: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    frameOptions?: SelectOption[];
    emptyMessage?: string;
    path?: string;
    autocompleteOptions?: FormFieldAutocompleteOption[];
    allowTemplateReferenceMode?: boolean;
}

interface ListItemValue {
    [key: string]: unknown;
}

interface PrimitiveFieldConfig {
    fieldType: 'input' | 'select' | 'checkbox';
    fieldValue: string | number | boolean;
    options?: SelectOption[];
    inputProps?: {
        type: 'number';
        step?: number;
        min?: number;
        max?: number;
    };
}

const getPrimitiveFieldConfig = (
    argument: IArgumentDefinition,
    value: unknown,
    frameOptions: SelectOption[],
    selectOptions: SelectOption[]
): PrimitiveFieldConfig => {
    if (argument.type === ArgumentType.BOOLEAN) {
        return {
            fieldType: 'checkbox',
            fieldValue: getPrimitiveArgumentFieldValue(argument, value)
        };
    }

    if (argument.type === ArgumentType.SELECT) {
        return {
            fieldType: 'select',
            fieldValue: getPrimitiveArgumentFieldValue(argument, value),
            options: selectOptions
        };
    }

    if (argument.type === ArgumentType.FRAME) {
        return {
            fieldType: 'select',
            fieldValue: getPrimitiveArgumentFieldValue(argument, value),
            options: frameOptions
        };
    }

    if (argument.type === ArgumentType.NUMBER) {
        return {
            fieldType: 'input',
            fieldValue: getPrimitiveArgumentFieldValue(argument, value),
            inputProps: {
                type: 'number',
                step: argument.step,
                min: argument.min,
                max: argument.max
            }
        };
    }

    return {
        fieldType: 'input',
        fieldValue: getPrimitiveArgumentFieldValue(argument, value)
    };
};

const normalizeDynamicOptionValue = (value: unknown): string => {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    return '';
};

const readDynamicOptionField = (value: unknown, field?: string): string => {
    if (field && isRecord(value)) {
        return normalizeDynamicOptionValue(value[field]);
    }

    return normalizeDynamicOptionValue(value);
};

const readSelectedPluginIds = (referenceValue: unknown): string[] => {
    if (!isRecord(referenceValue)) {
        return [];
    }

    const selections = referenceValue.selections;
    if (!Array.isArray(selections)) {
        return [];
    }

    const ids: string[] = [];
    for (const selection of selections) {
        if (isRecord(selection) && typeof selection.pluginId === 'string' && selection.pluginId) {
            ids.push(selection.pluginId);
        }
    }
    return ids;
};

const resolvePluginReferenceOptions = (
    argument: IArgumentDefinition,
    rootValues: Record<string, unknown>,
    pluginsById: Record<string, Plugin>
): SelectOption[] => {
    const referenceArgument = argument.optionsFromPluginReference?.trim();
    if (!referenceArgument) {
        return [];
    }

    const selectedPluginIds = readSelectedPluginIds(rootValues[referenceArgument]);
    const options: SelectOption[] = [];
    for (const pluginId of selectedPluginIds) {
        const plugin = pluginsById[pluginId];
        if (!plugin?.exposures) {
            continue;
        }

        for (const exposure of plugin.exposures) {
            for (const property of exposure.properties ?? []) {
                const value = typeof property.key === 'string' ? property.key.trim() : '';
                if (!value) {
                    continue;
                }

                options.push({ value, title: property.label?.trim() || value });
            }
        }
    }
    return options;
};

const resolveSelectOptions = (
    argument: IArgumentDefinition,
    rootValues: Record<string, unknown>,
    pluginsById: Record<string, Plugin>
): SelectOption[] => {
    const staticOptions = (argument.options ?? []).map((option) => ({
        value: option.key,
        title: option.label
    }));
    const dynamicOptions: SelectOption[] = [];

    for (const source of argument.optionsFromArguments ?? []) {
        const sourceArgument = source.argument?.trim();
        if (!sourceArgument) {
            continue;
        }

        const sourceValue = rootValues[sourceArgument];
        const entries = Array.isArray(sourceValue) ? sourceValue : [sourceValue];
        for (const entry of entries) {
            const optionValue = readDynamicOptionField(entry, source.valueField);
            if (!optionValue) {
                continue;
            }

            const optionLabel = readDynamicOptionField(entry, source.labelField) || optionValue;
            dynamicOptions.push({
                value: optionValue,
                title: optionLabel
            });
        }
    }

    const pluginReferenceOptions = resolvePluginReferenceOptions(argument, rootValues, pluginsById);

    const dedupedOptions = new Map<string, SelectOption>();
    for (const option of [...staticOptions, ...dynamicOptions, ...pluginReferenceOptions]) {
        if (!dedupedOptions.has(option.value)) {
            dedupedOptions.set(option.value, option);
        }
    }

    return Array.from(dedupedOptions.values());
};

const resolveListItemTitle = (
    argument: IArgumentDefinition,
    item: ListItemValue,
    itemIndex: number
): string => {
    const labelArgument = argument.listItemLabelArgument?.trim();
    if (!labelArgument) {
        return `Item ${itemIndex + 1}`;
    }

    const labelValue = item[labelArgument];
    const normalizedLabel = normalizeDynamicOptionValue(labelValue);
    return normalizedLabel || `Item ${itemIndex + 1}`;
};

const ArgumentFieldsRenderer = ({
    arguments: argumentDefinitions,
    values,
    rootValues,
    onChange,
    frameOptions,
    emptyMessage = 'No arguments configured.',
    path = 'root',
    autocompleteOptions,
    allowTemplateReferenceMode = false
}: ArgumentFieldsRendererProps) => {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const { publishedPluginsById } = usePluginSelectors();

    const resolvedFrameOptions = useMemo(() => frameOptions ?? [], [frameOptions]);
    const resolvedRootValues = useMemo(() => rootValues ?? values, [rootValues, values]);
    const configurableArgumentDefinitions = useMemo(() => {
        return getUserConfigurableArguments(argumentDefinitions);
    }, [argumentDefinitions]);
    const visibleArgumentDefinitions = useMemo(() => {
        return getVisibleArguments(configurableArgumentDefinitions, values);
    }, [configurableArgumentDefinitions, values]);

    const setSectionExpanded = useCallback((sectionKey: string, nextValue: boolean) => {
        setExpandedSections((previousState) => ({
            ...previousState,
            [sectionKey]: nextValue
        }));
    }, []);

    const handlePrimitiveChange = useCallback((argument: IArgumentDefinition, nextValue: string | number | boolean) => {
        onChange(argument.argument, coerceArgumentInputValue(argument, nextValue));
    }, [onChange]);

    const handleListItemChange = useCallback((
        argument: IArgumentDefinition,
        items: ListItemValue[],
        itemIndex: number,
        nestedKey: string,
        nextValue: unknown
    ) => {
        const nextItems = items.map((item, index) => {
            if (index !== itemIndex) {
                return item;
            }

            return {
                ...item,
                [nestedKey]: nextValue
            };
        });

        onChange(argument.argument, nextItems);
    }, [onChange]);

    const handleListItemRemove = useCallback((argument: IArgumentDefinition, items: ListItemValue[], itemIndex: number) => {
        onChange(argument.argument, items.filter((_, index) => index !== itemIndex));
    }, [onChange]);

    const handleListItemAdd = useCallback((argument: IArgumentDefinition, listPath: string, items: ListItemValue[]) => {
        const nextItemIndex = items.length;
        onChange(argument.argument, [...items, createDefaultListItem(argument.listArguments)]);
        setSectionExpanded(`${listPath}.${nextItemIndex}`, true);
    }, [onChange, setSectionExpanded]);

    const renderListItem = useCallback((argument: IArgumentDefinition, items: ListItemValue[], listPath: string) => {
        return (item: ListItemValue, itemIndex: number) => {
            const itemPath = `${listPath}.${itemIndex}`;
            const nestedArguments = argument.listArguments ?? [];
            const isExpanded = expandedSections[itemPath] ?? itemIndex === 0;

            return (
                <CollapsibleSection
                    key={itemPath}
                    title={resolveListItemTitle(argument, item, itemIndex)}
                    expanded={isExpanded}
                    onExpandedChange={(nextValue) => setSectionExpanded(itemPath, nextValue)}
                    onDelete={() => handleListItemRemove(argument, items, itemIndex)}
                    deleteActionLabel={`Remove ${argument.label || argument.argument} item ${itemIndex + 1}`}
                    noSpacing
                    className='canvas-argument-list-item'
                    bodyClassName='mt-05'
                >
                    <ArgumentFieldsRenderer
                        arguments={nestedArguments}
                        values={item}
                        onChange={(nestedKey, nextValue) => handleListItemChange(argument, items, itemIndex, nestedKey, nextValue)}
                        frameOptions={resolvedFrameOptions}
                        emptyMessage='No nested arguments configured.'
                        path={itemPath}
                        rootValues={resolvedRootValues}
                        autocompleteOptions={autocompleteOptions}
                        allowTemplateReferenceMode={allowTemplateReferenceMode}
                    />
                </CollapsibleSection>
            );
        };
    }, [
        allowTemplateReferenceMode,
        autocompleteOptions,
        expandedSections,
        handleListItemChange,
        handleListItemRemove,
        resolvedFrameOptions,
        resolvedRootValues,
        setSectionExpanded
    ]);

    const renderArgument = useCallback((argument: IArgumentDefinition, index: number) => {
        const argumentValue = values[argument.argument];
        const fieldKey = `${path}.${argument.argument}.${index}`;
        const selectOptions = resolveSelectOptions(argument, resolvedRootValues, publishedPluginsById);

        if (isPluginReferenceArgumentType(argument.type)) {
            return (
                <PluginConfigField
                    key={fieldKey}
                    argument={argument}
                    value={argumentValue}
                    onChange={onChange}
                    fieldKey={fieldKey}
                    frameOptions={resolvedFrameOptions}
                    autocompleteOptions={autocompleteOptions}
                />
            );
        }

        if (argument.type === ArgumentType.LIST) {
            const items = getListArgumentValue(argument, argumentValue);

            return (
                <Stack key={fieldKey} gap='05'>
                    <p className='canvas-form-label'>
                        {argument.label || argument.argument}
                    </p>
                    {items.length > 0 ? items.map(renderListItem(argument, items, fieldKey)) : (
                        <Text as='p' size='sm' tone='muted'>No items added.</Text>
                    )}
                    <Button
                        variant='outline'
                        intent='neutral'
                        size='sm'
                        className='w-max canvas-argument-list-add'
                        leftIcon={<Plus size={12} />}
                        onClick={() => handleListItemAdd(argument, fieldKey, items)}
                    >
                        Add New
                    </Button>
                </Stack>
            );
        }

        if (argument.type === ArgumentType.SELECT && argument.multipleSelection) {
            const selectedValues = getSelectArgumentValue(argument, argumentValue);
            const selectValues = Array.isArray(selectedValues) ? selectedValues : [];

            return (
                <Row key={fieldKey} justify='between' gap='1' className='form-field-canvas'>
                    <p className='canvas-form-label'>
                        {argument.label || argument.argument}
                    </p>
                    <Row justify='end' width='max' position='relative' className='render-input-container'>
                        <Select
                            id={`${fieldKey}-multi-select`}
                            options={selectOptions}
                            isMulti
                            selectedValues={selectValues}
                            onMultiChange={(nextValues) => onChange(argument.argument, coerceArgumentInputValue(argument, nextValues))}
                            placeholder='Select options'
                            className='form-field-canvas-select labeled-input'
                            aria-label={argument.label || argument.argument}
                            renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                selectedCount,
                                selectValues,
                                selectOptions,
                                'Select options',
                                'selected'
                            )}
                        />
                    </Row>
                </Row>
            );
        }

        const isTemplateReferenceMode = allowTemplateReferenceMode
            && typeof argumentValue === 'string'
            && argumentValue.includes('{{');

        const fieldConfig = getPrimitiveFieldConfig(
            argument,
            argumentValue,
            resolvedFrameOptions,
            selectOptions
        );

        return (
            <Stack key={fieldKey} gap='05'>
                {allowTemplateReferenceMode && (
                    <FormFieldRHF
                        label='Use reference'
                        fieldKey={`${fieldKey}-reference-mode`}
                        fieldType='checkbox'
                        fieldValue={isTemplateReferenceMode}
                        onFieldChange={(_, nextValue) => {
                            const enabled = Boolean(nextValue);
                            if (enabled) {
                                onChange(argument.argument, typeof argumentValue === 'string' ? argumentValue : '');
                                return;
                            }

                            onChange(argument.argument, getArgumentDefaultValue(argument));
                        }}
                        variant='canvas'
                    />
                )}
                <FormFieldRHF
                    label={argument.label || argument.argument}
                    fieldKey={fieldKey}
                    fieldType={isTemplateReferenceMode ? 'input' : fieldConfig.fieldType}
                    fieldValue={isTemplateReferenceMode ? String(argumentValue ?? '') : fieldConfig.fieldValue}
                    options={isTemplateReferenceMode ? undefined : fieldConfig.options}
                    inputProps={isTemplateReferenceMode ? undefined : fieldConfig.inputProps}
                    onFieldChange={(_, nextValue) => handlePrimitiveChange(argument, nextValue)}
                    variant='canvas'
                    autocomplete={autocompleteOptions?.length ? { options: autocompleteOptions } : undefined}
                    placeholder={isTemplateReferenceMode ? '{{ arguments.some-value }}' : undefined}
                />
            </Stack>
        );
    }, [
        allowTemplateReferenceMode,
        autocompleteOptions,
        handleListItemAdd,
        handlePrimitiveChange,
        onChange,
        path,
        publishedPluginsById,
        renderListItem,
        resolvedFrameOptions,
        resolvedRootValues,
        values
    ]);

    if (!visibleArgumentDefinitions.length) {
        return (
            <Text as='p' size='sm' tone='muted'>
                {emptyMessage}
            </Text>
        );
    }

    return (
        <Stack gap='05'>
            {visibleArgumentDefinitions.map(renderArgument)}
        </Stack>
    );
};

export default ArgumentFieldsRenderer;
