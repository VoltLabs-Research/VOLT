import type { ReactNode } from 'react';
import { RxTrash } from 'react-icons/rx';
import { CiStop1, CiRedo } from 'react-icons/ci';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';

interface JobGroupMenuProps {
    trajectoryId: string;
    trigger: ReactNode;
    loadingAction: string | null;
    onClearHistory: () => void;
    onRemoveRunningJobs: () => void;
    onRetryFailedJobs: () => void;
}

const JobGroupMenu: React.FC<JobGroupMenuProps> = ({
    trajectoryId,
    trigger,
    loadingAction,
    onClearHistory,
    onRemoveRunningJobs,
    onRetryFailedJobs
}) => {
    return (
        <Popover
            id={`job-group-menu-${trajectoryId}`}
            trigger={trigger}
            triggerAction='contextmenu'
        >
            {(close) => (
                <>
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
                </>
            )}
        </Popover>
    );
};

export default JobGroupMenu;
