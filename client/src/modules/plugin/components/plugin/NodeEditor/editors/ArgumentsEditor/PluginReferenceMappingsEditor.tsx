import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import ArgumentField from './ArgumentField';
import { ANY_PLUGIN_KEY_OPTION, ANY_PLUGIN_OPTION } from './argument-definition-constants';
import { isRecord } from '@/shared/utils/type-guards';
import { DashedActionBox, Row, Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { Plus, Trash2 } from 'lucide-react';
import type { IPluginReferenceArgumentMapping } from '@volt/contracts/modules/plugin/workflow';

interface PluginReferenceMappingsEditorProps {
    mappings: IPluginReferenceArgumentMapping[];
    fieldPrefix: string;
    sourceArgumentOptions: SelectOption[];
    pluginOptions: SelectOption[];
    pluginKeyOptions: SelectOption[];
    onMappingsChange: (nextMappings: IPluginReferenceArgumentMapping[] | undefined) => void;
}

const parseValueMapInput = (rawValue: string): Record<string, unknown> | undefined => {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
        return undefined;
    }

    try {
        const parsedValue: unknown = JSON.parse(trimmedValue);
        return isRecord(parsedValue) ? parsedValue : undefined;
    } catch {
        return undefined;
    }
};

const PluginReferenceMappingsEditor = ({
    mappings,
    fieldPrefix,
    sourceArgumentOptions,
    pluginOptions,
    pluginKeyOptions,
    onMappingsChange
}: PluginReferenceMappingsEditorProps) => {
    const { publishedPlugins, getPluginArguments } = usePluginSelectors();

    const updateMapping = (mappingIndex: number, patch: Partial<IPluginReferenceArgumentMapping>) => {
        onMappingsChange(mappings.map((mapping, index) => {
            if (index !== mappingIndex) {
                return mapping;
            }

            return {
                ...mapping,
                ...patch
            };
        }));
    };

    const removeMapping = (mappingIndex: number) => {
        const nextMappings = mappings.filter((_, index) => index !== mappingIndex);
        onMappingsChange(nextMappings.length > 0 ? nextMappings : undefined);
    };

    const addMapping = () => {
        onMappingsChange([...mappings, {
            sourceArgument: sourceArgumentOptions[0]?.value ?? '',
            targetArgument: ''
        }]);
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
                if (!definition.argument.trim() || optionsByArgument.has(definition.argument)) {
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
        <Stack gap='05'>
            {mappings.map((mapping, mappingIndex) => {
                const targetArgumentOptions = getTargetArgumentOptions(mapping);
                const hasCurrentTargetArgument = targetArgumentOptions.some((option) => option.value === mapping.targetArgument);
                const targetOptions = hasCurrentTargetArgument || !mapping.targetArgument.trim()
                    ? targetArgumentOptions
                    : [{
                        value: mapping.targetArgument,
                        title: mapping.targetArgument
                    }, ...targetArgumentOptions];
                const hasTargetOptions = targetOptions.length > 0;

                return (
                    <div key={`${fieldPrefix}-mapping-${mappingIndex}`} className='argument-row-subblock argument-row-nested'>
                        <Row justify='between' gap='05' className='mb-05'>
                            <Text as='span' size='sm' tone='muted'>Mapping {mappingIndex + 1}</Text>
                            <button
                                type='button'
                                className='argument-row-delete'
                                onClick={() => removeMapping(mappingIndex)}
                                aria-label={`Delete mapping ${mappingIndex + 1}`}
                                title='Delete mapping'
                            >
                                <Trash2 size={14} aria-hidden='true' />
                            </button>
                        </Row>
                        <ArgumentField
                            label='Source'
                            name={`plugin-reference-mapping-source-${fieldPrefix}-${mappingIndex}`}
                            fieldType='select'
                            value={mapping.sourceArgument}
                            onChange={(event) => updateMapping(mappingIndex, { sourceArgument: event.target.value })}
                            options={sourceArgumentOptions}
                        />
                        <ArgumentField
                            label='Target plugin'
                            name={`plugin-reference-mapping-plugin-${fieldPrefix}-${mappingIndex}`}
                            fieldType='select'
                            value={mapping.targetPluginId ?? ''}
                            onChange={(event) => updateMapping(mappingIndex, { targetPluginId: event.target.value || undefined })}
                            options={[ANY_PLUGIN_OPTION, ...pluginOptions]}
                        />
                        <ArgumentField
                            label='Target key'
                            name={`plugin-reference-mapping-key-${fieldPrefix}-${mappingIndex}`}
                            fieldType='select'
                            value={mapping.targetPluginKey ?? ''}
                            onChange={(event) => updateMapping(mappingIndex, { targetPluginKey: event.target.value || undefined })}
                            options={[ANY_PLUGIN_KEY_OPTION, ...pluginKeyOptions]}
                        />
                        <ArgumentField
                            label='Target argument'
                            name={`plugin-reference-mapping-target-${fieldPrefix}-${mappingIndex}`}
                            fieldType={hasTargetOptions ? 'select' : 'input'}
                            value={mapping.targetArgument}
                            onChange={(event) => updateMapping(mappingIndex, { targetArgument: event.target.value })}
                            options={targetOptions}
                            placeholder={hasTargetOptions ? undefined : 'crystalStructure'}
                        />
                        <ArgumentField
                            label='Value map'
                            name={`plugin-reference-mapping-value-map-${fieldPrefix}-${mappingIndex}`}
                            fieldType='textarea'
                            value={mapping.valueMap ? JSON.stringify(mapping.valueMap) : ''}
                            onChange={(event) => updateMapping(mappingIndex, { valueMap: parseValueMapInput(event.target.value) })}
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
                onClick={addMapping}
            />
        </Stack>
    );
};

export default PluginReferenceMappingsEditor;
