import { Button, CollapsibleSection, Row, Select, Stack, Text, getMultiSelectTriggerLabel } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
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
                    className='canvas-argument-list-item'
                    bodyClassName='mt-05'
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
                <Stack key={fieldKey} gap='05'>
                    <p className='canvas-form-label'>
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
                </Stack>
            );
        }

        if (argument.type === ArgumentType.LIST) {
            const items = getListArgumentValue(argument, argumentValue);

            return (
                <Stack key={fieldKey} gap='05'>
                    <p className='canvas-form-label'>
                        {argumentLabel}
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
                        onClick={() => {
                            onChange(argument.argument, [...items, createDefaultListItem(argument.listArguments)]);
                            setSectionExpanded(`${fieldKey}.${items.length}`, true);
                        }}
                    >
                        Add New
                    </Button>
                </Stack>
            );
        }

        const selectOptions = resolveSelectOptions(argument, resolvedRootValues, publishedPluginsById);

        if (argument.type === ArgumentType.SELECT && argument.multipleSelection) {
            const selectedValues = getSelectArgumentValue(argument, argumentValue);
            const selectValues = Array.isArray(selectedValues) ? selectedValues : [];

            return (
                <Row key={fieldKey} justify='between' gap='1' className='form-field-canvas'>
                    <p className='canvas-form-label'>
                        {argumentLabel}
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
                            aria-label={argumentLabel}
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
