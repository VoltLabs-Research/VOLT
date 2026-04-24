import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import PluginClusterField from '@/modules/canvas/components/PluginClusterField';
import SelectedTimestepsField from '@/modules/canvas/components/SelectedTimestepsField';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF';
import type { SelectOption } from '@/shared/presentation/primitives/Select';

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
        <p className='font-size-1 color-muted'>
            {noClustersMessage}
        </p>
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
        <div className='d-flex column gap-05'>
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
        </div>
    );
};

export default PluginExecutionConfigFields;
