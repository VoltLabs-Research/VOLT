import { ClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { FrameJobGroupStatus, JobStatus } from '@volt/contracts/modules/jobs/domain';
import { LANDING_CLUSTER_ID, LANDING_CLUSTER_NAME, hoursAgo } from '@/modules/marketing/utils/landing-workspace';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';
import type { Job, TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';

const KIB_PER_MIB = 1024;
const CORES = 16;
const MEMORY_GB = 64;
const DISK_GB = 931.5;
const DISK_USED_GB = 412.3;
const BOOTED_AT = Date.now() - 9 * 24 * 60 * 60 * 1000;
const HISTORY_POINTS = 60;

const job = (trajectoryId: string, trajectoryName: string, timestep: number, queueType: string, status: JobStatus): Job => ({
    jobId: `${trajectoryId}-${timestep}-${queueType}`,
    trajectoryId,
    trajectoryName,
    timestep,
    queueType,
    status,
    timestamp: hoursAgo(0.05)
});

const frame = (timestep: number, overallStatus: FrameJobGroupStatus, jobs: Job[]) => ({ timestep, overallStatus, jobs });

// The two uploads on their way through the cluster: one being converted frame by frame,
// the other waiting its turn.
export const LANDING_JOB_GROUPS: TrajectoryJobGroup[] = [
    {
        trajectoryId: 'landing-nanoindentation',
        trajectoryName: 'Nanoindentation',
        frameGroups: [
            frame(0, FrameJobGroupStatus.Completed, [job('landing-nanoindentation', 'Nanoindentation', 0, 'trajectory_glb_conversion', JobStatus.Completed)]),
            frame(10_000, FrameJobGroupStatus.Running, [job('landing-nanoindentation', 'Nanoindentation', 10_000, 'trajectory_glb_conversion', JobStatus.Running)]),
            frame(20_000, FrameJobGroupStatus.Queued, [job('landing-nanoindentation', 'Nanoindentation', 20_000, 'trajectory_glb_conversion', JobStatus.Queued)])
        ],
        latestTimestamp: hoursAgo(0.05),
        overallStatus: FrameJobGroupStatus.Running,
        completedCount: 1,
        totalCount: 3
    },
    {
        trajectoryId: 'landing-tensile-test',
        trajectoryName: 'Tensile Test',
        frameGroups: [
            frame(0, FrameJobGroupStatus.Queued, [job('landing-tensile-test', 'Tensile Test', 0, 'cloud_upload', JobStatus.Queued)])
        ],
        latestTimestamp: hoursAgo(0.05),
        overallStatus: FrameJobGroupStatus.Queued,
        completedCount: 0,
        totalCount: 1
    }
];

const wave = (seconds: number, period: number, phase = 0) => Math.sin((seconds / period) * Math.PI * 2 + phase);

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

// What lab-workstation reports at a moment while it converts the upload, busy but below the
// load the monitoring page warns at, in the units the server relays a heartbeat in
// (toSystemMetricsFromHeartbeat): percentages as the daemon rounds them, memory and disk in
// GB, network in KB/s and disk throughput in MB/s.
export const clusterMetricsAt = (at: number): ClusterMetrics => {
    const seconds = at / 1000;
    const cpu = 46 + 7 * wave(seconds, 13) + 3 * wave(seconds, 3.1, 1);
    const memoryUsed = 24.6 + 0.8 * wave(seconds, 21);
    const read = 38 + 14 * wave(seconds, 7) + 6 * wave(seconds, 2.7, 1);
    const write = 21 + 9 * wave(seconds, 9, 2);

    return {
        timestamp: new Date(at).toISOString(),
        clusterId: LANDING_CLUSTER_ID,
        teamClusterId: LANDING_CLUSTER_ID,
        serverId: LANDING_CLUSTER_NAME,
        status: ClusterStatus.Healthy,
        cpu: {
            usage: Math.round(cpu),
            cores: CORES,
            // Each core drifts slowly around the load, so the distribution reads core by core.
            coresUsage: Array.from({ length: CORES }, (_, core) => Math.round(Math.max(4, Math.min(98, cpu + 16 * wave(seconds, 24 + core * 2.5, core * 0.8))))),
            loadAvg: [7.4, 6.9, 6.2]
        },
        memory: { total: MEMORY_GB, used: memoryUsed, free: MEMORY_GB - memoryUsed, usagePercent: Math.round((memoryUsed / MEMORY_GB) * 100) },
        disk: { total: DISK_GB, used: DISK_USED_GB, free: DISK_GB - DISK_USED_GB, usagePercent: Math.round((DISK_USED_GB / DISK_GB) * 100) },
        network: {
            incoming: round((2.4 + 1.1 * wave(seconds, 9) + 0.4 * wave(seconds, 2.3, 2)) * KIB_PER_MIB, 1),
            outgoing: round((0.9 + 0.4 * wave(seconds, 11, 1)) * KIB_PER_MIB, 1)
        },
        diskOperations: { read: round(read, 2), write: round(write, 2), speed: Math.round((read + write) * 24) },
        responseTimes: { postgres: 0, self: 4 },
        uptime: Math.round((at - BOOTED_AT) / 1000)
    };
};

// The reports before `at`, as many as the monitoring page keeps, as it loads them.
export const clusterHistoryUntil = (at: number, everyMs: number): ClusterMetrics[] => (
    Array.from({ length: HISTORY_POINTS }, (_, index) => clusterMetricsAt(at - (HISTORY_POINTS - 1 - index) * everyMs))
);
