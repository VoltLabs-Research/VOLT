import ProcessingLoader from '@/shared/ui/components/ProcessingLoader';
import { Button } from '@heroui/react';
import { ContainerKeyValueList, ContainerKeyValueRow } from '../ContainerKeyValueList';
import { formatDistanceToNow } from 'date-fns';
import { Box as BoxIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mergeContainerEnvVariables } from '../../utils/container-form';
import type { ContainerConfig } from '@/modules/container/contracts/forms';
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
    const mergedEnvironmentVariables = mergeContainerEnvVariables(config.env);
    const environmentDisplay = mergedEnvironmentVariables.length > 0
        ? `${mergedEnvironmentVariables.length} variable${mergedEnvironmentVariables.length === 1 ? '' : 's'}`
        : 'None';
    const dockerAccessLabel = config.mountDockerSocket ? 'Enabled' : 'Disabled';
    let portsDisplay = 'None';
    if (config.ports.length > 0) {
        portsDisplay = config.ports.map((p) => `${p.private}:${p.public === undefined ? 'Auto' : p.public}`).join(', ');
    }

    return (
        <div className='flex flex-col gap-8'>
            <div className='flex flex-col gap-2'>
                <h3 className='text-xl font-semibold text-foreground'>Review &amp; Deploy</h3>
                <p className='max-w-[46rem] text-base text-muted'>Confirm the deployment details before creating the container.</p>
            </div>
            <div className='overflow-hidden rounded-xl border border-border bg-[color-mix(in_srgb,var(--surface-secondary)_94%,var(--surface-tertiary))] p-4'>
                <ContainerKeyValueList>
                    <ContainerKeyValueRow label='Name' value={config.name} />
                    <ContainerKeyValueRow label='Team' value={selectedTeamName} />
                    <ContainerKeyValueRow label='Cluster' value={selectedClusterName} />
                    <ContainerKeyValueRow label='Image' value={selectedImage} />
                    <ContainerKeyValueRow label='Image source' value={imageSource} />
                    <ContainerKeyValueRow label='CPU' value={`${config.cpus} vCPU`} />
                    <ContainerKeyValueRow label='Memory' value={`${config.memory} MB`} />
                    <ContainerKeyValueRow label='Ports' value={portsDisplay} />
                    <ContainerKeyValueRow label='Environment' value={environmentDisplay} />
                    <ContainerKeyValueRow label='Docker access' value={dockerAccessLabel} />
                    {draftLastSavedAt ? <ContainerKeyValueRow label='Draft saved' value={formatDistanceToNow(new Date(draftLastSavedAt), { addSuffix: true })} /> : null}
                </ContainerKeyValueList>
            </div>
            <ProcessingLoader
                isVisible={isLoading && !!deployProgressMessage}
                message={deployProgressMessage || 'Deploying container...'}
                showProgress={(deployProgressRate ?? 0) > 0}
                completionRate={deployProgressRate ?? 0}
                className='mt-4'
            />

            {isLoading && deployStartedAt && (
                <p className='text-sm text-muted mt-2' aria-live='polite'>
                    {formatElapsed(elapsedSeconds)}
                </p>
            )}

            <div className='mt-12 flex flex-row items-center justify-end gap-4 border-t border-border pt-6 max-[768px]:flex-col-reverse max-[768px]:gap-3 max-[768px]:[&>*]:w-full'>
                <Button variant='outline' onPress={onBack}>Back</Button>
                <Button
                    variant='primary'
                    onPress={onCreate}
                    isPending={isLoading}
                >
                    {!isLoading && <BoxIcon size={18} />}
                    {!isLoading && 'Deploy container'}
                </Button>
            </div>
        </div>
    );
};

export default ReviewStep;
