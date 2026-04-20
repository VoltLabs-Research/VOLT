import Container from '@/shared/presentation/components/Container';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useMemo } from 'react';

import type { CanvasPresenceUser } from '../../../hooks/use-canvas-presence';

import './TimelinePresencePlayheads.css';

interface TimelinePresencePlayheadsProps {
    users: CanvasPresenceUser[];
    rangedTimesteps: number[];
    tickCenters: number[];
    scrollLeft: number;
};

const buildUserInitials = (user: CanvasPresenceUser): string => {
    const first = user.firstName?.trim()?.[0] ?? '';
    const last = user.lastName?.trim()?.[0] ?? '';
    const initials = `${first}${last}`.toUpperCase();
    if (initials) return initials;
    return user.email?.trim()?.[0]?.toUpperCase() ?? '?';
};

const buildUserLabel = (user: CanvasPresenceUser): string => {
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
    return user.email ?? 'Anonymous';
};

const TimelinePresencePlayheads = ({ users, rangedTimesteps, tickCenters, scrollLeft }: TimelinePresencePlayheadsProps) => {
    const visibleMarkers = useMemo(() => {
        if (tickCenters.length === 0 || rangedTimesteps.length === 0) return [];

        return users
            .filter((user) => typeof user.currentTimestep === 'number')
            .map((user) => {
                const index = rangedTimesteps.indexOf(user.currentTimestep as number);
                if (index < 0) return null;
                const center = tickCenters[index];
                if (center === undefined) return null;
                return { user, left: center - scrollLeft };
            })
            .filter((marker): marker is { user: CanvasPresenceUser; left: number } => marker !== null);
    }, [users, rangedTimesteps, tickCenters, scrollLeft]);

    if (visibleMarkers.length === 0) return null;

    return (
        <Container className='canvas-timeline-presence-playheads p-absolute' aria-hidden='false'>
            {visibleMarkers.map(({ user, left }) => (
                <Tooltip key={user.id} content={`${buildUserLabel(user)} @ t=${user.currentTimestep}`}>
                    <span
                        className='canvas-timeline-presence-playhead p-absolute'
                        style={{ left }}
                        role='img'
                        aria-label={`${buildUserLabel(user)} is viewing timestep ${user.currentTimestep}`}
                    >
                        {buildUserInitials(user)}
                    </span>
                </Tooltip>
            ))}
        </Container>
    );
};

export default TimelinePresencePlayheads;
