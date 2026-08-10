import { Button, SegmentedTabs, StatusBadge } from '@voltstack/bravais';
import type { SegmentedTabOption } from '@voltstack/bravais';
import { ArrowLeft, ExternalLink, Play, RefreshCw, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useOpenContainerPort } from '@/modules/container/hooks/use-open-container-port';
import { getPrimaryAccessiblePort } from '@/modules/container/utils/get-primary-accessible-port';
import { ContainerAction } from '@/modules/container/api/service';
import type { ReactNode } from 'react';
import type { Container as ContainerEntity } from '@volt/contracts/modules/container/domain';
import './ContainerDetailsHeader.css';
type ContainerDetailsTabId = 'overview' | 'processes' | 'terminal' | 'storage';

interface ContainerDetailsTabOption extends SegmentedTabOption<ContainerDetailsTabId> {
    path: string;
}

const TABS: ReadonlyArray<ContainerDetailsTabOption> = [
    {
        id: 'overview',
        label: 'Overview',
        path: ''
    },
    {
        id: 'processes',
        label: 'Processes',
        path: 'processes'
    },
    {
        id: 'terminal',
        label: 'Terminal',
        path: 'terminal'
    },
    {
        id: 'storage',
        label: 'Files',
        path: 'storage'
    }
] as const;

const resolveActiveTab = (pathname: string, basePath: string): ContainerDetailsTabId => {
    const normalized = pathname.replace(/\/$/, '');

    if (normalized === basePath.replace(/\/$/, '')) return 'overview';

    return TABS.find((tab) => tab.path && normalized.endsWith(`/${tab.path}`))?.id ?? 'overview';
};

interface ContainerDetailsHeaderProps {
    container: ContainerEntity;
    onBack: () => void;
    onAction: (action: ContainerAction | 'delete') => void;
    actionLoading: boolean;
    contextualActions?: ReactNode;
}

const ContainerDetailsHeader = ({
    container,
    onBack,
    onAction,
    actionLoading,
    contextualActions
}: ContainerDetailsHeaderProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { canAccess } = useTeamPermissions();
    const canUpdate = canAccess(['container:update']);
    const { openPort, openingPort } = useOpenContainerPort();

    const basePath = `/dashboard/containers/${container._id}`;
    const activeTab = resolveActiveTab(pathname, basePath);
    const primaryAccessiblePort = getPrimaryAccessiblePort(container.accessiblePorts);
    const isRunning = container.status === 'running';
    const createdRelative = formatDistanceToNow(new Date(container.createdAt), { addSuffix: true });

    const handleTabChange = (id: ContainerDetailsTabId) => {
        const tab = TABS.find((tabOption) => tabOption.id === id);
        navigate(tab?.path ? `${basePath}/${tab.path}` : basePath);
    };

    return (
        <div className='flex flex-col container-details-header'>
            <div className='flex flex-row items-center gap-2'>
                <Button
                    className='container-details-header-back'
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    leftIcon={<ArrowLeft size={14} />}
                    onClick={onBack}
                >
                    Back
                </Button>
            </div>

            <div className='flex flex-row items-start justify-between mt-2 container-details-header-top'>
                <div className='flex flex-col gap-1 container-details-header-identity'>
                    <div className='flex flex-row items-center flex-wrap gap-3'>
                        <h1 className='text-xl font-semibold text-foreground container-details-header-name'>
                            {container.name}
                        </h1>
                        <StatusBadge status={container.status} />
                    </div>
                    <div className='flex flex-row items-center flex-wrap container-details-header-meta'>
                        <span className='container-details-header-meta-image'>{container.image}</span>
                        <span className='container-details-header-meta-dot' aria-hidden='true'>·</span>
                        <span>Created {createdRelative}</span>
                    </div>
                </div>

                <div className='flex flex-row items-center gap-2 container-details-header-actions'>
                    {contextualActions}
                    {canUpdate && isRunning && (
                        <>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                leftIcon={<RefreshCw size={14} />}
                                onClick={() => onAction(ContainerAction.Restart)}
                                disabled={actionLoading}
                            >
                                Restart
                            </Button>
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                leftIcon={<Square size={14} />}
                                onClick={() => onAction(ContainerAction.Stop)}
                                disabled={actionLoading}
                            >
                                Stop
                            </Button>
                        </>
                    )}
                    {canUpdate && !isRunning && (
                        <Button
                            variant='soft'
                            intent='success'
                            size='sm'
                            leftIcon={<Play size={14} />}
                            onClick={() => onAction(ContainerAction.Start)}
                            disabled={actionLoading}
                        >
                            Start
                        </Button>
                    )}
                    {primaryAccessiblePort && (
                        <Button
                            variant='soft'
                            intent='brand'
                            size='sm'
                            leftIcon={<ExternalLink size={14} />}
                            onClick={() => openPort(container._id, primaryAccessiblePort.private)}
                            isLoading={openingPort === primaryAccessiblePort.private}
                        >
                            Open :{primaryAccessiblePort.public}
                        </Button>
                    )}
                </div>
            </div>

            <div className='flex container-details-header-tabs-row'>
                <SegmentedTabs<ContainerDetailsTabId>
                    tabs={TABS}
                    activeTab={activeTab}
                    onChange={handleTabChange}
                    ariaLabel='Container sections'
                    size='sm'
                />
            </div>
        </div>
    );
};

export default ContainerDetailsHeader;
