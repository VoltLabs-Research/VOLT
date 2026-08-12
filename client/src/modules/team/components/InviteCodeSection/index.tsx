import Loader from '@/shared/ui/components/Loader';
import { Button, DropdownItem, DropdownMenu, DropdownPopover, DropdownRoot, DropdownTrigger } from '@heroui/react';
import { Copy, EllipsisVertical, RefreshCw, Trash2 } from 'lucide-react';

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
        <div className='flex flex-col gap-3 p-6'>
            <p className='text-sm font-medium text-muted'>
                Invite Code
            </p>

            {inviteCode ? (
                <div className='flex flex-row items-center gap-2'>
                    <div className='rounded-lg flex-1 px-3 py-2 bg-surface-tertiary border border-border tracking-[0.15em] text-xl font-semibold font-mono'>
                        {inviteCode}
                    </div>
                    <DropdownRoot>
                        <DropdownTrigger
                            className='flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
                            aria-label='Open invite code actions'
                            isDisabled={isLoading}
                        >
                            <span className='flex items-center justify-center' title='Invite code actions'>
                                <EllipsisVertical size={16} aria-hidden='true' />
                            </span>
                        </DropdownTrigger>
                        <DropdownPopover placement='bottom end'>
                            <DropdownMenu aria-label='Invite code actions'>
                                <DropdownItem id='copy' textValue='Copy' onAction={onCopy}>
                                    <Copy size={14} aria-hidden='true' />
                                    Copy
                                </DropdownItem>
                                {canManageCode && (
                                    <DropdownItem
                                        id='regenerate'
                                        textValue='Regenerate'
                                        isDisabled={isLoading}
                                        onAction={onGenerate}
                                    >
                                        {isGenerating
                                            ? <Loader size='sm' color='current' />
                                            : <RefreshCw size={14} aria-hidden='true' />}
                                        Regenerate
                                    </DropdownItem>
                                )}
                                {canManageCode && (
                                    <DropdownItem
                                        id='delete'
                                        textValue='Delete'
                                        variant='danger'
                                        isDisabled={isLoading}
                                        onAction={onDelete}
                                    >
                                        {isDeleting
                                            ? <Loader size='sm' color='current' />
                                            : <Trash2 size={14} aria-hidden='true' />}
                                        Delete
                                    </DropdownItem>
                                )}
                            </DropdownMenu>
                        </DropdownPopover>
                    </DropdownRoot>
                </div>
            ) : (
                canManageCode && (
                    <div className='flex flex-col gap-4'>
                        <p className='text-sm text-muted'>
                            Generate a code so anyone with it can join this team.
                        </p>
                        <Button
                            variant='outline'
                            size='sm'
                            onPress={onGenerate}
                            isDisabled={isLoading}
                            isPending={isGenerating}
                        >
                            {isGenerating
                                ? <Loader size='sm' color='current' />
                                : <RefreshCw size={14} aria-hidden='true' />}
                            Generate Invite Code
                        </Button>
                    </div>
                )
            )}
        </div>
    );
};
