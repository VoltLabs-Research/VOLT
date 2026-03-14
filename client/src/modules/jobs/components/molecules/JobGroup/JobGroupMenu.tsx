import IconButton from '@/shared/presentation/components/IconButton';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { CiRedo, CiStop1 } from 'react-icons/ci';
import { RxDotsHorizontal, RxTrash } from 'react-icons/rx';

interface JobGroupMenuProps {
    trajectoryId: string;
    loadingAction: string | null;
    onClearHistory: () => void;
    onRemoveRunningJobs: () => void;
    onRetryFailedJobs: () => void;
};

const JobGroupMenu = ({
    trajectoryId,
    loadingAction,
    onClearHistory,
    onRemoveRunningJobs,
    onRetryFailedJobs
}: JobGroupMenuProps) => {
    return (
        <Popover
            id={`job-group-menu-${trajectoryId}`}
            trigger={(
                <IconButton
                    aria-label='Open job group actions'
                    className='job-group-actions-button'
                    variant='ghost'
                    size='md'
                >
                    <RxDotsHorizontal />
                </IconButton>
            )}
            triggerAction='click'
            role='menu'
            triggerAriaHaspopup='menu'
            ariaLabel='Job group actions'
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
