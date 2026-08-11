import { Button, Popover } from '@heroui/react';
import { useState } from 'react';
import TrajectorySharePanel from '@/modules/canvas/components/TrajectorySharePanel';

interface TrajectorySharePanelPopoverProps {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
}

const TrajectorySharePanelPopover = ({
    trajectoryId,
    isPublic,
    canManageVisibility
}: TrajectorySharePanelPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerLabel = isPublic
        ? 'Share trajectory · public'
        : 'Share trajectory · private';

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            <Button
                variant='ghost'
                size='sm'
                className='text-xs'
                aria-label={triggerLabel}
            >
                Share
            </Button>
            <Popover.Content placement='bottom end'>
                <Popover.Dialog id={`trajectory-share-${trajectoryId}`} aria-label={triggerLabel} className='flex max-h-[360px] w-full max-w-[320px] flex-col overflow-hidden p-0'>
                    <TrajectorySharePanel
                        trajectoryId={trajectoryId}
                        isPublic={isPublic}
                        canManageVisibility={canManageVisibility}
                        onClose={() => setIsOpen(false)}
                    />
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
};

export default TrajectorySharePanelPopover;
