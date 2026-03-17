import { PluginStatus } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getPluginConfigValue, type PluginConfigValue } from '@/modules/plugin/utilities/plugin/argument-values';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/molecules/ArgumentFieldsRenderer';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { useCallback, useMemo } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface PluginConfigFieldProps {
    argument: IArgumentDefinition;
    value: unknown;
    onChange: (key: string, value: unknown) => void;
    fieldKey: string;
    frameOptions?: SelectOption[];
};

const PluginConfigField = ({
    argument,
    value,
    onChange,
    fieldKey,
    frameOptions
}: PluginConfigFieldProps) => {
    const { publishedPlugins, getPluginArguments } = usePluginSelectors();

    const pluginConfigValue = getPluginConfigValue(argument, value);

    const pluginOptions = useMemo<SelectOption[]>(() => {
        return publishedPlugins
            .filter((plugin) => plugin.status === PluginStatus.PUBLISHED)
            .map((plugin) => ({
                value: plugin._id,
                title: plugin.modifier?.name?.trim() || plugin._id
            }));
    }, [publishedPlugins]);

    const selectedPluginArguments = useMemo<IArgumentDefinition[]>(() => {
        if (!pluginConfigValue.pluginId) {
            return [];
        }

        return getPluginArguments(pluginConfigValue.pluginId).filter((arg) => arg.value === undefined);
    }, [getPluginArguments, pluginConfigValue.pluginId]);

    const handlePluginChange = useCallback((_: string, nextValue: string | number | boolean) => {
        const nextPluginId = typeof nextValue === 'string' ? nextValue : String(nextValue);
        const nextConfigValue: PluginConfigValue = {
            pluginId: nextPluginId,
            config: {}
        };

        onChange(argument.argument, nextConfigValue);
    }, [argument.argument, onChange]);

    const handleConfigFieldChange = useCallback((configKey: string, configValue: unknown) => {
        const nextConfigValue: PluginConfigValue = {
            ...pluginConfigValue,
            config: {
                ...pluginConfigValue.config,
                [configKey]: configValue
            }
        };

        onChange(argument.argument, nextConfigValue);
    }, [argument.argument, onChange, pluginConfigValue]);

    return (
        <Container className='d-flex column gap-05'>
            <Paragraph className='canvas-form-label'>
                {argument.label || argument.argument}
            </Paragraph>
            <FormFieldRHF
                label='Algorithm Plugin'
                fieldKey={`${fieldKey}-plugin-select`}
                fieldType='select'
                fieldValue={pluginConfigValue.pluginId}
                options={pluginOptions}
                onFieldChange={handlePluginChange}
                variant='canvas'
            />
            {pluginConfigValue.pluginId && selectedPluginArguments.length > 0 && (
                <CollapsibleSection
                    title='Plugin Configuration'
                    defaultExpanded
                    className='mb-0'
                    bodyClassName='mt-05'
                >
                    <ArgumentFieldsRenderer
                        arguments={selectedPluginArguments}
                        values={pluginConfigValue.config}
                        onChange={handleConfigFieldChange}
                        frameOptions={frameOptions}
                        emptyMessage='No arguments for selected plugin.'
                    />
                </CollapsibleSection>
            )}
            {pluginConfigValue.pluginId && selectedPluginArguments.length === 0 && (
                <Paragraph className='font-size-1 color-muted'>
                    Selected plugin has no configurable arguments.
                </Paragraph>
            )}
            {!pluginConfigValue.pluginId && (
                <Paragraph className='font-size-1 color-muted'>
                    Select a plugin to configure.
                </Paragraph>
            )}
        </Container>
    );
};

export default PluginConfigField;
