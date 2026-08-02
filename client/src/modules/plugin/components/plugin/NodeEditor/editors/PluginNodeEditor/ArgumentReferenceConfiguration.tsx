import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getUserConfigurableArguments } from '@/modules/plugin/utils/plugin/argument-values';
import FormSection from '@/shared/ui/components/FormSection';
import { Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import type { ReactNode } from 'react';
import type { ArgumentReferenceCandidate } from './argument-reference-candidates';
import type { FormFieldAutocompleteOption } from '@/shared/contracts/form-field';

interface ArgumentReferenceConfigurationProps {
    candidate?: ArgumentReferenceCandidate;
    referencedPluginIds: string[];
    configByPluginId: Record<string, Record<string, unknown>>;
    onConfigChange: (pluginId: string, key: string, value: unknown) => void;
    frameOptions: SelectOption[];
    autocompleteOptions: FormFieldAutocompleteOption[];
    executionFields: ReactNode;
}

const ArgumentReferenceConfiguration = ({
    candidate,
    referencedPluginIds,
    configByPluginId,
    onConfigChange,
    frameOptions,
    autocompleteOptions,
    executionFields
}: ArgumentReferenceConfigurationProps) => {
    const { publishedPluginsById, getPluginArguments } = usePluginSelectors();

    if (!candidate) {
        return (
            <Text as='p' size='sm' tone='muted'>
                Select a plugin reference argument to configure runtime execution.
            </Text>
        );
    }

    const usesSelectionConfig = candidate.pluginReferenceDefinitions.some((definition) => {
        return definition.showPluginConfiguration;
    });

    if (usesSelectionConfig) {
        return (
            <Stack gap='05'>
                <Text as='p' size='sm' tone='muted'>
                    Runtime execution will use the plugin configuration provided by the user through the selected argument.
                </Text>
                {executionFields}
            </Stack>
        );
    }

    if (referencedPluginIds.length === 0) {
        return (
            <Text as='p' size='sm' tone='muted'>
                This argument does not expose any candidate plugins for manual configuration.
            </Text>
        );
    }

    return (
        <Stack gap='05'>
            <Text as='p' size='sm' tone='muted'>
                Manual fallback configuration will be used for whichever referenced plugin the user selects.
            </Text>
            {referencedPluginIds.map((pluginId) => (
                <FormSection
                    key={pluginId}
                    title={publishedPluginsById[pluginId]?.modifier?.name?.trim() || pluginId}
                >
                    <ArgumentFieldsRenderer
                        arguments={getUserConfigurableArguments(getPluginArguments(pluginId))}
                        values={configByPluginId[pluginId] ?? {}}
                        onChange={(key, value) => onConfigChange(pluginId, key, value)}
                        frameOptions={frameOptions}
                        emptyMessage='No arguments for selected plugin.'
                        autocompleteOptions={autocompleteOptions}
                        allowTemplateReferenceMode
                    />
                </FormSection>
            ))}
            {executionFields}
        </Stack>
    );
};

export default ArgumentReferenceConfiguration;
