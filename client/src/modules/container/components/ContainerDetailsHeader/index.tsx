import { Button, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import ContainerStatusBadge from '../ContainerStatusBadge';
import { ArrowLeft, ExternalLink, Play, RefreshCw, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useOpenContainerPort } from '@/modules/container/hooks/use-open-container-port';
import { getPrimaryAccessiblePort } from '@/modules/container/utils/get-primary-accessible-port';
import { ContainerAction } from '@/modules/container/api/service';
import type { ReactNode } from 'react';
import type { Container as ContainerEntity } from '@volt/contracts/modules/container/domain';

type ContainerDetailsTabId = 'overview' | 'processes' | 'terminal' | 'storage';

interface ContainerDetailsTabOption {
    id: ContainerDetailsTabId;
    label: string;
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

/**
 * `ContainerDetailsHeader.css`, converted. The only arm that needed re-homing is
 * `.container-details-header-tabs-row .segmented-tabs { margin-bottom: -1px }`,
 * which reached into bravais's tab control to pull it onto the header's bottom
 * rule; it is now `-mb-px` on the control itself.
 */
const HEADER_CLASS_NAMES = 'flex flex-col border-b border-border px-6 pt-4 max-[720px]:px-4 max-[720px]:pt-3';
const HEADER_TOP_CLASS_NAMES = 'mt-2 flex flex-row flex-wrap items-start justify-between gap-4';
const HEADER_IDENTITY_CLASS_NAMES = 'flex min-w-0 flex-1 flex-col gap-1';
const HEADER_NAME_CLASS_NAMES = 'm-0 text-xl font-semibold leading-[1.15] tracking-[-0.025em] break-words text-foreground';
const HEADER_META_CLASS_NAMES = 'flex flex-row flex-wrap items-center text-[0.8125rem] leading-[1.4] text-muted';
const HEADER_META_DOT_CLASS_NAMES = 'mx-[0.4rem] opacity-40';
const HEADER_ACTIONS_CLASS_NAMES = 'flex shrink-0 flex-row items-center gap-2 max-[720px]:w-full';

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
        <div className={HEADER_CLASS_NAMES}>
            <div className='flex flex-row items-center gap-2'>
                <Button
                    className='text-muted'
                    variant='ghost'
                    size='sm'
                    onPress={onBack}
                >
                    <ArrowLeft size={14} />
                    Back
                </Button>
            </div>

            <div className={HEADER_TOP_CLASS_NAMES}>
                <div className={HEADER_IDENTITY_CLASS_NAMES}>
                    <div className='flex flex-row flex-wrap items-center gap-3'>
                        <h1 className={HEADER_NAME_CLASS_NAMES}>
                            {container.name}
                        </h1>
                        <ContainerStatusBadge status={container.status} />
                    </div>
                    <div className={HEADER_META_CLASS_NAMES}>
                        <span className='max-w-[520px] truncate'>{container.image}</span>
                        <span className={HEADER_META_DOT_CLASS_NAMES} aria-hidden='true'>·</span>
                        <span>Created {createdRelative}</span>
                    </div>
                </div>

                <div className={HEADER_ACTIONS_CLASS_NAMES}>
                    {contextualActions}
                    {canUpdate && isRunning && (
                        <>
                            <Button
                                variant='ghost'
                                size='sm'
                                onPress={() => onAction(ContainerAction.Restart)}
                                isDisabled={actionLoading}
                            >
                                <RefreshCw size={14} />
                                Restart
                            </Button>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='text-danger'
                                onPress={() => onAction(ContainerAction.Stop)}
                                isDisabled={actionLoading}
                            >
                                <Square size={14} />
                                Stop
                            </Button>
                        </>
                    )}
                    {canUpdate && !isRunning && (
                        <Button
                            variant='secondary'
                            size='sm'
                            className='text-success'
                            onPress={() => onAction(ContainerAction.Start)}
                            isDisabled={actionLoading}
                        >
                            <Play size={14} />
                            Start
                        </Button>
                    )}
                    {primaryAccessiblePort && (
                        <Button
                            variant='secondary'
                            size='sm'
                            onPress={() => { void openPort(container._id, primaryAccessiblePort.private); }}
                            isPending={openingPort === primaryAccessiblePort.private}
                        >
                            <ExternalLink size={14} />
                            Open :{primaryAccessiblePort.public}
                        </Button>
                    )}
                </div>
            </div>

            <div className='my-6 flex'>
                {/*
                  * bravais's `SegmentedTabs` emitted role='tablist'/role='tab' but was
                  * wired to no panel — the panels here are routes rendered by an
                  * `<Outlet>` in the parent, so a HeroUI `Tabs` would put an
                  * `aria-controls` on the selected tab pointing at a tabpanel id that
                  * does not exist. `ToggleButtonGroup` is the migration spec's first
                  * choice for exactly this case and produces the same connected
                  * segmented control.
                  *
                  * `disallowEmptySelection` is not optional: without it React Aria's
                  * single-selection toggle *deselects* on a second press of the active
                  * key, which would blank the active tab while the route stayed put.
                  * With it, pressing the active tab re-emits the same key — matching
                  * bravais, which called `onChange` on every click.
                  */}
                <ToggleButtonGroup
                    className='-mb-px'
                    size='sm'
                    aria-label='Container sections'
                    selectionMode='single'
                    disallowEmptySelection
                    selectedKeys={[activeTab]}
                    onSelectionChange={(keys) => {
                        const [selectedKey] = keys;

                        if (selectedKey === undefined) {
                            return;
                        }

                        handleTabChange(String(selectedKey) as ContainerDetailsTabId);
                    }}
                >
                    {TABS.map((tab) => (
                        <ToggleButton key={tab.id} id={tab.id}>
                            {tab.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </div>
        </div>
    );
};

export default ContainerDetailsHeader;
