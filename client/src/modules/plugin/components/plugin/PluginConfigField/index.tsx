import { PluginStatus } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import {
    getPluginReferenceValue,
    getUserConfigurableArguments
} from '@/modules/plugin/utilities/plugin/argument-values';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import CollapsibleSection from '@/shared/presentation/primitives/CollapsibleSection';
import Select from '@/shared/presentation/primitives/Select';
import { useCallback, useMemo } from 'react';
import type {
    IArgumentDefinition,
    IPluginReferenceSelection
} from '@/modules/plugin/api/entities/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF/FormFieldRHF.types';
import type { SelectOption } from '@/shared/presentation/primitives/Select';

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

        return publishedPlugins
            .filter((plugin) => {
                if (plugin.status !== PluginStatus.PUBLISHED) {
                    return false;
                }

                if (allowedPluginIds.size === 0 && allowedPluginKeys.size === 0) {
                    return true;
                }

                const pluginKey = plugin.modifier?.key?.trim();
                return allowedPluginIds.has(plugin._id)
                    || (pluginKey ? allowedPluginKeys.has(pluginKey) : false);
            })
            .map((plugin) => ({
                value: plugin._id,
                title: plugin.modifier?.name?.trim() || plugin._id
            }));
    }, [argument.pluginReferenceFilter, argument.pluginReferenceFilterKeys, publishedPlugins]);

    const selectedPluginIds = useMemo(() => {
        return pluginReferenceValue.selections.map((selection) => selection.pluginId);
    }, [pluginReferenceValue.selections]);

    const selectionArguments = useMemo(() => {
        return Object.fromEntries(pluginReferenceValue.selections.map((selection) => [
            selection.pluginId,
            getUserConfigurableArguments(getPluginArguments(selection.pluginId)).filter((definition) => {
                const pluginKey = publishedPlugins.find((plugin) => plugin._id === selection.pluginId)?.modifier?.key?.trim() ?? '';
                return !getMappedTargetArguments(argument, selection.pluginId, pluginKey).has(definition.argument);
            })
        ]));
    }, [argument, getPluginArguments, pluginReferenceValue.selections, publishedPlugins]);

    const updateSelections = useCallback((nextSelections: IPluginReferenceSelection[]) => {
        onChange(argument.argument, {
            selections: nextSelections
        });
    }, [argument.argument, onChange]);

    const handleSinglePluginChange = useCallback((_: string, nextValue: string | number | boolean) => {
        const nextPluginId = typeof nextValue === 'string' ? nextValue.trim() : String(nextValue).trim();
        updateSelections(nextPluginId ? [{
            pluginId: nextPluginId,
            config: {}
        }] : []);
    }, [updateSelections]);

    const handleMultiPluginChange = useCallback((nextPluginIds: string[]) => {
        const existingSelections = new Map(pluginReferenceValue.selections.map((selection) => [selection.pluginId, selection]));
        updateSelections(nextPluginIds.map((pluginId) => existingSelections.get(pluginId) ?? {
            pluginId,
            config: {}
        }));
    }, [pluginReferenceValue.selections, updateSelections]);

    const createConfigFieldChangeHandler = useCallback((pluginId: string) => {
        return (configKey: string, configValue: unknown) => {
            const nextSelections = pluginReferenceValue.selections.map((selection) => {
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
            });

            updateSelections(nextSelections);
        };
    }, [pluginReferenceValue.selections, updateSelections]);

    return (
        <div className='d-flex column gap-05'>
            <div className='form-field-canvas d-flex content-between items-center gap-1'>
                <p className='canvas-form-label'>
                    {argument.label || argument.argument}
                </p>
                <div className='d-flex items-center render-input-container w-max content-end p-relative'>
                    {argument.multipleSelection ? (
                        <Select
                            id={`${fieldKey}-plugins-select`}
                            options={pluginOptions}
                            isMulti
                            selectedValues={selectedPluginIds}
                            onMultiChange={handleMultiPluginChange}
                            hasSearch
                            placeholder='Select plugins'
                            className='form-field-canvas-select labeled-input'
                            aria-label={argument.label || argument.argument}
                            renderTriggerLabel={(selectedCount) => {
                                if (selectedCount === 0) {
                                    return 'Select plugins';
                                }

                                if (selectedCount === 1) {
                                    const selectedPluginId = selectedPluginIds[0];
                                    return pluginOptions.find((option) => option.value === selectedPluginId)?.title ?? '1 selected';
                                }

                                return `${selectedCount} plugins selected`;
                            }}
                        />
                    ) : (
                        <Select
                            id={`${fieldKey}-plugin-select`}
                            options={pluginOptions}
                            value={selectedPluginIds[0] ?? ''}
                            onChange={(nextPluginId) => handleSinglePluginChange(argument.argument, nextPluginId)}
                            placeholder='Select…'
                            className='form-field-canvas-select labeled-input'
                            aria-label={argument.label || argument.argument}
                        />
                    )}
                </div>
            </div>

            {argument.showPluginConfiguration && pluginReferenceValue.selections.map((selection, index) => {
                const selectedPluginArguments = selectionArguments[selection.pluginId] ?? [];

                if (selectedPluginArguments.length === 0) {
                    return (
                        <p key={`${selection.pluginId}-${index}`} className='font-size-1 color-muted'>
                            {getSelectionTitle(selection, pluginOptions)} has no configurable arguments.
                        </p>
                    );
                }

                return (
                    <CollapsibleSection
                        key={`${selection.pluginId}-${index}`}
                        title={getSelectionTitle(selection, pluginOptions)}
                        defaultExpanded={index === 0}
                        className='mb-0'
                        bodyClassName='mt-05'
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
                <p className='font-size-1 color-muted'>
                    Plugin configuration will be resolved later by the plugin node or workflow runtime.
                </p>
            )}
        </div>
    );
};

export default PluginConfigField;
