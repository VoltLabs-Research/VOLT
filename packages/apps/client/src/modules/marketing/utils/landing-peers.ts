import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';

interface LandingPerson extends WorkspacePresenceUser {
    firstName: string;
    lastName: string;
}

interface LandingColleague extends LandingPerson {
    // A Lissajous figure in the 0 to 1 coordinates cursors travel in: a centre, how far it
    // swings each way, and how fast, in radians per second.
    path: { x: number; y: number; rx: number; ry: number; fx: number; fy: number; phase: number };
}

// The lab in the demos. They are not people, and nobody is watching.
export const LANDING_OWNER: LandingPerson = {
    id: 'landing-valentina',
    firstName: 'Valentina',
    lastName: 'Rojas',
    isAnonymous: false
};

// Who is in the scene with her, and where their pointers go.
export const LANDING_COLLEAGUES: LandingColleague[] = [
    {
        id: 'landing-kenji',
        firstName: 'Kenji',
        lastName: 'Sato',
        isAnonymous: false,
        path: { x: 0.72, y: 0.62, rx: 0.11, ry: 0.15, fx: 0.33, fy: 0.46, phase: 2.1 }
    },
    {
        id: 'landing-amara',
        firstName: 'Amara',
        lastName: 'Okafor',
        isAnonymous: false,
        path: { x: 0.44, y: 0.68, rx: 0.15, ry: 0.09, fx: 0.51, fy: 0.37, phase: 4.2 }
    }
];

export const LANDING_PEOPLE: LandingPerson[] = [
    LANDING_OWNER,
    ...LANDING_COLLEAGUES.map(({ path: _path, ...person }) => person)
];
