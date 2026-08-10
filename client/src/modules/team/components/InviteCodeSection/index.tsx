import { Button, IconButton, Popover, PopoverMenu, PopoverMenuItem } from '@voltstack/bravais';
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
}

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
        <div className='flex flex-col gap-3 p-6 invite-code-section'>
            <p className='text-sm font-medium text-muted'>
                Invite Code
            </p>

            {inviteCode ? (
                <div className='flex flex-row items-center gap-2 invite-code-display'>
                    <div className='rounded-lg flex-1 invite-code-badge text-xl font-semibold font-mono'>
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
                    <div className='flex flex-col gap-4'>
                        <p className='text-sm text-muted'>
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
