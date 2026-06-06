import Button from '@/shared/presentation/primitives/Button';
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
import CollapsibleSection from '@/shared/presentation/primitives/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Select from '@/shared/presentation/primitives/Select';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF/FormFieldRHF.types';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import { isRecord } from '@/shared/utils/type-guards';

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

const resolveSelectOptions = (
    argument: IArgumentDefinition,
    rootValues: Record<string, unknown>
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

    const dedupedOptions = new Map<string, SelectOption>();
    for (const option of [...staticOptions, ...dynamicOptions]) {
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
                    className='mb-0'
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
        setSectionExpanded
    ]);

    const renderArgument = useCallback((argument: IArgumentDefinition, index: number) => {
        const argumentValue = values[argument.argument];
        const fieldKey = `${path}.${argument.argument}.${index}`;
        const selectOptions = resolveSelectOptions(argument, resolvedRootValues);

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
                <div key={fieldKey} className='d-flex column gap-05'>
                    <p className='canvas-form-label'>
                        {argument.label || argument.argument}
                    </p>
                    {items.length > 0 ? items.map(renderListItem(argument, items, fieldKey)) : (
                        <p className='font-size-1 color-muted'>No items added.</p>
                    )}
                    <Button
                        variant='outline'
                        intent='neutral'
                        size='sm'
                        className='w-max'
                        leftIcon={<Plus size={12} />}
                        onClick={() => handleListItemAdd(argument, fieldKey, items)}
                    >
                        Add New
                    </Button>
                </div>
            );
        }

        if (argument.type === ArgumentType.SELECT && argument.multipleSelection) {
            const selectedValues = getSelectArgumentValue(argument, argumentValue);
            const selectValues = Array.isArray(selectedValues) ? selectedValues : [];

            return (
                <div key={fieldKey} className='d-flex column gap-05'>
                    <p className='canvas-form-label'>
                        {argument.label || argument.argument}
                    </p>
                    <Select
                        id={`${fieldKey}-multi-select`}
                        options={selectOptions}
                        isMulti
                        selectedValues={selectValues}
                        onMultiChange={(nextValues) => onChange(argument.argument, coerceArgumentInputValue(argument, nextValues))}
                        placeholder='Select options'
                        renderTriggerLabel={(selectedCount) => {
                            if (selectedCount === 0) {
                                return 'Select options';
                            }

                            if (selectedCount === 1) {
                                const selectedValue = selectValues[0];
                                return selectOptions.find((option) => option.value === selectedValue)?.title ?? '1 selected';
                            }

                            return `${selectedCount} selected`;
                        }}
                    />
                </div>
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
            <div key={fieldKey} className='d-flex column gap-05'>
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
            </div>
        );
    }, [
        allowTemplateReferenceMode,
        autocompleteOptions,
        handleListItemAdd,
        handlePrimitiveChange,
        onChange,
        path,
        renderListItem,
        resolvedFrameOptions,
        resolvedRootValues,
        values
    ]);

    if (!visibleArgumentDefinitions.length) {
        return (
            <p className='font-size-1 color-muted'>
                {emptyMessage}
            </p>
        );
    }

    return (
        <div className='d-flex column gap-05'>
            {visibleArgumentDefinitions.map(renderArgument)}
        </div>
    );
};

export default ArgumentFieldsRenderer;
