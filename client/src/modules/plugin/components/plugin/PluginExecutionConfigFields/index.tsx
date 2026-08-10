import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import SelectedTimestepsField from '@/modules/canvas/components/SelectedTimestepsField';
import { Alert, Button } from '@heroui/react';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/contracts/form-field';

/**
 * The warning twin of `builder-styles`' `CALLOUT_DANGER_CLASS`: bravais's Callout tinted
 * both its fill and its hairline per tone, and `--status-warning-border` was
 * `color-mix(… warning 30% …)`. HeroUI's `Alert` tints only the title and indicator,
 * so the fill is restated here.
 */
const CALLOUT_WARNING_CLASS = 'flex-row items-center justify-between rounded-xl border border-warning/30 bg-warning-soft p-4 shadow-none';

interface PluginExecutionPreflight {
    issues: string[];
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface PluginExecutionConfigFieldsProps {
    /** Omitted by callers that have no inline arguments to configure. */
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
                    className={CALLOUT_WARNING_CLASS}
                >
                    <Alert.Content className='gap-1'>
                        <Alert.Title<'h2'> render={(props) => <h2 {...props} />} className='text-sm font-semibold'>
                            Can&apos;t run this analysis yet
                        </Alert.Title>

                        {/* `.plugin-execution-preflight-list` was never declared in any stylesheet. */}
                        <ul className='flex flex-col gap-1'>
                            {preflight!.issues.map((issue, index) => (
                                <li className='text-xs' key={index}>
                                    {issue}
                                </li>
                            ))}
                        </ul>
                    </Alert.Content>

                    {/* bravais mapped a warning Callout's action to `outline` + `neutral` (spec §4d). */}
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
