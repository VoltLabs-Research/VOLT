import Button from '@/shared/presentation/components/Button';
import Popover from '@/shared/presentation/components/Popover';
import TrajectorySharePanel from '@/modules/canvas/components/TrajectorySharePanel';

interface TrajectorySharePanelPopoverProps {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
};

const TrajectorySharePanelPopover = ({
    trajectoryId,
    isPublic,
    canManageVisibility
}: TrajectorySharePanelPopoverProps) => {
    const triggerLabel = isPublic
        ? 'Share trajectory · public'
        : 'Share trajectory · private';

    return (
        <Popover
            id={`trajectory-share-${trajectoryId}`}
            placement='bottom-end'
            trigger={(
                <Button
                    variant='ghost'
                    intent='canvas'
                    size='sm'
                    shape='rounded'
                    className='font-size-1 canvas-btn-compact canvas-toolbar-share-trigger'
                    aria-label={triggerLabel}
                    title={triggerLabel}
                >
                    Share
                </Button>
            )}
            className='trajectory-share-panel-popover glass-bg d-flex column overflow-hidden'
            noPadding
        >
            {(close) => (
                <TrajectorySharePanel
                    trajectoryId={trajectoryId}
                    isPublic={isPublic}
                    canManageVisibility={canManageVisibility}
                    onClose={close}
                />
            )}
        </Popover>
    );
};

export default TrajectorySharePanelPopover;
