export const CHANNELS = [
    'deploy:log',
    'deploy:state',
    'source:progress',
    'deploy:phases',
    'deploy:phase'
] as const;

export type Channel = typeof CHANNELS[number];

export interface PhaseSpec{
    id: string;
    label: string;
}

export interface AppEvents{
    'deploy:log': {
        stream: 'stdout' | 'stderr';
        line: string;
    },
    'deploy:state': {
        state: 'idle' | 'starting' | 'up' | 'stopping' | 'down' | 'error';
        message?: string;
    },
    'source:progress': {
        repoId: string;
        phase: 'download' | 'extract' | 'done';
        bytes?: number;
    },
    'deploy:phases': {
        phases: PhaseSpec[];
    },
    'deploy:phase': {
        id: string;
        status: 'running' | 'done' | 'error';
        detail?: string;
    }
};

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _channelsMatchAppEvents: Equal<Channel, keyof AppEvents> = true;
void _channelsMatchAppEvents;
