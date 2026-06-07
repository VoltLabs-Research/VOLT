import { Box, Button, IconButton, Row, Stack, Text, Popover, PopoverMenu, PopoverMenuItem } from '@voltstack/bravais';
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
        <Stack gap='075' p='1-5' className='invite-code-section'>
            <Text as='p' size='md' weight='medium' tone='secondary'>
                Invite Code
            </Text>

            {inviteCode ? (
                <Row gap='05' className='invite-code-display'>
                    <Box radius='sm' flex='1' className='invite-code-badge font-size-4 font-weight-6 font-mono'>
                        {inviteCode}
                    </Box>
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
                </Row>
            ) : (
                canManageCode && (
                    <Stack gap='1'>
                        <Text as='p' size='md' className='color-tertiary'>
                            Generate a code so anyone with it can join this team.
                        </Text>
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
                    </Stack>
                )
            )}
        </Stack>
    );
};
