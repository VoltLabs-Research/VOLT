import { InvitationEmailInput } from '../InvitationEmailInput';
import { InvitationsList } from '../InvitationsList';
import { InviteCodeSection } from '../InviteCodeSection';
import { PanelFooter } from '../PanelFooter';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import useInvitePanel from '@/modules/team/hooks/invitation/use-invite-panel';
import useInviteCode from '@/modules/team/hooks/invitation/use-invite-code';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { useCallback, useMemo, useState } from 'react';
import { BookOpen, Copy } from 'lucide-react';
import './TeamInvitePanel.css';

enum InviteTab {
    Share = 'Share',
    InvitationCode = 'Invitation Code',
    PublicTrajectories = 'Public Trajectories'
}

const getPublicTrajectoriesLink = (teamId: string): string => {
    const publicPath = `/discover/teams/${encodeURIComponent(teamId)}`;

    if (typeof window === 'undefined') {
        return publicPath;
    }

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

    const publicTrajectoriesLink = useMemo(() => {
        return teamId ? getPublicTrajectoriesLink(teamId) : '';
    }, [teamId]);

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

    const footerActions = [
        {
            label: 'Copy link',
            icon: <Copy size={16} />,
            onClick: handleCopy,
            disabled: !inviteCode
        },
        {
            label: 'Learn more',
            icon: <BookOpen size={16} />,
            onClick: () => {},
            disabled: true
        }
    ];

    const publicTrajectoriesFooterActions = [
        {
            label: 'Copy link',
            icon: <Copy size={16} />,
            onClick: handleCopyPublicTrajectoriesLink,
            disabled: !publicTrajectoriesLink
        }
    ];

    return (
        <div className='team-invite-panel d-flex column'>
            <PanelHeader
                tabs={tabs}
                onClose={onClose}
            />

            <div className='team-invite-content d-flex column flex-1 y-auto'>
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

                        <PanelFooter
                            actions={footerActions}
                        />
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
                        <div className='team-public-trajectories-section d-flex column gap-075'>
                            <span className='font-size-2 font-weight-5 color-primary'>Public Trajectories</span>
                            <div className='team-public-trajectories-link'>
                                <span className='team-public-trajectories-link-value font-size-1 color-secondary'>
                                    {publicTrajectoriesLink || 'No team selected'}
                                </span>
                            </div>
                        </div>

                        <PanelFooter
                            actions={publicTrajectoriesFooterActions}
                        />
                    </>
                )}
            </div>
        </div>
    );
};
