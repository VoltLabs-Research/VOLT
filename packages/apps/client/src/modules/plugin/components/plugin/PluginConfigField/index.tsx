import usePluginSelectors, { toPluginSelectOption } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import {
    getPluginReferenceValue,
    getUserConfigurableArguments
} from '@/modules/plugin/utils/plugin/argument-values';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import CollapsibleSection from '@/modules/plugin/components/plugin/CollapsibleSection';
import { PluginMultiSelect, PluginSelect } from '@/modules/plugin/components/plugin/PluginSelect';
import { getMultiSelectTriggerLabel } from '@/modules/plugin/contracts/select-option';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
import { cn } from '@heroui/react';
import {
    COMPACT_FIELD_LABEL_COLUMN,
    COMPACT_FIELD_ROW,
    COMPACT_FIELD_TRIGGER,
    COMPACT_FIELD_VALUE
} from '@/shared/ui/utils/field-density';
import { useMemo } from 'react';
import type {
    IArgumentDefinition,
    IPluginReferenceSelection
} from '@volt/contracts/modules/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/contracts/form-field';

interface PluginConfigFieldProps {
    argument: IArgumentDefinition;
    value: unknown;
    onChange: (key: string, value: unknown) => void;
    fieldKey: string;
    frameOptions?: SelectOption[];
    autocompleteOptions?: FormFieldAutocompleteOption[];
}

const getSelectionTitle = (selection: IPluginReferenceSelection, pluginOptions: SelectOption[]): string => {
    return pluginOptions.find((option) => option.value === selection.pluginId)?.title ?? selection.pluginId;
};

const getMappedTargetArguments = (
    argument: IArgumentDefinition,
    pluginId: string,
    pluginKey: string
): Set<string> => {
    const mappedArguments = new Set<string>();

    for (const mapping of argument.pluginReferenceMappings ?? []) {
        const targetArgument = mapping.targetArgument?.trim();
        if (!targetArgument) {
            continue;
        }

        const targetPluginId = mapping.targetPluginId?.trim();
        const targetPluginKey = mapping.targetPluginKey?.trim();
        const matchesPluginId = targetPluginId ? targetPluginId === pluginId : true;
        const matchesPluginKey = targetPluginKey ? targetPluginKey === pluginKey : true;

        if (matchesPluginId && matchesPluginKey) {
            mappedArguments.add(targetArgument);
        }
    }

    return mappedArguments;
};

const PluginConfigField = ({
    argument,
    value,
    onChange,
    fieldKey,
    frameOptions,
    autocompleteOptions
}: PluginConfigFieldProps) => {
    const { publishedPlugins, getPluginArguments } = usePluginSelectors();
    const pluginReferenceValue = getPluginReferenceValue(argument, value);

    const pluginOptions = useMemo<SelectOption[]>(() => {
        const allowedPluginIds = new Set(argument.pluginReferenceFilter ?? []);
        const allowedPluginKeys = new Set(argument.pluginReferenceFilterKeys ?? []);

        if (allowedPluginIds.size === 0 && allowedPluginKeys.size === 0) {
            return publishedPlugins.map(toPluginSelectOption);
        }

        return publishedPlugins
            .filter((plugin) => {
                const pluginKey = plugin.modifier?.key?.trim();
                return allowedPluginIds.has(plugin._id)
                    || (pluginKey ? allowedPluginKeys.has(pluginKey) : false);
            })
            .map(toPluginSelectOption);
    }, [argument.pluginReferenceFilter, argument.pluginReferenceFilterKeys, publishedPlugins]);

    const selectedPluginIds = pluginReferenceValue.selections.map((selection) => selection.pluginId);

    const selectionArguments = useMemo(() => {
        return Object.fromEntries(pluginReferenceValue.selections.map((selection) => {
            const pluginKey = publishedPlugins.find((plugin) => plugin._id === selection.pluginId)?.modifier?.key?.trim() ?? '';
            const mappedArguments = getMappedTargetArguments(argument, selection.pluginId, pluginKey);

            return [
                selection.pluginId,
                getUserConfigurableArguments(getPluginArguments(selection.pluginId))
                    .filter((definition) => !mappedArguments.has(definition.argument))
            ];
        }));
    }, [argument, getPluginArguments, pluginReferenceValue.selections, publishedPlugins]);

    const updateSelections = (nextSelections: IPluginReferenceSelection[]) => {
        onChange(argument.argument, {
            selections: nextSelections
        });
    };

    const handleSinglePluginChange = (nextValue: string) => {
        const nextPluginId = nextValue.trim();
        updateSelections(nextPluginId ? [{
            pluginId: nextPluginId,
            config: {}
        }] : []);
    };

    const handleMultiPluginChange = (nextPluginIds: string[]) => {
        const existingSelections = new Map(pluginReferenceValue.selections.map((selection) => [selection.pluginId, selection]));
        updateSelections(nextPluginIds.map((pluginId) => existingSelections.get(pluginId) ?? {
            pluginId,
            config: {}
        }));
    };

    const createConfigFieldChangeHandler = (pluginId: string) => {
        return (configKey: string, configValue: unknown) => {
            updateSelections(pluginReferenceValue.selections.map((selection) => {
                if (selection.pluginId !== pluginId) {
                    return selection;
                }

                return {
                    ...selection,
                    config: {
                        ...(selection.config ?? {}),
                        [configKey]: configValue
                    }
                };
            }));
        };
    };

    return (
        <div className='flex flex-col gap-2'>
            <div className={cn('form-field-canvas', COMPACT_FIELD_ROW)}>
                <p className={cn('canvas-form-label', COMPACT_FIELD_LABEL_COLUMN)}>
                    {argument.label || argument.argument}
                </p>
                <div className='render-input-container flex items-center justify-end relative w-full min-w-0 max-w-[150px]'>
                    {argument.multipleSelection ? (
                        <PluginMultiSelect
                            id={`${fieldKey}-plugins-select`}
                            options={pluginOptions}
                            selectedValues={selectedPluginIds}
                            onMultiChange={handleMultiPluginChange}
                            hasSearch
                            searchPlaceholder='Search plugins…'
                            placeholder='Select plugins'
                            className='form-field-canvas-select labeled-input flex-1 min-w-0'
                            triggerClassName={cn('w-full', COMPACT_FIELD_TRIGGER)}
                            valueClassName={COMPACT_FIELD_VALUE}
                            ariaLabel={argument.label || argument.argument}
                            renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                selectedCount,
                                selectedPluginIds,
                                pluginOptions,
                                'Select plugins',
                                'plugins selected'
                            )}
                        />
                    ) : (
                        <PluginSelect
                            id={`${fieldKey}-plugin-select`}
                            options={pluginOptions}
                            value={selectedPluginIds[0] ?? ''}
                            onChange={handleSinglePluginChange}
                            placeholder='Select…'
                            className='form-field-canvas-select labeled-input flex-1 min-w-0'
                            triggerClassName={cn('w-full', COMPACT_FIELD_TRIGGER)}
                            valueClassName={COMPACT_FIELD_VALUE}
                            ariaLabel={argument.label || argument.argument}
                        />
                    )}
                </div>
            </div>

            {argument.showPluginConfiguration && pluginReferenceValue.selections.map((selection, index) => {
                const selectedPluginArguments = selectionArguments[selection.pluginId] ?? [];

                if (selectedPluginArguments.length === 0) {
                    return (
                        <p className='text-xs text-muted' key={`${selection.pluginId}-${index}`}>
                            {getSelectionTitle(selection, pluginOptions)} has no configurable arguments.
                        </p>
                    );
                }

                return (
                    <CollapsibleSection
                        key={`${selection.pluginId}-${index}`}
                        title={getSelectionTitle(selection, pluginOptions)}
                        defaultExpanded={index === 0}
                        noSpacing
                        bodyClassName='mt-2'
                    >
                        <ArgumentFieldsRenderer
                            arguments={selectedPluginArguments}
                            values={selection.config ?? {}}
                            onChange={createConfigFieldChangeHandler(selection.pluginId)}
                            frameOptions={frameOptions}
                            emptyMessage='No arguments for selected plugin.'
                            autocompleteOptions={autocompleteOptions}
                        />
                    </CollapsibleSection>
                );
            })}

            {selectedPluginIds.length > 0 && !argument.showPluginConfiguration && (
                <p className='text-xs text-muted'>
                    Plugin configuration will be resolved later by the plugin node or workflow runtime.
                </p>
            )}
        </div>
    );
};

export default PluginConfigField;
