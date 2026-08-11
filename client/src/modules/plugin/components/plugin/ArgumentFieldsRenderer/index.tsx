import { Button } from '@heroui/react';
import CollapsibleSection from '@/modules/plugin/components/plugin/CollapsibleSection';
import { PluginMultiSelect } from '@/modules/plugin/components/plugin/PluginSelect';
import { getMultiSelectTriggerLabel } from '@/modules/plugin/contracts/select-option';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
import { ArgumentType } from '@volt/contracts/modules/plugin/enums';
import {
    coerceArgumentInputValue,
    createDefaultListItem,
    getUserConfigurableArguments,
    getListArgumentValue,
    getTupleArgumentValue,
    getSelectArgumentValue,
    isPluginReferenceArgumentType
} from '@/modules/plugin/utils/plugin/argument-values';
import { getVisibleArguments } from '@/modules/plugin/utils/plugin/argument-visibility';
import PluginConfigField from '@/modules/plugin/components/plugin/PluginConfigField';
import PrimitiveArgumentField from './PrimitiveArgumentField';
import { normalizeDynamicOptionValue, resolveSelectOptions } from './argument-select-options';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { FormFieldAutocompleteOption } from '@/shared/contracts/form-field';

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

const ArgumentFieldsRenderer = ({
    arguments: argumentDefinitions,
    values,
    rootValues,
    onChange,
    frameOptions = [],
    emptyMessage = 'No arguments configured.',
    path = 'root',
    autocompleteOptions,
    allowTemplateReferenceMode = false
}: ArgumentFieldsRendererProps) => {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const { publishedPluginsById } = usePluginSelectors();

    const resolvedRootValues = rootValues ?? values;
    const visibleArgumentDefinitions = getVisibleArguments(
        getUserConfigurableArguments(argumentDefinitions),
        values
    );

    const setSectionExpanded = (sectionKey: string, nextValue: boolean) => {
        setExpandedSections((previousState) => ({
            ...previousState,
            [sectionKey]: nextValue
        }));
    };

    const renderListItem = (argument: IArgumentDefinition, items: Record<string, unknown>[], listPath: string) => {
        return (item: Record<string, unknown>, itemIndex: number) => {
            const itemPath = `${listPath}.${itemIndex}`;
            const labelArgument = argument.listItemLabelArgument?.trim();
            const itemTitle = normalizeDynamicOptionValue(labelArgument ? item[labelArgument] : undefined);

            const handleItemFieldChange = (nestedKey: string, nextValue: unknown) => {
                onChange(argument.argument, items.map((currentItem, index) => {
                    if (index !== itemIndex) {
                        return currentItem;
                    }

                    return {
                        ...currentItem,
                        [nestedKey]: nextValue
                    };
                }));
            };

            return (
                <CollapsibleSection
                    key={itemPath}
                    title={itemTitle || `Item ${itemIndex + 1}`}
                    expanded={expandedSections[itemPath] ?? itemIndex === 0}
                    onExpandedChange={(nextValue) => setSectionExpanded(itemPath, nextValue)}
                    onDelete={() => onChange(argument.argument, items.filter((_, index) => index !== itemIndex))}
                    deleteActionLabel={`Remove ${argument.label || argument.argument} item ${itemIndex + 1}`}
                    noSpacing
                    isCompact
                    bodyClassName='mt-2'
                >
                    <ArgumentFieldsRenderer
                        arguments={argument.listArguments ?? []}
                        values={item}
                        onChange={handleItemFieldChange}
                        frameOptions={frameOptions}
                        emptyMessage='No nested arguments configured.'
                        path={itemPath}
                        rootValues={resolvedRootValues}
                        autocompleteOptions={autocompleteOptions}
                        allowTemplateReferenceMode={allowTemplateReferenceMode}
                    />
                </CollapsibleSection>
            );
        };
    };

    const renderArgument = (argument: IArgumentDefinition, index: number) => {
        const argumentValue = values[argument.argument];
        const fieldKey = `${path}.${argument.argument}.${index}`;
        const argumentLabel = argument.label || argument.argument;

        if (isPluginReferenceArgumentType(argument.type)) {
            return (
                <PluginConfigField
                    key={fieldKey}
                    argument={argument}
                    value={argumentValue}
                    onChange={onChange}
                    fieldKey={fieldKey}
                    frameOptions={frameOptions}
                    autocompleteOptions={autocompleteOptions}
                />
            );
        }

        if (argument.type === ArgumentType.TUPLE) {
            const tupleValue = getTupleArgumentValue(argument, argumentValue);

            return (
                <div className='flex flex-col gap-2' key={fieldKey}>
                    <p className='canvas-form-label min-w-[130px] shrink-0 text-[0.7rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis leading-6 tracking-[0.01em]'>
                        {argumentLabel}
                    </p>
                    <ArgumentFieldsRenderer
                        arguments={argument.listArguments ?? []}
                        values={tupleValue}
                        onChange={(nestedKey, nextValue) => onChange(argument.argument, {
                            ...tupleValue,
                            [nestedKey]: nextValue
                        })}
                        frameOptions={frameOptions}
                        emptyMessage='No tuple components configured.'
                        path={fieldKey}
                        rootValues={resolvedRootValues}
                        autocompleteOptions={autocompleteOptions}
                        allowTemplateReferenceMode={allowTemplateReferenceMode}
                    />
                </div>
            );
        }

        if (argument.type === ArgumentType.LIST) {
            const items = getListArgumentValue(argument, argumentValue);

            return (
                <div className='flex flex-col gap-2' key={fieldKey}>
                    <p className='canvas-form-label min-w-[130px] shrink-0 text-[0.7rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis leading-6 tracking-[0.01em]'>
                        {argumentLabel}
                    </p>
                    {items.length > 0 ? items.map(renderListItem(argument, items, fieldKey)) : (
                        <p className='text-xs text-muted'>No items added.</p>
                    )}
                    <Button
                        variant='outline'
                        size='sm'
                        fullWidth
                        className='h-6 min-h-6 px-2 text-[0.7rem]'
                        onPress={() => {
                            onChange(argument.argument, [...items, createDefaultListItem(argument.listArguments)]);
                            setSectionExpanded(`${fieldKey}.${items.length}`, true);
                        }}
                    >
                        <Plus size={12} aria-hidden='true' />
                        Add New
                    </Button>
                </div>
            );
        }

        const selectOptions = resolveSelectOptions(argument, resolvedRootValues, publishedPluginsById);

        if (argument.type === ArgumentType.SELECT && argument.multipleSelection) {
            const selectedValues = getSelectArgumentValue(argument, argumentValue);
            const selectValues = Array.isArray(selectedValues) ? selectedValues : [];

            return (
                <div className='form-field-canvas flex flex-row items-center justify-between gap-2 min-h-6' key={fieldKey}>
                    <p className='canvas-form-label min-w-[130px] shrink-0 text-[0.7rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis leading-6 tracking-[0.01em]'>
                        {argumentLabel}
                    </p>
                    <div className='render-input-container flex items-center justify-end relative w-full min-w-0 max-w-[150px]'>
                        <PluginMultiSelect
                            id={`${fieldKey}-multi-select`}
                            options={selectOptions}
                            selectedValues={selectValues}
                            onMultiChange={(nextValues) => onChange(argument.argument, coerceArgumentInputValue(argument, nextValues))}
                            placeholder='Select options'
                            className='form-field-canvas-select labeled-input flex-1 min-w-0'
                            triggerClassName='w-full h-6 min-h-6 py-0 ps-[0.4rem] pe-6 border border-border rounded-lg bg-transparent text-foreground transition-colors duration-150 ease-out hover:border-border-secondary'
                            valueClassName='text-[0.7rem]'
                            ariaLabel={argumentLabel}
                            renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                selectedCount,
                                selectValues,
                                selectOptions,
                                'Select options',
                                'selected'
                            )}
                        />
                    </div>
                </div>
            );
        }

        return (
            <PrimitiveArgumentField
                key={fieldKey}
                argument={argument}
                value={argumentValue}
                fieldKey={fieldKey}
                frameOptions={frameOptions}
                selectOptions={selectOptions}
                autocompleteOptions={autocompleteOptions}
                allowTemplateReferenceMode={allowTemplateReferenceMode}
                onChange={onChange}
            />
        );
    };

    if (!visibleArgumentDefinitions.length) {
        return (
            <p className='text-xs text-muted'>
                {emptyMessage}
            </p>
        );
    }

    return (
        <div className='flex flex-col gap-2'>
            {visibleArgumentDefinitions.map(renderArgument)}
        </div>
    );
};

export default ArgumentFieldsRenderer;
