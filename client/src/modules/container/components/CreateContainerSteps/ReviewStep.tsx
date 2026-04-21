import ReviewItem from '../ReviewItem';
import Button from '@/shared/presentation/components/Button';
import ProcessingLoader from '@/shared/presentation/components/ProcessingLoader';
import { formatDistanceToNow } from 'date-fns';
import { Box } from 'lucide-react';
import { getMaskedCustomFieldValue, mergeContainerEnvVariables } from '../../hooks/use-create-container-form';
import type { ContainerConfig } from '../../hooks/use-create-container-form';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';

interface ReviewStepProps {
    config: ContainerConfig;
    teams: Team[];
    teamClusters: TeamClusterOption[];
    selectedTeamId: string | null;
    selectedTeamClusterId: string | null;
    image: string | undefined;
    selectedTemplateName?: string | null;
    draftLastSavedAt?: number | null;
    isLoading: boolean;
    deployProgressMessage: string | null;
    onBack: () => void;
    onCreate: () => void;
};

const ReviewStep = ({
    config,
    teams,
    teamClusters,
    selectedTeamId,
    selectedTeamClusterId,
    image,
    selectedTemplateName,
    draftLastSavedAt,
    isLoading,
    deployProgressMessage,
    onBack,
    onCreate
}: ReviewStepProps) => {
    const selectedTeamName = teams.find((team) => team._id === selectedTeamId)?.name || 'Not selected';
    const selectedClusterName = teamClusters.find((teamCluster) => teamCluster._id === selectedTeamClusterId)?.name || 'Not selected';
    const selectedImage = image || 'Not selected';
    const imageSource = selectedTemplateName ? `Template: ${selectedTemplateName}` : (image ? 'Custom image' : 'No image selected');
    const mergedEnvironmentVariables = mergeContainerEnvVariables(config.env, config.customFields, config.customFieldValues);
    const environmentDisplay = mergedEnvironmentVariables.length > 0
        ? `${mergedEnvironmentVariables.length} variable${mergedEnvironmentVariables.length === 1 ? '' : 's'}`
        : 'None';
    const dockerAccessLabel = config.mountDockerSocket ? 'Enabled' : 'Disabled';
    const customFieldsDisplay = config.customFields.length > 0
        ? config.customFields.map((customField) => {
            const rawValue = config.customFieldValues[customField.id] ?? '';
            const value = getMaskedCustomFieldValue(customField, rawValue) || 'Not set';

            return `${customField.label}: ${value}`;
        }).join(', ')
        : null;
    let portsDisplay = 'None';
    if (config.ports.length > 0) {
        portsDisplay = config.ports.map((p) => `${p.private}:${p.public === undefined ? 'Auto' : p.public}`).join(', ');
    }

    const leftIcon = !isLoading ? <Box size={18} /> : undefined;

    return (
        <div className='volt-container create-container-step d-flex column gap-2'>
            <div className='volt-container d-flex column gap-05'>
                <h3 className='volt-title font-size-5 font-weight-6'>Review & Deploy</h3>
                <p className='volt-text font-size-3 color-secondary create-container-step-copy'>Confirm the deployment details before creating the container.</p>
            </div>

            <div className='volt-container create-container-review-card radius-md overflow-hidden'>
                <ReviewItem label='Name' value={config.name} />
                <ReviewItem label='Team' value={selectedTeamName} />
                <ReviewItem label='Cluster' value={selectedClusterName} />
                <ReviewItem label='Image' value={selectedImage} />
                <ReviewItem label='Image source' value={imageSource} />
                <ReviewItem label='CPU' value={`${config.cpus} vCPU`} />
                <ReviewItem label='Memory' value={`${config.memory} MB`} />
                <ReviewItem label='Ports' value={portsDisplay} />
                <ReviewItem label='Environment' value={environmentDisplay} />
                {customFieldsDisplay && <ReviewItem label='Template settings' value={customFieldsDisplay} />}
                <ReviewItem label='Docker access' value={dockerAccessLabel} />
                {draftLastSavedAt ? <ReviewItem label='Draft saved' value={formatDistanceToNow(new Date(draftLastSavedAt), { addSuffix: true })} /> : null}
            </div>

            <ProcessingLoader
                isVisible={isLoading && !!deployProgressMessage}
                message={deployProgressMessage || 'Deploying container...'}
                className='mt-1'
            />

            <div className='volt-container d-flex content-end gap-1 create-container-step-actions mt-3'>
                <Button variant='outline' intent='neutral' onClick={onBack}>Back</Button>
                <Button
                    variant='solid'
                    intent='brand'
                    onClick={onCreate}
                    isLoading={isLoading}
                    leftIcon={leftIcon}
                >
                    {!isLoading && 'Deploy container'}
                </Button>
            </div>
        </div>
    );
};

export default ReviewStep;
