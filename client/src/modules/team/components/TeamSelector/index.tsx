import { IconButton, Select } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useLeaveTeam from '@/modules/team/hooks/team/use-leave-team';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { switchSelectedTeam } from '@/modules/team/store/team/use-team-store';
import useTip from '@/shared/tips/use-tip';
import { LogOut } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import './TeamSelector.css';

interface TeamSelectorProps {
    className?: string;
}

export default function TeamSelector({ className = '' }: TeamSelectorProps) {
    const { teams } = useTeamData();
    const selectedTeamId = useSelectedTeamId();
    const leaveTeam = useLeaveTeam();
    const [tipTrigger, setTipTrigger] = useState(0);

    useTip('team-selector-context', {
        enabled: tipTrigger > 0,
        triggerKey: tipTrigger
    });

    const handleTeamChange = useCallback((teamId: string) => {
        if (selectedTeamId === teamId) return;

        switchSelectedTeam(teamId);
    }, [selectedTeamId]);

    const handleLeaveTeam = useCallback(async (event: MouseEvent, teamId: string) => {
        event.preventDefault();
        event.stopPropagation();

        await leaveTeam(teamId, teams.find((entry) => entry._id === teamId)?.name);
    }, [leaveTeam, teams]);

    const teamOptions = useMemo(() =>
        teams.map((team) => ({
            value: team._id,
            title: team.name,
            description: team.description?.trim() || undefined
        })), [teams]
    );

    const renderLeaveAction = useCallback((option: SelectOption) => (
        <IconButton
            size='sm'
            variant='ghost'
            className='team-selector-leave'
            onClick={(e) => handleLeaveTeam(e, option.value)}
            title='Leave team'
            aria-label={`Leave ${option.title}`}
        >
            <LogOut size={16} />
        </IconButton>
    ), [handleLeaveTeam]);

    return (
        <Select
            options={teamOptions}
            value={selectedTeamId || null}
            onChange={handleTeamChange}
            renderOptionAction={renderLeaveAction}
            className={`team-selector ${className}`}
            title='Switch team'
            onFocusCapture={() => setTipTrigger((current) => current + 1)}
        />
    );
};
