/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { useEffect, useState, useMemo } from 'react';
import EditorWidget from '@/features/canvas/components/organisms/EditorWidget';
import Container from '@/components/primitives/Container';
import { useEditorStore } from '@/features/canvas/stores/editor';
import { useTrajectoryStore } from '@/features/trajectory/stores';
import '@/features/canvas/components/organisms/PerformanceMonitor/PerformanceMonitor.css';

interface RendererStats {
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

const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
};

const PerformanceMonitor: React.FC = () => {
    const rendererStats = useEditorStore((state) => state.rendererStats);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    
    const [stats, setStats] = useState<RendererStats>({
        fps: 0,
        frameTime: 0,
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0, points: 0, lines: 0 }
    });

    const atomCount = useMemo(() => {
        if (!trajectory?.frames || currentTimestep === undefined) return 0;
        const frame = trajectory.frames.find((f: any) => f.timestep === currentTimestep);
        return frame?.natoms ?? 0;
    }, [trajectory?.frames, currentTimestep]);

    useEffect(() => {
        if (rendererStats) {
            setStats(rendererStats);
        }
    }, [rendererStats]);

    return (
        <EditorWidget className='perf-monitor-container' draggable={false}>
            <Container className='perf-monitor-grid'>
                <span className='color-muted font-size-1'>Atoms</span>
                <span className='color-secondary font-size-1 font-weight-5'>{formatNumber(atomCount)}</span>
                
                <span className='color-muted font-size-1'>Timestep</span>
                <span className='color-secondary font-size-1 font-weight-5'>{currentTimestep ?? '-'}</span>
                
                <span className='color-muted font-size-1'>FPS</span>
                <span className='color-secondary font-size-1 font-weight-5'>{stats.fps.toFixed(0)}</span>
                
                <span className='color-muted font-size-1'>Frame</span>
                <span className='color-secondary font-size-1 font-weight-5'>{stats.frameTime.toFixed(1)}ms</span>
                
                <span className='color-muted font-size-1'>Geometries</span>
                <span className='color-secondary font-size-1 font-weight-5'>{stats.memory.geometries}</span>
                
                <span className='color-muted font-size-1'>Textures</span>
                <span className='color-secondary font-size-1 font-weight-5'>{stats.memory.textures}</span>
                
                <span className='color-muted font-size-1'>Draw Calls</span>
                <span className='color-secondary font-size-1 font-weight-5'>{formatNumber(stats.render.calls)}</span>
                
                <span className='color-muted font-size-1'>Triangles</span>
                <span className='color-secondary font-size-1 font-weight-5'>{formatNumber(stats.render.triangles)}</span>
            </Container>
        </EditorWidget>
    );
};

export default PerformanceMonitor;
