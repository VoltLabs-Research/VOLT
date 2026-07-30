import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import SelectedTimestepsField from '@/modules/canvas/components/SelectedTimestepsField';
import { Callout, Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/contracts/form-field';

interface PluginExecutionPreflight {
    issues: string[];
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface PluginExecutionConfigFieldsProps {
    argumentsDefinitions: IArgumentDefinition[];
    configValues: Record<string, unknown>;
    onConfigChange: (key: string, value: unknown) => void;
    availableTimesteps: number[];
    selectedTimesteps?: number[];
    onSelectedTimestepsChange: (selectedTimesteps?: number[]) => void;
    selectedTeamClusterId: string;
    teamClusterOptions: SelectOption[];
    onSelectedTeamClusterIdChange: (value: string | number | boolean) => void;
    autocompleteOptions?: FormFieldAutocompleteOption[];
    frameOptions?: SelectOption[];
    noClustersMessage?: string;
    allowTemplateReferenceMode?: boolean;
    preflight?: PluginExecutionPreflight;
}

const PluginExecutionConfigFields = ({
    argumentsDefinitions,
    configValues,
    onConfigChange,
    availableTimesteps,
    selectedTimesteps,
    onSelectedTimestepsChange,
    selectedTeamClusterId,
    teamClusterOptions,
    onSelectedTeamClusterIdChange,
    autocompleteOptions,
    frameOptions,
    noClustersMessage = 'No team clusters available',
    allowTemplateReferenceMode = false,
    preflight
}: PluginExecutionConfigFieldsProps) => {
    const hasTeamClusterOptions = teamClusterOptions.length > 0;
    const hasPreflightIssues = Boolean(preflight && preflight.issues.length > 0);

    let clusterField = (
        <Text as='p' size='sm' tone='muted'>
            {noClustersMessage}
        </Text>
    );

    if (hasTeamClusterOptions) {
        clusterField = (
            <FormFieldRHF
                label='Cluster'
                fieldType='select'
                variant='canvas'
                fieldKey='plugin-execution-cluster'
                fieldValue={selectedTeamClusterId}
                options={teamClusterOptions}
                onFieldChange={(_, value) => onSelectedTeamClusterIdChange(value)}
            />
        );
    }

    return (
        <Stack gap='05'>
            {hasPreflightIssues && (
                <Callout
                    tone='warning'
                    title="Can't run this analysis yet"
                    role='alert'
                    ariaLive='polite'
                    action={preflight!.action}
                >
                    <Stack as='ul' gap='025' className='plugin-execution-preflight-list'>
                        {preflight!.issues.map((issue, index) => (
                            <Text key={index} as='li' size='sm'>
                                {issue}
                            </Text>
                        ))}
                    </Stack>
                </Callout>
            )}
            {argumentsDefinitions.length > 0 && (
                <ArgumentFieldsRenderer
                    arguments={argumentsDefinitions}
                    values={configValues}
                    onChange={onConfigChange}
                    frameOptions={frameOptions}
                    emptyMessage='No arguments configured.'
                    autocompleteOptions={autocompleteOptions}
                    allowTemplateReferenceMode={allowTemplateReferenceMode}
                />
            )}
            {clusterField}
            <SelectedTimestepsField
                availableTimesteps={availableTimesteps}
                selectedTimesteps={selectedTimesteps}
                onChange={onSelectedTimestepsChange}
            />
        </Stack>
    );
};

export default PluginExecutionConfigFields;
