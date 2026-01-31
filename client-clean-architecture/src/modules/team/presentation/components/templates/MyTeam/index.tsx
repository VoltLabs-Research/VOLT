import React, { useEffect, useMemo, useCallback } from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import MemberRow from '../../molecules/MemberRow';
import EmptyState from '@/shared/presentation/components/EmptyState';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import useTeamMemberData from '@/modules/team/presentation/hooks/team-member/use-team-member-data';
import useTeamRoleData from '@/modules/team/presentation/hooks/team-role/use-team-role-data';
import useTeamMemberUseCases from '@/modules/team/presentation/hooks/team-member/use-team-member-use-cases';
import type { TeamMember } from '@/modules/team/domain/entities/TeamMember';
import './MyTeam.css';

const MyTeamTemplate: React.FC = () => {
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const members = useTeamMemberStore((state) => state.members);
    const isLoadingMembers = useTeamMemberStore((state) => state.isLoading);
    const removeMember = useTeamMemberStore((state) => state.removeMember);

    const { fetchMembers } = useTeamMemberData();
    const { fetchRoles } = useTeamRoleData();

    const user = useAuthStore((state) => state.user);
    const { removeTeamMemberUseCase } = useTeamMemberUseCases();

    const isOwner = useMemo(() => {
        if(!selectedTeam || !user) return false;
        return selectedTeam.owner._id === user._id;
    }, [selectedTeam, user]);

    useEffect(() => {
        if(selectedTeam) {
            fetchMembers(selectedTeam._id);
            fetchRoles(selectedTeam._id);
        }
    }, [selectedTeam, fetchMembers, fetchRoles]);

    const handleRemoveMember = useCallback(async (member: TeamMember) => {
        if(!selectedTeam) return;

        try {
            await removeTeamMemberUseCase.execute({
                teamId: selectedTeam._id,
                userId: member.user._id
            });
            removeMember(member._id);
        } catch (err) {
            console.error('Failed to remove member:', err);
        }
    }, [selectedTeam, removeTeamMemberUseCase, removeMember]);

    const sortedMembers = useMemo(() => {
        if(!selectedTeam) return [];
        
        return [...members].sort((a, b) => {
            if(a.user._id === selectedTeam.owner._id) return -1;
            if(b.user._id === selectedTeam.owner._id) return 1;
            return 0;
        });
    }, [members, selectedTeam]);

    if(!selectedTeam){
        return (
            <Container className='my-team-page p-2'>
                <Paragraph className='color-secondary'>Please select a team.</Paragraph>
            </Container>
        );
    }

    return (
        <Container className='my-team-page d-flex column gap-1-5 p-2'>
            <Container className='d-flex items-center content-between'>
                <Title className='font-size-5 font-weight-6'>
                    {selectedTeam.name}
                </Title>
                <Paragraph className='color-secondary font-size-2'>
                    {members.length} member{members.length !== 1 ? 's' : ''}
                </Paragraph>
            </Container>

            {isLoadingMembers ? (
                <Container className='my-team-loading radius-md p-3'>
                    <Paragraph className='color-secondary'>Loading members...</Paragraph>
                </Container>
            ) : members.length === 0 ? (
                <EmptyState
                    title='No Members'
                    description='No members found in this team.'
                />
            ) : (
                <Container className='my-team-members radius-md d-flex column gap-05'>
                    {sortedMembers.map((member) => {
                        const isCurrentUser = member.user._id === user?._id;
                        const isMemberOwner = member.user._id === selectedTeam.owner._id;
                        const canRemove = isOwner && !isMemberOwner && !isCurrentUser;

                        return (
                            <MemberRow
                                key={member._id}
                                member={member}
                                isCurrentUser={isCurrentUser}
                                isOwner={isMemberOwner}
                                canRemove={canRemove}
                                onRemove={handleRemoveMember}
                            />
                        );
                    })}
                </Container>
            )}
        </Container>
    );
};

export default MyTeamTemplate;
