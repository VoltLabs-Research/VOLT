import { Button, Popover } from '@heroui/react';
import { useState } from 'react';
import TrajectorySharePanel from '@/modules/canvas/components/TrajectorySharePanel';

interface TrajectorySharePanelPopoverProps {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
}

/**
 * `.trajectory-share-panel-popover` sized the panel and `noPadding` removed bravais's
 * dialog padding; HeroUI's `Popover.Dialog` is the padded box, so `p-0` says the same
 * thing.
 */
const PANEL_CLASS = 'flex max-h-[360px] w-full max-w-[320px] flex-col overflow-hidden p-0';

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
            {/* The Button is the Root's direct child — see MenuPopover for why. */}
            <Button
                variant='ghost'
                size='sm'
                className='text-xs'
                aria-label={triggerLabel}
            >
                Share
            </Button>

            <Popover.Content placement='bottom end'>
                <Popover.Dialog id={`trajectory-share-${trajectoryId}`} aria-label={triggerLabel} className={PANEL_CLASS}>
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
