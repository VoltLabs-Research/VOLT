import Button from '@/shared/presentation/components/Button';
import IconButton from '@/shared/presentation/components/IconButton';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import { Copy, EllipsisVertical, RefreshCw, Trash2 } from 'lucide-react';
import './InviteCodeSection.css';

interface InviteCodeSectionProps {
    inviteCode: string | null;
    canManageCode: boolean;
    isGenerating: boolean;
    isDeleting: boolean;
    onGenerate: () => Promise<void>;
    onDelete: () => Promise<void>;
    onCopy: () => Promise<void>;
};

export const InviteCodeSection = ({
    inviteCode,
    canManageCode,
    isGenerating,
    isDeleting,
    onGenerate,
    onDelete,
    onCopy
}: InviteCodeSectionProps) => {
    const isLoading = isGenerating || isDeleting;

    if (!canManageCode && !inviteCode) {
        return null;
    }

    return (
        <div className='volt-container invite-code-section d-flex column gap-075 p-1-5'>
            <p className='volt-text font-size-2 font-weight-5 color-secondary'>
                Invite Code
            </p>

            {inviteCode ? (
                <div className='volt-container invite-code-display d-flex items-center gap-05'>
                    <div className='volt-container invite-code-badge radius-sm font-size-4 font-weight-6 font-mono flex-1'>
                        {inviteCode}
                    </div>
                    <Popover
                        id='invite-code-actions-menu'
                        placement='bottom-end'
                        noPadding
                        trigger={(
                            <IconButton
                                variant='ghost'
                                size='sm'
                                className='invite-code-actions-trigger'
                                title='Invite code actions'
                                aria-label='Open invite code actions'
                                disabled={isLoading}
                            >
                                <EllipsisVertical size={16} />
                            </IconButton>
                        )}
                    >
                        {(close) => (
                            <PopoverMenu>
                                <PopoverMenuItem
                                    icon={<Copy size={14} />}
                                    onClick={async () => {
                                        await onCopy();
                                        close();
                                    }}
                                >
                                    Copy
                                </PopoverMenuItem>
                                {canManageCode && (
                                    <>
                                        <PopoverMenuItem
                                            icon={<RefreshCw size={14} />}
                                            onClick={() => {
                                                onGenerate();
                                                close();
                                            }}
                                            disabled={isLoading}
                                            isLoading={isGenerating}
                                        >
                                            Regenerate
                                        </PopoverMenuItem>
                                        <PopoverMenuItem
                                            icon={<Trash2 size={14} />}
                                            onClick={() => {
                                                onDelete();
                                                close();
                                            }}
                                            variant='danger'
                                            disabled={isLoading}
                                            isLoading={isDeleting}
                                        >
                                            Delete
                                        </PopoverMenuItem>
                                    </>
                                )}
                            </PopoverMenu>
                        )}
                    </Popover>
                </div>
            ) : (
                canManageCode && (
                    <div className='volt-container d-flex column gap-1   '>
                        <p className='volt-text font-size-2 color-tertiary'>
                            Generate a code so anyone with it can join this team.
                        </p>
                        <Button
                            variant='outline'
                            intent='neutral'
                            size='sm'
                            leftIcon={<RefreshCw size={14} />}
                            onClick={onGenerate}
                            disabled={isLoading}
                            isLoading={isGenerating}
                        >
                            Generate Invite Code
                        </Button>
                    </div>
                )
            )}
        </div>
    );
};
