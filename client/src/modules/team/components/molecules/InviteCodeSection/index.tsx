import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { Copy, RefreshCw, Trash2 } from 'lucide-react';
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
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        leftIcon={<Copy size={14} />}
                        onClick={onCopy}
                        title='Copy invite code'
                    >
                        Copy
                    </Button>
                    {canManageCode && (
                        <>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                leftIcon={<RefreshCw size={14} />}
                                onClick={onGenerate}
                                disabled={isLoading}
                                isLoading={isGenerating}
                                title='Regenerate invite code'
                            >
                                Regenerate
                            </Button>
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                leftIcon={<Trash2 size={14} />}
                                onClick={onDelete}
                                disabled={isLoading}
                                isLoading={isDeleting}
                                title='Delete invite code'
                            >
                                Delete
                            </Button>
                        </>
                    )}
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
