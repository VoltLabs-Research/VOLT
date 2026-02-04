import { useEffect, useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';

export interface RendererStats {
    fps: number;
    frameTime: number;
    memory: {
        geometries: number;
        textures: number;
    };
    render: {
        calls: number;
        triangles: number;
        points: number;
        lines: number;
    };
}

export interface UsePerformanceMonitorProps {
    currentTimestep?: number;
}

export interface UsePerformanceMonitorReturn {
    stats: RendererStats;
    atomCount: number;
    currentTimestep: number | undefined;
}

const DEFAULT_STATS: RendererStats = {
    fps: 0,
    frameTime: 0,
    memory: { geometries: 0, textures: 0 },
    render: { calls: 0, triangles: 0, points: 0, lines: 0 }
};

const usePerformanceMonitor = (props?: UsePerformanceMonitorProps): UsePerformanceMonitorReturn => {
    const { rendererStats, currentTimestep } = useEditorStore(useShallow((state) => ({
        rendererStats: state.rendererStats,
        currentTimestep: props?.currentTimestep ?? state.currentTimestep
    })));
    const trajectory = useTrajectoryStore((state) => state.trajectory);

    const [stats, setStats] = useState<RendererStats>(DEFAULT_STATS);

    const atomCount = useMemo(() => {
        if (!trajectory?.frames || currentTimestep === undefined) return 0;
        const frame = trajectory.frames.find((f: any) => f.timestep === currentTimestep);
        return frame?.natoms ?? 0;
    }, [trajectory?.frames, currentTimestep]);

    useEffect(() => {
        if (!rendererStats) return;
        setStats(rendererStats as RendererStats);
    }, [rendererStats]);

    return {
        stats,
        atomCount,
        currentTimestep
    };
};

export default usePerformanceMonitor;
