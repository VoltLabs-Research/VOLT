import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import SelectedTimestepsField from '@/modules/canvas/components/SelectedTimestepsField';
import { Alert, Button } from '@heroui/react';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
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
    argumentsDefinitions?: IArgumentDefinition[];
    configValues?: Record<string, unknown>;
    onConfigChange?: (key: string, value: unknown) => void;
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
    argumentsDefinitions = [],
    configValues = {},
    onConfigChange = () => {},
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
            {hasPreflightIssues && (
                <Alert
                    status='warning'
                    role='alert'
                    aria-live='polite'
                    aria-label="Can't run this analysis yet"
                    className='flex-row items-center justify-between rounded-xl border border-warning/30 bg-warning-soft p-4 shadow-none'
                >
                    <Alert.Content className='gap-1'>
                        <Alert.Title<'h2'> render={(props) => <h2 {...props} />} className='text-sm font-semibold'>
                            Can&apos;t run this analysis yet
                        </Alert.Title>
                        <ul className='flex flex-col gap-1'>
                            {preflight!.issues.map((issue, index) => (
                                <li className='text-xs' key={index}>
                                    {issue}
                                </li>
                            ))}
                        </ul>
                    </Alert.Content>

                    {preflight!.action && (
                        <Button
                            variant='outline'
                            size='sm'
                            className='shrink-0'
                            onPress={preflight!.action.onClick}
                        >
                            {preflight!.action.label}
                        </Button>
                    )}
                </Alert>
            )}
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
