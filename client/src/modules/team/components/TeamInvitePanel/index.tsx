import { InvitationEmailInput } from '../InvitationEmailInput';
import { InvitationsList } from '../InvitationsList';
import { InviteCodeSection } from '../InviteCodeSection';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
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
        <Stack className='team-invite-panel'>
            <PanelHeader
                tabs={tabs}
                onClose={onClose}
            />

            <Stack flex='1' overflow='y-auto' className='team-invite-content'>
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

                        <Row gap='05' justify='between' shrink='0' className='panel-footer-bordered' style={{ marginTop: 'auto' }}>
                            {footerActions.map((action, index) => (
                                <Button key={index} variant='ghost' intent='neutral' size='sm' leftIcon={action.icon} onClick={action.onClick} disabled={action.disabled}>
                                    {action.label}
                                </Button>
                            ))}
                        </Row>
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
                        <Stack gap='075' className='team-public-trajectories-section'>
                            <Text weight='medium' size='md' tone='primary'>Public Trajectories</Text>
                            <Box className='team-public-trajectories-link'>
                                <Text as='span' size='sm' tone='secondary' className='team-public-trajectories-link-value'>
                                    {publicTrajectoriesLink || 'No team selected'}
                                </Text>
                            </Box>
                        </Stack>

                        <Row gap='05' justify='between' shrink='0' className='panel-footer-bordered' style={{ marginTop: 'auto' }}>
                            {publicTrajectoriesFooterActions.map((action, index) => (
                                <Button key={index} variant='ghost' intent='neutral' size='sm' leftIcon={action.icon} onClick={action.onClick} disabled={action.disabled}>
                                    {action.label}
                                </Button>
                            ))}
                        </Row>
                    </>
                )}
            </Stack>
        </Stack>
    );
};
