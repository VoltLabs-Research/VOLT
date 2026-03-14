import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
    onCopy: () => void;
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
        <Container className='invite-code-section d-flex column gap-075 p-1-5'>
            <Paragraph className='font-size-2 font-weight-5 color-secondary'>
                Invite Code
            </Paragraph>

            {inviteCode ? (
                <Container className='invite-code-display d-flex items-center gap-05'>
                    <Container className='invite-code-badge radius-sm font-size-4 font-weight-6 font-mono flex-1'>
                        {inviteCode}
                    </Container>
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
                                    onClick={() => {
                                        onCopy();
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
                </Container>
            ) : (
                canManageCode && (
                    <Container className='d-flex column gap-05'>
                        <Paragraph className='font-size-2 color-tertiary'>
                            Generate a code so anyone with it can join this team.
                        </Paragraph>
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
                    </Container>
                )
            )}
        </Container>
    );
};
