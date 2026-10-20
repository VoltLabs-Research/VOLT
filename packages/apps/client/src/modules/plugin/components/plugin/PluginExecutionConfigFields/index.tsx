import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import SelectedTimestepsField from '@/modules/canvas/components/SelectedTimestepsField';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/contracts/form-field';

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
    noClustersMessage: string;
    allowTemplateReferenceMode?: boolean;
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
    noClustersMessage,
    allowTemplateReferenceMode = false
}: PluginExecutionConfigFieldsProps) => {
    const hasTeamClusterOptions = teamClusterOptions.length > 0;

    let clusterField = (
        <p className='text-xs text-muted'>
            {noClustersMessage}
        </p>
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
        <div className='flex flex-col gap-2'>
            <ArgumentFieldsRenderer
                arguments={argumentsDefinitions}
                values={configValues}
                onChange={onConfigChange}
                frameOptions={frameOptions}
                autocompleteOptions={autocompleteOptions}
                allowTemplateReferenceMode={allowTemplateReferenceMode}
            />
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
