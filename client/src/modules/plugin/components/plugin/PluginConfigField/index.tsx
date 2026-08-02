import usePluginSelectors, { toPluginSelectOption } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import {
    getPluginReferenceValue,
    getUserConfigurableArguments
} from '@/modules/plugin/utils/plugin/argument-values';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import { CollapsibleSection, Row, Select, Stack, Text, getMultiSelectTriggerLabel } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
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
        <Stack gap='05'>
            <Row justify='between' gap='1' className='form-field-canvas'>
                <p className='canvas-form-label'>
                    {argument.label || argument.argument}
                </p>
                <Row justify='end' width='max' position='relative' className='render-input-container'>
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
                            renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                selectedCount,
                                selectedPluginIds,
                                pluginOptions,
                                'Select plugins',
                                'plugins selected'
                            )}
                        />
                    ) : (
                        <Select
                            id={`${fieldKey}-plugin-select`}
                            options={pluginOptions}
                            value={selectedPluginIds[0] ?? ''}
                            onChange={handleSinglePluginChange}
                            placeholder='Select…'
                            className='form-field-canvas-select labeled-input'
                            aria-label={argument.label || argument.argument}
                        />
                    )}
                </Row>
            </Row>

            {argument.showPluginConfiguration && pluginReferenceValue.selections.map((selection, index) => {
                const selectedPluginArguments = selectionArguments[selection.pluginId] ?? [];

                if (selectedPluginArguments.length === 0) {
                    return (
                        <Text as='p' key={`${selection.pluginId}-${index}`} size='sm' tone='muted'>
                            {getSelectionTitle(selection, pluginOptions)} has no configurable arguments.
                        </Text>
                    );
                }

                return (
                    <CollapsibleSection
                        key={`${selection.pluginId}-${index}`}
                        title={getSelectionTitle(selection, pluginOptions)}
                        defaultExpanded={index === 0}
                        noSpacing
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
                <Text as='p' size='sm' tone='muted'>
                    Plugin configuration will be resolved later by the plugin node or workflow runtime.
                </Text>
            )}
        </Stack>
    );
};

export default PluginConfigField;
