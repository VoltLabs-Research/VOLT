import ProcessingLoader from '@/shared/ui/components/ProcessingLoader';
import { Box, Button, Heading, KeyValueList, KeyValueRow, Row, Stack, Text } from '@voltstack/bravais';
import { formatDistanceToNow } from 'date-fns';
import { Box as BoxIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getMaskedCustomFieldValue, mergeContainerEnvVariables } from '../../utils/container-form';
import type { ContainerConfig } from '../../hooks/use-create-container-form';
import type { Team } from '@volt/contracts/modules/team/domain';
import type { TeamClusterOption } from '@volt/contracts/modules/container/domain';

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
    deployProgressRate?: number | null;
    deployStartedAt?: number | null;
    onBack: () => void;
    onCreate: () => void;
}

const formatElapsed = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) {
        return `${seconds}s elapsed`;
    }

    return `${minutes}m ${seconds.toString().padStart(2, '0')}s elapsed`;
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
    deployProgressRate,
    deployStartedAt,
    onBack,
    onCreate
}: ReviewStepProps) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        if (!isLoading || !deployStartedAt) {
            setElapsedSeconds(0);
            return;
        }

        const updateElapsed = () => {
            setElapsedSeconds(Math.max(0, Math.floor((Date.now() - deployStartedAt) / 1000)));
        };

        updateElapsed();
        const intervalId = window.setInterval(updateElapsed, 1000);
        return () => window.clearInterval(intervalId);
    }, [isLoading, deployStartedAt]);

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
                showProgress={typeof deployProgressRate === 'number' && deployProgressRate > 0}
                completionRate={deployProgressRate ?? 0}
                className='mt-1'
            />

            {isLoading && deployStartedAt && (
                <Text as='p' size='md' tone='muted' className='mt-05' aria-live='polite'>
                    {formatElapsed(elapsedSeconds)}
                </Text>
            )}

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
