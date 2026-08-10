import { InvitationEmailInput } from '../InvitationEmailInput';
import { InvitationsList } from '../InvitationsList';
import { InviteCodeSection } from '../InviteCodeSection';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import { Button } from '@voltstack/bravais';
import useInvitePanel from '@/modules/team/hooks/invitation/use-invite-panel';
import useInviteCode from '@/modules/team/hooks/invitation/use-invite-code';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { useCallback, useState } from 'react';
import { BookOpen, Copy } from 'lucide-react';
import './TeamInvitePanel.css';

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
        <div className='flex flex-col team-invite-panel'>
            <PanelHeader
                tabs={tabs}
                onClose={onClose}
            />

            <div className='flex flex-col overflow-y-auto flex-1 team-invite-content'>
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

                        <div className='flex flex-row items-center justify-between gap-2 shrink-0 panel-footer-bordered' style={{ marginTop: 'auto' }}>
                            <Button variant='ghost' intent='neutral' size='sm' leftIcon={<Copy size={16} />} onClick={handleCopy} disabled={!inviteCode}>
                                Copy link
                            </Button>
                            <Button variant='ghost' intent='neutral' size='sm' leftIcon={<BookOpen size={16} />} disabled>
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
                        <div className='flex flex-col gap-3 team-public-trajectories-section'>
                            <span className='text-sm font-medium text-foreground'>Public Trajectories</span>
                            <div className='team-public-trajectories-link'>
                                <span className='text-xs text-muted team-public-trajectories-link-value'>
                                    {publicTrajectoriesLink || 'No team selected'}
                                </span>
                            </div>
                        </div>

                        <div className='flex flex-row items-center justify-between gap-2 shrink-0 panel-footer-bordered' style={{ marginTop: 'auto' }}>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                leftIcon={<Copy size={16} />}
                                onClick={handleCopyPublicTrajectoriesLink}
                                disabled={!publicTrajectoriesLink}
                            >
                                Copy link
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
