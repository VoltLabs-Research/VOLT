import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/molecules/ArgumentFieldsRenderer';
import PluginClusterField from '@/modules/canvas/components/molecules/PluginClusterField';
import SelectedTimestepsField from '@/modules/canvas/components/molecules/SelectedTimestepsField';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF';
import type { SelectOption } from '@/shared/presentation/components/Select';

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
};

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
    allowTemplateReferenceMode = false
}: PluginExecutionConfigFieldsProps) => {
    const hasTeamClusterOptions = teamClusterOptions.length > 0;

    let clusterField = (
        <Paragraph className='font-size-1 color-muted'>
            {noClustersMessage}
        </Paragraph>
    );

    if (hasTeamClusterOptions) {
        clusterField = (
            <PluginClusterField
                fieldKey='plugin-execution-cluster'
                fieldValue={selectedTeamClusterId}
                options={teamClusterOptions}
                onFieldChange={(_, value) => onSelectedTeamClusterIdChange(value)}
            />
        );
    }

    return (
        <Container className='d-flex column gap-05'>
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
        </Container>
    );
};

export default PluginExecutionConfigFields;
