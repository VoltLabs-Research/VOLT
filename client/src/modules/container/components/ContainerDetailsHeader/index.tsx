import Button from '@/shared/presentation/components/Button';
import SegmentedTabs from '@/shared/presentation/components/SegmentedTabs';
import { ArrowLeft, ExternalLink, Play, RefreshCw, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useOpenContainerPort } from '@/modules/container/hooks/use-open-container-port';
import { getPrimaryAccessiblePort } from '@/modules/container/utilities/get-primary-accessible-port';
import { ContainerAction } from '@/modules/container/api/dtos/update-container';
import type { ReactNode } from 'react';
import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
import type { SegmentedTabOption } from '@/shared/presentation/components/SegmentedTabs';
import './ContainerDetailsHeader.css';

type ContainerDetailsTabId = 'overview' | 'processes' | 'terminal' | 'storage';

interface ContainerDetailsTabOption extends SegmentedTabOption<ContainerDetailsTabId> {
    path: string;
};

const TABS: ReadonlyArray<ContainerDetailsTabOption> = [
    { id: 'overview', label: 'Overview', path: '' },
    { id: 'processes', label: 'Processes', path: 'processes' },
    { id: 'terminal', label: 'Terminal', path: 'terminal' },
    { id: 'storage', label: 'Files', path: 'storage' }
] as const;

const resolveActiveTab = (pathname: string, basePath: string): ContainerDetailsTabId => {
    const normalized = pathname.replace(/\/$/, '');
    const base = basePath.replace(/\/$/, '');

    if (normalized === base) return 'overview';
    if (normalized.endsWith('/processes')) return 'processes';
    if (normalized.endsWith('/terminal')) return 'terminal';
    if (normalized.endsWith('/storage')) return 'storage';
    return 'overview';
};

export interface ContainerDetailsHeaderProps {
    container: ContainerEntity;
    onBack: () => void;
    onAction: (action: ContainerAction | 'delete') => void;
    actionLoading: boolean;
    contextualActions?: ReactNode;
};

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

    const createdRelative = useMemo(
        () => formatDistanceToNow(new Date(container.createdAt), { addSuffix: true }),
        [container.createdAt]
    );

    const handleTabChange = (id: ContainerDetailsTabId) => {
        const tab = TABS.find((t) => t.id === id);
        if (!tab) return;
        navigate(tab.path ? `${basePath}/${tab.path}` : basePath);
    };

    return (
        <div className='volt-container container-details-header d-flex column'>
            <div className='volt-container d-flex items-center gap-05'>
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

            <div className='volt-container container-details-header-top d-flex items-start content-between mt-05'>
                <div className='volt-container container-details-header-identity d-flex column gap-025'>
                    <div className='volt-container d-flex items-center gap-075 flex-wrap'>
                        <h1 className='volt-title container-details-header-name font-size-4 font-weight-6'>
                            {container.name}
                        </h1>
                        <span
                            className={`container-details-status-badge ${container.status} d-flex items-center gap-035 font-size-1 font-weight-5`}
                        >
                            {container.status}
                        </span>
                    </div>
                    <div className='volt-container container-details-header-meta d-flex items-center flex-wrap'>
                        <span className='container-details-header-meta-image'>{container.image}</span>
                        <span className='container-details-header-meta-dot' aria-hidden='true'>·</span>
                        <span>Created {createdRelative}</span>
                    </div>
                </div>

                <div className='volt-container container-details-header-actions d-flex items-center gap-05'>
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
                            Open :{primaryAccessiblePort.private}
                        </Button>
                    )}
                </div>
            </div>

            <div className='volt-container container-details-header-tabs-row d-flex'>
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
