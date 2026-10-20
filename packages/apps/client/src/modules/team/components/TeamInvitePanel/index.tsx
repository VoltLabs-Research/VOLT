import { InvitationEmailInput } from '../InvitationEmailInput';
import { InvitationsList } from '../InvitationsList';
import { InviteCodeSection } from '../InviteCodeSection';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { Button } from '@heroui/react';
import useInvitePanel from './use-invite-panel';
import useInviteCode from './use-invite-code';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { useCallback, useState } from 'react';
import { BookOpen, Copy } from 'lucide-react';
import Scrollable from '@/shared/ui/components/Scrollable';

enum InviteTab {
    Share = 'Share',
    InvitationCode = 'Invitation Code',
    PublicTrajectories = 'Public Trajectories'
}

const getPublicTrajectoriesLink = (teamId: string): string => {
    const publicPath = `/discover/teams/${encodeURIComponent(teamId)}`;

    return new URL(publicPath, window.location.origin).toString();
};

interface TeamInvitePanelProps {
    onClose?: () => void;
}

export const TeamInvitePanel = ({
    onClose
}: TeamInvitePanelProps) => {
    const [activeTab, setActiveTab] = useState<InviteTab>(InviteTab.Share);
    const teamId = useSelectedTeamId();

    const {
        emailField,
        handleSubmit,
        isSubmitting,
        buttonState,
        pendingInvitations,
        loadingInvitations,
        cancelingId,
        handleCancelInvitation
    } = useInvitePanel();

    const {
        inviteCode,
        canManageCode,
        isGenerating,
        isDeleting,
        handleGenerate,
        handleDelete,
        handleCopy
    } = useInviteCode();

    const publicTrajectoriesLink = teamId ? getPublicTrajectoriesLink(teamId) : '';

    const handleCopyPublicTrajectoriesLink = useCallback(async () => {
        if (!publicTrajectoriesLink) return;

        await copyTextToClipboard(publicTrajectoriesLink, {
            successMessage: 'Public trajectories link copied to clipboard'
        });
    }, [publicTrajectoriesLink]);

    const tabs = [
        {
            label: InviteTab.Share,
            active: activeTab === InviteTab.Share,
            onClick: () => setActiveTab(InviteTab.Share)
        },
        {
            label: InviteTab.InvitationCode,
            active: activeTab === InviteTab.InvitationCode,
            onClick: () => setActiveTab(InviteTab.InvitationCode)
        },
        {
            label: InviteTab.PublicTrajectories,
            active: activeTab === InviteTab.PublicTrajectories,
            onClick: () => setActiveTab(InviteTab.PublicTrajectories)
        }
    ];

    return (
        <div className='flex flex-col h-auto'>
            <PanelHeader
                tabs={tabs}
                onClose={onClose}
            />
            <Scrollable className='flex flex-col flex-1'>
                {activeTab === InviteTab.Share && (
                    <>
                        <InvitationEmailInput
                            value={emailField.value}
                            onChange={emailField.onChange}
                            onBlur={emailField.onBlur}
                            onSubmit={handleSubmit}
                            error={emailField.error}
                            isSubmitting={isSubmitting}
                            buttonState={buttonState}
                        />
                        <InvitationsList
                            invitations={pendingInvitations}
                            isLoading={loadingInvitations}
                            cancelingId={cancelingId}
                            onCancelInvitation={handleCancelInvitation}
                        />
                        <div className='flex flex-row items-center justify-between gap-2 shrink-0 mt-auto px-4 py-3 border-t border-border'>
                            <Button variant='ghost' size='sm' onPress={handleCopy} isDisabled={!inviteCode}>
                                <Copy size={16} aria-hidden='true' />
                                Copy link
                            </Button>
                            <Button variant='ghost' size='sm' isDisabled>
                                <BookOpen size={16} aria-hidden='true' />
                                Learn more
                            </Button>
                        </div>
                    </>
                )}

                {activeTab === InviteTab.InvitationCode && (
                    <InviteCodeSection
                        inviteCode={inviteCode}
                        canManageCode={canManageCode}
                        isGenerating={isGenerating}
                        isDeleting={isDeleting}
                        onGenerate={handleGenerate}
                        onDelete={handleDelete}
                        onCopy={handleCopy}
                    />
                )}

                {activeTab === InviteTab.PublicTrajectories && (
                    <>
                        <div className='flex flex-col gap-3 p-4'>
                            <span className='text-sm font-medium text-foreground'>Public Trajectories</span>
                            <div className='min-w-0 p-3 border border-border rounded-lg bg-surface-tertiary/55'>
                                <span className='block min-w-0 truncate font-mono text-xs text-muted'>
                                    {publicTrajectoriesLink || 'No team selected'}
                                </span>
                            </div>
                        </div>
                        <div className='flex flex-row items-center justify-between gap-2 shrink-0 mt-auto px-4 py-3 border-t border-border'>
                            <Button
                                variant='ghost'
                                size='sm'
                                onPress={handleCopyPublicTrajectoriesLink}
                                isDisabled={!publicTrajectoriesLink}
                            >
                                <Copy size={16} aria-hidden='true' />
                                Copy link
                            </Button>
                        </div>
                    </>
                )}
            </Scrollable>
        </div>
    );
};
