import ProcessingLoader from '@/shared/presentation/components/ProcessingLoader';
import { Box, Button, Heading, KeyValueList, KeyValueRow, Row, Stack, Text } from '@voltstack/bravais';
import { formatDistanceToNow } from 'date-fns';
import { Box as BoxIcon } from 'lucide-react';
import { getMaskedCustomFieldValue, mergeContainerEnvVariables } from '../../utilities/container-form';
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
}

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

    const leftIcon = !isLoading ? <BoxIcon size={18} /> : undefined;

    return (
        <Stack className='create-container-step' gap='2'>
            <Stack gap='05'>
                <Heading level={3} size='xl' weight='bold'>Review & Deploy</Heading>
                <Text as='p' size='lg' tone='secondary' className='create-container-step-copy'>Confirm the deployment details before creating the container.</Text>
            </Stack>

            <Box className='create-container-review-card' radius='md' overflow='hidden' p='1'>
                <KeyValueList>
                    <KeyValueRow label='Name' value={config.name} />
                    <KeyValueRow label='Team' value={selectedTeamName} />
                    <KeyValueRow label='Cluster' value={selectedClusterName} />
                    <KeyValueRow label='Image' value={selectedImage} />
                    <KeyValueRow label='Image source' value={imageSource} />
                    <KeyValueRow label='CPU' value={`${config.cpus} vCPU`} />
                    <KeyValueRow label='Memory' value={`${config.memory} MB`} />
                    <KeyValueRow label='Ports' value={portsDisplay} />
                    <KeyValueRow label='Environment' value={environmentDisplay} />
                    {customFieldsDisplay && <KeyValueRow label='Template settings' value={customFieldsDisplay} />}
                    <KeyValueRow label='Docker access' value={dockerAccessLabel} />
                    {draftLastSavedAt ? <KeyValueRow label='Draft saved' value={formatDistanceToNow(new Date(draftLastSavedAt), { addSuffix: true })} /> : null}
                </KeyValueList>
            </Box>

            <ProcessingLoader
                isVisible={isLoading && !!deployProgressMessage}
                message={deployProgressMessage || 'Deploying container...'}
                className='mt-1'
            />

            <Row className='create-container-step-actions' justify='end' gap='1' mt='3'>
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
            </Row>
        </Stack>
    );
};

export default ReviewStep;
