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
import Button from '@/shared/presentation/components/Button';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Select from '@/shared/presentation/components/Select';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface ArgumentFieldsRendererProps {
    arguments: IArgumentDefinition[];
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    frameOptions?: SelectOption[];
    emptyMessage?: string;
    path?: string;
    autocompleteOptions?: FormFieldAutocompleteOption[];
    allowTemplateReferenceMode?: boolean;
};

interface ListItemValue {
    [key: string]: unknown;
};

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
};

const getPrimitiveFieldConfig = (
    argument: IArgumentDefinition,
    value: unknown,
    frameOptions: SelectOption[]
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
            options: (argument.options ?? []).map((option) => ({
                value: option.key,
                title: option.label
            }))
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

const ArgumentFieldsRenderer = ({
    arguments: argumentDefinitions,
    values,
    onChange,
    frameOptions,
    emptyMessage = 'No arguments configured.',
    path = 'root',
    autocompleteOptions,
    allowTemplateReferenceMode = false
}: ArgumentFieldsRendererProps) => {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const resolvedFrameOptions = useMemo(() => frameOptions ?? [], [frameOptions]);
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
                    title={`Item ${itemIndex + 1}`}
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
                <div key={fieldKey} className='volt-container d-flex column gap-05'>
                    <p className='volt-text canvas-form-label'>
                        {argument.label || argument.argument}
                    </p>
                    {items.length > 0 ? items.map(renderListItem(argument, items, fieldKey)) : (
                        <p className='volt-text font-size-1 color-muted'>No items added.</p>
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
            const selectOptions = (argument.options ?? []).map((option) => ({
                value: option.key,
                title: option.label
            }));

            return (
                <div key={fieldKey} className='volt-container d-flex column gap-05'>
                    <p className='volt-text canvas-form-label'>
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

        const fieldConfig = getPrimitiveFieldConfig(argument, argumentValue, resolvedFrameOptions);

        return (
            <div key={fieldKey} className='volt-container d-flex column gap-05'>
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
        values
    ]);

    if (!visibleArgumentDefinitions.length) {
        return (
            <p className='volt-text font-size-1 color-muted'>
                {emptyMessage}
            </p>
        );
    }

    return (
        <div className='volt-container d-flex column gap-05'>
            {visibleArgumentDefinitions.map(renderArgument)}
        </div>
    );
};

export default ArgumentFieldsRenderer;
