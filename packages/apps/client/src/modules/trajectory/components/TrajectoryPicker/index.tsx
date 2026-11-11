import useDebouncedValue from '@/shared/ui/hooks/use-debounced-value';
import { trajectoryFoldersQuery, useTrajectoriesInfiniteQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { Button, Popover, ToggleButton, ToggleButtonGroup, cn } from '@heroui/react';
import { Check, ChevronDown, Folder, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { Key } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

interface TrajectoryPickerProps {
    value: string | null;
    valueLabel?: string;
    onChange: (trajectoryId: string | null, name?: string) => void;
    // Trajectories that have results, for the "With results" scope; leave out to hide it.
    withResultsIds?: ReadonlySet<string>;
    label?: string;
    // Without it a trajectory must be picked: no "All trajectories" option and no clear button.
    allowAll?: boolean;
    // Why a trajectory can't be picked here; it stays listed, greyed out, with the reason under its name.
    disabledReason?: (trajectory: Trajectory) => string | undefined;
    isDisabled?: boolean;
    className?: string;
    triggerClassName?: string;
}

const PAGE_LIMIT = 50;
const NO_FOLDER = '__none__';

const compact = (value: number | undefined): string => {
    if (value === undefined) return '';
    if (value < 1000) return String(value);
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
};

const describe = (trajectory: Trajectory): string => {
    const frames = trajectory.framesCount ?? trajectory.frames?.length;
    const parts = [
        frames !== undefined ? `${frames} frame${frames === 1 ? '' : 's'}` : null,
        trajectory.atoms !== undefined ? `${compact(trajectory.atoms)} atoms` : null
    ];
    return parts.filter(Boolean).join(' · ');
};

type PickerItem =
    | { kind: 'all' }
    | { kind: 'folder'; id: string; title: string; count: number; open: boolean }
    | { kind: 'trajectory'; trajectory: Trajectory };

/*
 * Picks a trajectory, or filters by one: opens on the search, groups by folder, tells same-named trajectories
 * apart by date and keeps a fixed width so long names wrap instead of stretching the panel.
 */
const TrajectoryPicker = ({
    value,
    valueLabel,
    onChange,
    withResultsIds,
    label = 'Trajectory',
    allowAll = true,
    disabledReason,
    isDisabled = false,
    className,
    triggerClassName
}: TrajectoryPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<'all' | 'results'>('all');
    const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set());
    const [highlight, setHighlight] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const debouncedSearch = useDebouncedValue(search.trim(), 250);

    const trajectoriesQuery = useTrajectoriesInfiniteQuery(
        { page: 1, limit: PAGE_LIMIT, search: debouncedSearch || undefined },
        { enabled: isOpen }
    );
    const foldersQuery = trajectoryFoldersQuery({ page: 1, limit: 200 }, { enabled: isOpen });

    const trajectories = useMemo(() => {
        const all = trajectoriesQuery.data?.pages.flatMap((page) => page.data) ?? [];
        return scope === 'results' && withResultsIds ? all.filter((trajectory) => withResultsIds.has(trajectory._id)) : all;
    }, [trajectoriesQuery.data, scope, withResultsIds]);

    const nameCounts = useMemo(() => {
        const counts = new Map<string, number>();
        trajectories.forEach((trajectory) => counts.set(trajectory.name, (counts.get(trajectory.name) ?? 0) + 1));
        return counts;
    }, [trajectories]);

    const folderTitles = useMemo(() => {
        const titles = new Map<string, string>();
        (foldersQuery.data?.data ?? []).forEach((folder) => titles.set(folder._id, folder.title));
        return titles;
    }, [foldersQuery.data]);

    const items = useMemo<PickerItem[]>(() => {
        if (debouncedSearch) {
            return trajectories.map((trajectory) => ({ kind: 'trajectory', trajectory }));
        }

        const groups = new Map<string, Trajectory[]>();
        trajectories.forEach((trajectory) => {
            const key = trajectory.folder ?? NO_FOLDER;
            groups.set(key, [...(groups.get(key) ?? []), trajectory]);
        });

        const result: PickerItem[] = allowAll ? [{ kind: 'all' }] : [];
        const ordered = [...groups.entries()].sort(([left], [right]) => Number(left === NO_FOLDER) - Number(right === NO_FOLDER));
        ordered.forEach(([id, list]) => {
            const open = !closedFolders.has(id);
            const title = id === NO_FOLDER ? 'No folder' : (folderTitles.get(id) ?? 'Folder');
            result.push({ kind: 'folder', id, title, count: list.length, open });
            if (open) list.forEach((trajectory) => result.push({ kind: 'trajectory', trajectory }));
        });

        return result;
    }, [trajectories, debouncedSearch, closedFolders, folderTitles, allowAll]);

    const selectable = useMemo(() => items.filter((item) => item.kind === 'all'
        || (item.kind === 'trajectory' && !disabledReason?.(item.trajectory))), [items, disabledReason]);

    useEffect(() => {
        setHighlight(0);
    }, [debouncedSearch, scope]);

    useEffect(() => {
        if (!isOpen) setSearch('');
    }, [isOpen]);

    const choose = useCallback((trajectoryId: string | null, name?: string) => {
        onChange(trajectoryId, name);
        setIsOpen(false);
    }, [onChange]);

    const toggleFolder = (id: string) => {
        setClosedFolders((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const next = Math.max(0, Math.min(selectable.length - 1, highlight + (event.key === 'ArrowDown' ? 1 : -1)));
            setHighlight(next);
            listRef.current?.querySelector(`[data-option-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const item = selectable[highlight];
            if (item?.kind === 'all') choose(null);
            if (item?.kind === 'trajectory') choose(item.trajectory._id, item.trajectory.name);
        }
    };

    const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const element = event.currentTarget;
        const nearEnd = element.scrollTop + element.clientHeight > element.scrollHeight - 80;
        if (nearEnd && trajectoriesQuery.hasNextPage && !trajectoriesQuery.isFetchingNextPage) {
            void trajectoriesQuery.fetchNextPage();
        }
    };

    let optionIndex = -1;

    const canClear = allowAll && Boolean(value);
    const valueText = value ? valueLabel ?? 'Selected' : allowAll ? 'All' : undefined;

    return (
        <div className={cn('inline-flex items-center', className)}>
            <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
                <Button
                    variant='outline'
                    size='sm'
                    isDisabled={isDisabled}
                    className={cn(
                        'h-8 max-w-80 gap-1.5 rounded-lg border-border px-2.5 text-sm font-normal',
                        triggerClassName,
                        canClear && 'rounded-r-none border-r-0'
                    )}
                    aria-label={`${label}: ${valueText ?? 'none'}`}
                >
                    <span className='text-muted'>{label}</span>
                    {valueText && <span className='truncate font-medium text-foreground'>{valueText}</span>}
                    {!canClear && <ChevronDown size={14} className='shrink-0 text-muted' aria-hidden='true' />}
                </Button>
                <Popover.Content placement='bottom start'>
                    <Popover.Dialog aria-label='Choose a trajectory' className='flex w-[388px] max-w-[calc(100vw-2rem)] flex-col p-0'>
                        <div className='flex h-11 items-center gap-2 border-b border-border px-3 text-muted'>
                            <Search size={15} aria-hidden='true' />
                            {/* The popover's search row is the field; the global focus ring would draw a second box inside it. */}
                            <input
                                data-slot='search-input'
                                autoFocus
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder='Search trajectories'
                                aria-label='Search trajectories'
                                className='min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted'
                            />
                        </div>
                        {withResultsIds && (
                            <div className='px-2.5 pb-0.5 pt-2'>
                                <ToggleButtonGroup
                                    selectionMode='single'
                                    disallowEmptySelection
                                    selectedKeys={[scope]}
                                    onSelectionChange={(keys) => {
                                        const next = [...(keys as Set<Key>)][0];
                                        if (next === 'all' || next === 'results') setScope(next);
                                    }}
                                    aria-label='Scope'
                                >
                                    <ToggleButton id='all' variant='ghost'>All</ToggleButton>
                                    <ToggleButton id='results' variant='ghost'>With results</ToggleButton>
                                </ToggleButtonGroup>
                            </div>
                        )}
                        <Scrollable ref={listRef} role='listbox' aria-label='Trajectories' className='max-h-[372px] p-1.5' onScroll={handleScroll}>
                            {items.map((item) => {
                                if (item.kind === 'folder') {
                                    return (
                                        <button
                                            key={`folder-${item.id}`}
                                            type='button'
                                            aria-expanded={item.open}
                                            onClick={() => toggleFolder(item.id)}
                                            className='mt-1 flex h-[30px] w-full cursor-pointer items-center gap-1.5 rounded-2xl border-0 bg-transparent px-2 text-xs font-medium text-muted hover:bg-foreground/[0.06] hover:text-foreground'
                                        >
                                            <ChevronDown size={14} className={cn('transition-transform', !item.open && '-rotate-90')} aria-hidden='true' />
                                            <Folder size={14} aria-hidden='true' />
                                            <span className='truncate'>{item.title}</span>
                                            <span className='ml-auto font-mono text-2xs text-muted'>{item.count}</span>
                                        </button>
                                    );
                                }

                                const isAll = item.kind === 'all';
                                const reason = isAll ? undefined : disabledReason?.(item.trajectory);
                                // Only the options that can be picked take part in the arrow keys.
                                if (!reason) optionIndex += 1;
                                const index = reason ? -1 : optionIndex;
                                const id = isAll ? null : item.trajectory._id;
                                const selected = value === id;
                                const duplicate = !isAll && (nameCounts.get(item.trajectory.name) ?? 0) > 1;

                                return (
                                    <div
                                        key={isAll ? 'all' : item.trajectory._id}
                                        role='option'
                                        aria-selected={selected}
                                        aria-disabled={reason ? true : undefined}
                                        data-option-index={reason ? undefined : index}
                                        onMouseEnter={reason ? undefined : () => setHighlight(index)}
                                        onClick={reason ? undefined : () => choose(id, isAll ? undefined : item.trajectory.name)}
                                        className={cn(
                                            'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl px-2.5 py-2',
                                            reason ? 'cursor-default opacity-50' : 'cursor-pointer',
                                            selected ? 'bg-foreground/[0.09]' : index === highlight && 'bg-foreground/[0.06]'
                                        )}
                                    >
                                        <span className='min-w-0'>
                                            <span className='line-clamp-2 text-sm leading-[1.3] text-foreground' title={isAll ? undefined : item.trajectory.name}>
                                                {isAll ? 'All trajectories' : item.trajectory.name}
                                            </span>
                                            {!isAll && (
                                                <span className='mt-px flex flex-wrap items-center gap-1.5 text-2xs tabular-nums text-muted'>
                                                    {duplicate && item.trajectory.createdAt && (
                                                        <span className='font-medium text-info'>{format(new Date(item.trajectory.createdAt), 'MMM d')}</span>
                                                    )}
                                                    <span>{reason ?? describe(item.trajectory)}</span>
                                                </span>
                                            )}
                                        </span>
                                        {selected ? <Check size={15} aria-hidden='true' /> : <span />}
                                    </div>
                                );
                            })}
                            {!trajectoriesQuery.isLoading && trajectories.length === 0 && (
                                <div className='px-4 py-7 text-center text-xs text-muted'>
                                    {debouncedSearch ? `No trajectory matches “${debouncedSearch}”.` : 'No trajectories yet.'}
                                </div>
                            )}
                        </Scrollable>
                        <div className='flex min-h-11 items-center justify-between border-t border-border px-3 text-2xs text-muted'>
                            <span>↑ ↓ to move · Enter to select</span>
                            <span>Esc</span>
                        </div>
                    </Popover.Dialog>
                </Popover.Content>
            </Popover>
            {canClear && (
                <Button
                    variant='outline'
                    size='sm'
                    isIconOnly
                    aria-label={`Clear ${label.toLowerCase()}`}
                    onPress={() => onChange(null)}
                    className='h-8 min-w-8 rounded-l-none border-border'
                >
                    <X size={13} aria-hidden='true' />
                </Button>
            )}
        </div>
    );
};

export default TrajectoryPicker;
