/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 */

import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';

const PerformanceStatsCollector: React.FC = () => {
    const { gl } = useThree();
    const setRendererStats = useEditorStore((state) => state.setRendererStats);
    const activeModifiers = useCanvasUIStore((state) => state.activeModifiers);
    
    const frameTimesRef = useRef<number[]>([]);
    const lastTimeRef = useRef(performance.now());
    const updateIntervalRef = useRef(0);

    const isMonitorActive = activeModifiers.some(m => m.key === 'performance-monitor');

    useFrame(() => {
        if (!isMonitorActive) return;

        const now = performance.now();
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;

        frameTimesRef.current.push(delta);
        if (frameTimesRef.current.length > 60) {
            frameTimesRef.current.shift();
        }

        updateIntervalRef.current++;
        if (updateIntervalRef.current >= 30) {
            updateIntervalRef.current = 0;

            const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
            const fps = 1000 / avgFrameTime;

            const info = gl.info;

            setRendererStats({
                fps,
                frameTime: avgFrameTime,
                memory: {
                    geometries: info.memory.geometries,
                    textures: info.memory.textures
                },
                render: {
                    calls: info.render.calls,
                    triangles: info.render.triangles,
                    points: info.render.points,
                    lines: info.render.lines
                }
            });
        }
    });

    return null;
};

export default PerformanceStatsCollector;
