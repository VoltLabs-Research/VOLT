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

/**
 * `pe-9` clears the selection indicator, which HeroUI positions `absolute end-2 size-4`
 * against the item — the base `:has(.list-box-item__indicator)` rule only reserves
 * `pe-7`, which the trailing leave button would sit underneath. `group` replaces the
 * `.select-option:hover .team-selector-leave` descendant selector with React Aria's own
 * `data-hovered` on the item.
 */
const TEAM_OPTION_CLASS = 'group pe-9';

/**
 * `.team-selector-leave` — hidden until the row is hovered, and `--accent-red`
 * (HeroUI's `--danger`) on its own hover. The box is `size-8`, HeroUI's small icon-button
 * width, rather than bravais's `.volt-icon-button` floor of 2.75rem, which would have
 * made every option 44px tall.
 */
const LEAVE_BUTTON_CLASS = 'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted opacity-0 transition-[opacity,color] duration-150 ease-out group-data-[hovered=true]:opacity-100 hover:text-danger';

export default function TeamSelector({ className = '' }: TeamSelectorProps) {
    const { teams } = useTeamData();
    const selectedTeamId = useSelectedTeamId();
    const leaveTeam = useLeaveTeam();
    const [tipTrigger, setTipTrigger] = useState(0);

    useTip('team-selector-context', {
        enabled: tipTrigger > 0,
        triggerKey: tipTrigger
    });

    /*
     * bravais's `onChange` only ever fired with a value; React Aria types
     * `onSelectionChange` as `Key | null` because a clearable select can deselect. This
     * one cannot, so `null` is ignored rather than treated as a team id.
     */
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

    /*
     * React Aria begins an item press on `pointerdown`, so a click-phase
     * `stopPropagation` in `handleLeaveTeam` cannot stop the option being selected as
     * well. Stopping the pointer event on the wrapper is what keeps "leave this team"
     * from also switching to it. The control itself stays a plain `<button>` because its
     * handler needs `MouseEvent` semantics, which `onPress` does not provide.
     */
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
            <Select.Trigger onFocus={() => setTipTrigger((current) => current + 1)}>
                {/* React Aria's Button drops `title`, so the native tooltip hangs off the value. */}
                <span className='flex min-w-0 flex-1 items-center' title='Switch team'>
                    <Select.Value>
                        {({ isPlaceholder, selectedText, defaultChildren }) => (
                            isPlaceholder ? defaultChildren : selectedText
                        )}
                    </Select.Value>
                </span>
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {teamOptions.map((option) => (
                        <ListBox.Item
                            key={option.value}
                            id={option.value}
                            textValue={option.title}
                            className={TEAM_OPTION_CLASS}
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
                                    className={LEAVE_BUTTON_CLASS}
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
