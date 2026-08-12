import { Description, Label, ListBox, Select, cn } from '@heroui/react';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useLeaveTeam from '@/modules/team/hooks/team/use-leave-team';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { switchSelectedTeam } from '@/modules/team/store/team/use-team-store';
import useTip from '@/shared/tips/use-tip';
import { LogOut } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import type { Key } from 'react-aria-components';

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

    const handleTeamChange = useCallback((key: Key | null) => {
        if (key === null) return;

        const teamId = String(key);
        if (selectedTeamId === teamId) return;

        switchSelectedTeam(teamId);
    }, [selectedTeamId]);

    const handleLeaveTeam = useCallback(async (event: MouseEvent, teamId: string) => {
        event.preventDefault();
        event.stopPropagation();

        await leaveTeam(teamId, teams.find((entry) => entry._id === teamId)?.name);
    }, [leaveTeam, teams]);

    const handleLeavePointerDown = useCallback((event: PointerEvent) => {
        event.stopPropagation();
    }, []);

    const teamOptions = useMemo(() =>
        teams.map((team) => ({
            value: team._id,
            title: team.name,
            description: team.description?.trim() || undefined
        })), [teams]
    );

    return (
        <Select
            className={cn('min-w-0', className)}
            selectedKey={selectedTeamId || null}
            onSelectionChange={handleTeamChange}
            aria-label='Switch team'
        >
            <Select.Trigger
                onFocus={() => setTipTrigger((current) => current + 1)}
                className='flex h-8 min-h-0 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-base font-medium text-foreground transition-colors duration-150 hover:bg-surface-hover'
            >
                <Select.Value>
                    {({ isPlaceholder, selectedText, defaultChildren }) => (
                        <span className='max-w-28 truncate capitalize sm:max-w-40' title='Switch team'>
                            {isPlaceholder ? defaultChildren : selectedText}
                        </span>
                    )}
                </Select.Value>
                <Select.Indicator className='static size-4 shrink-0 text-muted' />
            </Select.Trigger>
            <Select.Popover className='min-w-60'>
                <ListBox>
                    {teamOptions.map((option) => (
                        <ListBox.Item
                            key={option.value}
                            id={option.value}
                            textValue={option.title}
                            className='group pe-9'
                        >
                            <ListBox.ItemIndicator />
                            <div className='flex flex-col min-w-0 flex-1'>
                                <Label>{option.title}</Label>
                                {option.description && <Description>{option.description}</Description>}
                            </div>
                            <span
                                className='shrink-0'
                                title='Leave team'
                                onPointerDown={handleLeavePointerDown}
                            >
                                <button
                                    type='button'
                                    className='flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted opacity-0 transition-[opacity,color] duration-150 ease-out group-data-[hovered=true]:opacity-100 hover:text-danger'
                                    onClick={(event) => handleLeaveTeam(event, option.value)}
                                    aria-label={`Leave ${option.title}`}
                                >
                                    <LogOut size={16} aria-hidden='true' />
                                </button>
                            </span>
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
};
