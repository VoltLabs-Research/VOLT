import { Popover } from '@/shared/presentation/primitives';
import { PopoverMenu } from '@/shared/presentation/primitives';
import { PopoverMenuItem } from '@/shared/presentation/primitives';
import { CiRedo, CiStop1 } from 'react-icons/ci';
import type { ReactElement } from 'react';

interface JobGroupMenuProps {
    trajectoryId: string;
    trigger: ReactElement;
    loadingAction: 'remove' | 'retry' | null;
    onRemoveRunningJobs: () => void;
    onRetryFailedJobs: () => void;
};

const JobGroupMenu = ({
    trajectoryId,
    trigger,
    loadingAction,
    onRemoveRunningJobs,
    onRetryFailedJobs
}: JobGroupMenuProps) => {
    return (
        <Popover
            id={`job-group-menu-${trajectoryId}`}
            trigger={trigger}
            triggerAction='contextmenu'
            role='menu'
            triggerAriaHaspopup='menu'
            ariaLabel='Job group actions'
        >
            {(close) => (
                <PopoverMenu label='Job group actions' onClose={close}>
                    <PopoverMenuItem
                        icon={<CiStop1 />}
                        onClick={() => {
                            onRemoveRunningJobs();
                            close();
                        }}
                        variant='danger'
                        isLoading={loadingAction === 'remove'}
                        disabled={loadingAction !== null}
                    >
                        Remove Running Jobs
                    </PopoverMenuItem>
                    <PopoverMenuItem
                        icon={<CiRedo />}
                        onClick={() => {
                            onRetryFailedJobs();
                            close();
                        }}
                        isLoading={loadingAction === 'retry'}
                        disabled={loadingAction !== null}
                    >
                        Retry Failed Jobs
                    </PopoverMenuItem>
                </PopoverMenu>
            )}
        </Popover>
    );
};

export default JobGroupMenu;
