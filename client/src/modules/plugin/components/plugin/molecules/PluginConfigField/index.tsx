import { PluginStatus } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getPluginReferenceValue } from '@/modules/plugin/utilities/plugin/argument-values';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/molecules/ArgumentFieldsRenderer';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import { useCallback, useMemo } from 'react';
import type {
    IArgumentDefinition,
    IPluginReferenceSelection
} from '@/modules/plugin/api/entities/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface PluginConfigFieldProps {
    argument: IArgumentDefinition;
    value: unknown;
    onChange: (key: string, value: unknown) => void;
    fieldKey: string;
    frameOptions?: SelectOption[];
    autocompleteOptions?: FormFieldAutocompleteOption[];
};

const getSelectionTitle = (selection: IPluginReferenceSelection, pluginOptions: SelectOption[]): string => {
    return pluginOptions.find((option) => option.value === selection.pluginId)?.title ?? selection.pluginId;
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

        return publishedPlugins
            .filter((plugin) => {
                if (plugin.status !== PluginStatus.PUBLISHED) {
                    return false;
                }

                if (allowedPluginIds.size === 0) {
                    return true;
                }

                return allowedPluginIds.has(plugin._id);
            })
            .map((plugin) => ({
                value: plugin._id,
                title: plugin.modifier?.name?.trim() || plugin._id
            }));
    }, [argument.pluginReferenceFilter, publishedPlugins]);

    const selectedPluginIds = useMemo(() => {
        return pluginReferenceValue.selections.map((selection) => selection.pluginId);
    }, [pluginReferenceValue.selections]);

    const selectionArguments = useMemo(() => {
        return Object.fromEntries(pluginReferenceValue.selections.map((selection) => [
            selection.pluginId,
            getPluginArguments(selection.pluginId).filter((arg) => arg.value === undefined)
        ]));
    }, [getPluginArguments, pluginReferenceValue.selections]);

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
        <Container className='d-flex column gap-05'>
            <Paragraph className='canvas-form-label'>
                {argument.label || argument.argument}
            </Paragraph>
            {argument.multipleSelection ? (
                <Container className='d-flex column gap-05'>
                    <Paragraph className='canvas-form-label'>Referenced Plugins</Paragraph>
                    <Select
                        id={`${fieldKey}-plugins-select`}
                        options={pluginOptions}
                        isMulti
                        selectedValues={selectedPluginIds}
                        onMultiChange={handleMultiPluginChange}
                        hasSearch
                        placeholder='Select plugins'
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
                </Container>
            ) : (
                <FormFieldRHF
                    label='Referenced Plugin'
                    fieldKey={`${fieldKey}-plugin-select`}
                    fieldType='select'
                    fieldValue={selectedPluginIds[0] ?? ''}
                    options={pluginOptions}
                    onFieldChange={handleSinglePluginChange}
                    variant='canvas'
                />
            )}

            {argument.showPluginConfiguration && pluginReferenceValue.selections.map((selection, index) => {
                const selectedPluginArguments = selectionArguments[selection.pluginId] ?? [];

                if (selectedPluginArguments.length === 0) {
                    return (
                        <Paragraph key={`${selection.pluginId}-${index}`} className='font-size-1 color-muted'>
                            {getSelectionTitle(selection, pluginOptions)} has no configurable arguments.
                        </Paragraph>
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
                <Paragraph className='font-size-1 color-muted'>
                    Plugin configuration will be resolved later by the plugin node or workflow runtime.
                </Paragraph>
            )}
            {selectedPluginIds.length === 0 && (
                <Paragraph className='font-size-1 color-muted'>
                    Select {argument.multipleSelection ? 'one or more plugins' : 'a plugin'} to continue.
                </Paragraph>
            )}
        </Container>
    );
};

export default PluginConfigField;
