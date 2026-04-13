import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { CiRedo, CiStop1 } from 'react-icons/ci';
import { RxTrash } from 'react-icons/rx';
import type { ReactElement } from 'react';

interface JobGroupMenuProps {
    trajectoryId: string;
    trigger: ReactElement;
    loadingAction: string | null;
    onClearHistory: () => void;
    onRemoveRunningJobs: () => void;
    onRetryFailedJobs: () => void;
};

const JobGroupMenu = ({
    trajectoryId,
    trigger,
    loadingAction,
    onClearHistory,
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
                        icon={<RxTrash />}
                        onClick={() => {
                            onClearHistory();
                            close();
                        }}
                        variant='danger'
                        isLoading={loadingAction === 'clear'}
                        disabled={loadingAction !== null}
                    >
                        Clear History
                    </PopoverMenuItem>
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
