import ReviewItem from '../../atoms/ReviewItem';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { Box } from 'lucide-react';
import { getMaskedCustomFieldValue, mergeContainerEnvVariables } from '../../../hooks/use-create-container-form';
import type { ContainerConfig } from '../../../hooks/use-create-container-form';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';

const CONTAINER_USERNAME_ENV_KEY = 'CONTAINER_USERNAME';

interface ReviewStepProps {
    config: ContainerConfig;
    teams: Team[];
    teamClusters: TeamClusterOption[];
    selectedTeamId: string | null;
    selectedTeamClusterId: string | null;
    image: string | undefined;
    isLoading: boolean;
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
    isLoading,
    onBack,
    onCreate
}: ReviewStepProps) => {
    const selectedTeamName = teams.find((team) => team._id === selectedTeamId)?.name || 'Not selected';
    const selectedClusterName = teamClusters.find((teamCluster) => teamCluster._id === selectedTeamClusterId)?.name || 'Not selected';
    const selectedImage = image || 'Not selected';
    const mergedEnvironmentVariables = mergeContainerEnvVariables(config.env, config.customFields, config.customFieldValues);
    const hasUbuntuRemoteDesktopTemplateSettings = config.customFields.some((customField) => customField.env?.key === CONTAINER_USERNAME_ENV_KEY);
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
        <Container className='create-container-step d-flex column gap-2'>
            <Container className='d-flex column gap-05'>
                <Title className='font-size-5 font-weight-6'>Review & Deploy</Title>
                <Paragraph className='font-size-3 color-secondary create-container-step-copy'>Confirm the deployment details before creating the container.</Paragraph>
            </Container>

            <Container className='create-container-review-card radius-md overflow-hidden'>
                <ReviewItem label='Name' value={config.name} />
                <ReviewItem label='Team' value={selectedTeamName} />
                <ReviewItem label='Cluster' value={selectedClusterName} />
                <ReviewItem label='Image' value={selectedImage} valueClassName='font-family-mono' />
                <ReviewItem label='CPU' value={`${config.cpus} vCPU`} />
                <ReviewItem label='Memory' value={`${config.memory} MB`} />
                <ReviewItem label='Ports' value={portsDisplay} />
                <ReviewItem label='Environment' value={environmentDisplay} />
                {hasUbuntuRemoteDesktopTemplateSettings && <ReviewItem label='Remote desktop login' value='The Linux user password and VNC password will be the same.' />}
                {customFieldsDisplay && <ReviewItem label='Template settings' value={customFieldsDisplay} />}
                <ReviewItem label='Docker access' value={dockerAccessLabel} />
            </Container>

            <Container className='d-flex content-end gap-1 create-container-step-actions mt-3'>
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
            </Container>
        </Container>
    );
};

export default ReviewStep;
