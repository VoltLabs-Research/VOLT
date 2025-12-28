/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '@/services/websockets/socketio';
import { getOrCreateGuestUser } from '@/utilities/api/guest';

interface Cursor {
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    velocity: number;
    angle: number;
    user?: {
        id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        color?: string;
    };
    trail: Array<{ x: number; y: number; opacity: number; timestamp: number }>;
    lastSeen: number;
    isMoving: boolean;
    clickRipples: Array<{ x: number; y: number; timestamp: number; id: string }>;
}

interface CursorShareLayerProps {
    roomName?: string;
    user?: any;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    enableTrails?: boolean;
    enableRipples?: boolean;
    smoothingFactor?: number;
    maxTrailLength?: number;
    vividness?: number;
    size?: number;
}

const clamp = (n: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, n));
};

const prefersReducedMotion = () => (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const cssHsl = (h: number, s: number, l: number, a = 1) => {
    return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}% / ${a})`;
};

// Identity-based color
const hasH = (seed: string) => {
    let h = 0;
    for(let i = 0; i < seed.length; i++){
        h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }

    return h % 360;
}

const parseToHsl = (color: string | undefined, fallbackhue: number, vividness: number) => {
    const s = 22 + vividness * 28;
    const l = 58 + vividness * 10;
    // If user provided a color, lightly desaturate via blending by converting to a CSS var stack
    if(!color){
        return {
            base: cssHsl(fallbackhue, s, l),
            halo: cssHsl(fallbackhue, s, l, 0.25),
            line: cssHsl(fallbackhue, s, l, 0.45)
        };
    }
    // We cannot reliably convert arbitrary CSS color to HSL here without a canvas; treat it as-it but reduce alpha
    return {
        base: color,
        halo: cssHsl(fallbackhue, s, l, 0.22),
        line: cssHsl(fallbackhue, s, l, 0.45)
    }
};

const CursorShareLayer: React.FC<CursorShareLayerProps> = ({
    roomName,
    user,
    className,
    style,
    children,
    enableTrails = true,
    enableRipples = true,
    smoothingFactor = 0.16,
    maxTrailLength = 14,
    vividness = 0.35,
    size = 1,
}) => {
    const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>(0);
    const lastUpdateRef = useRef<number>(0);
    const reduced = prefersReducedMotion();

    const lerp = (start: number, end: number, factor: number) => {
        return start + (end - start) * factor;
    };

    const animate = useCallback(() => {
        const now = performance.now();
        lastUpdateRef.current = now;

        setCursors((prev) => {
            const next = new Map(prev);
            let changed = false;

            next.forEach((cursor, id) => {
                const gone = now - cursor.lastSeen > 5000;
                if(gone){
                    next.delete(id);
                    changed = true;
                    return;
                }

                const newX = lerp(cursor.x, cursor.targetX, smoothingFactor);
                const newY = lerp(cursor.y, cursor.targetY, smoothingFactor)
                const distance = Math.hypot(newX - cursor.x, newY - cursor.y);
                const isMoving = distance > 0.08;

                let newTrail = cursor.trail;
                if(isMoving && enableTrails && !reduced){
                    newTrail = [
                        ...newTrail,
                        { x: cursor.x, y: cursor.y, opacity: 1, timestamp: now }
                    ]
                        .filter((p) => now - p.timestamp < 800)
                        .slice(-maxTrailLength);
                }else if(!enableTrails || reduced){
                    newTrail = [];
                }

                newTrail = newTrail.map((p, idx) => ({
                    ...p,
                    opacity: clamp((1 - (now - p.timestamp) / 800) * (idx / newTrail.length), 0, 0.6),
                }));

                const newRipples = cursor.clickRipples.filter((r) => now - r.timestamp < 700);

                if(
                    newX !== cursor.x ||
                    newY !== cursor.y ||
                    isMoving !== cursor.isMoving ||
                    newTrail.length !== cursor.trail.length ||
                    newRipples.length !== cursor.clickRipples.length
                ){
                    next.set(id, { ...cursor, x: newX, y: newY, isMoving, trail: newTrail, clickRipples: newRipples });
                    changed = true;
                }
            });

            return changed ? next : prev;
        });

        animationFrameRef.current = requestAnimationFrame(animate);
    }, [smoothingFactor, enableTrails, maxTrailLength, reduced]);

    useEffect(() => {
        lastUpdateRef.current = performance.now();
        animationFrameRef.current = requestAnimationFrame(animate);
        return() => {
            animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
        };
    }, [animate]);

    useEffect(() => {
        const recompute = () => {
            const rect = containerRef.current?.getBoundingClientRect();
            if(!rect) return;
            setCursors((prev) => {
                const next = new Map(prev);
                return next;
            });
        };

        window.addEventListener('resize', recompute);
        if(window.visualViewport){
            window.visualViewport.addEventListener('resize', recompute);
            window.visualViewport.addEventListener('scroll', recompute);
        }

        return() => {
            window.removeEventListener('resize', recompute);
            if(window.visualViewport){
                window.visualViewport.removeEventListener('resize', recompute);
                window.visualViewport.removeEventListener('scroll', recompute);
            }
        };
    }, []);

    useEffect(() => {
        if(!roomName) return;

        const initCursor = async() => {
            const joinUser = user ?? await getOrCreateGuestUser();
            socketService
                .emit('cursor:join', { room: roomName, user: joinUser })
                .catch(err => console.error('Failed to join cursor room:', err));
        };
        initCursor();

        const offMove = socketService.on('cursor:move', (data: any) => {
            setCursors((prev) => {
                const next = new Map(prev);
                const existing = next.get(data.id);
                const hue = hasH(data.id);
                const { base } = parseToHsl(data.user?.color, hue, vividness);
                const rect = containerRef.current?.getBoundingClientRect();
                const x = rect ? clamp(data.nx, 0, 1) * rect.width : 0;
                const y = rect ? clamp(data.ny, 0, 1) * rect.height : 0;

                next.set(data.id, {
                    id: data.id,
                    x: existing?.x ?? x,
                    y: existing?.y ?? y,
                    targetX: x,
                    targetY: y,
                    velocity: data.velocity ?? 0,
                    angle: data.angle ?? 0,
                    user: { ...data.user, color: base } as any,
                    trail: existing?.trail ?? [],
                    lastSeen: performance.now(),
                    isMoving: false,
                    clickRipples: existing?.clickRipples ?? [],
                });

                return next;
            });
        });

        const offClick = socketService.on('cursor:click', (data: any) => {
            setCursors((prev) => {
                const next = new Map(prev);
                const existing = next.get(data.id);
                if(existing){
                    const rect = containerRef.current?.getBoundingClientRect();
                    const x = rect ? clamp(data.nx, 0, 1) * rect.width : 0;
                    const y = rect ? clamp(data.ny, 0, 1) * rect.height : 0;
                    next.set(data.id, {
                        ...existing,
                        clickRipples: [
                            ...existing.clickRipples,
                            { x, y, timestamp: performance.now(), id: Math.random().toString(36) }
                        ]
                    });
                }

                return next;
            });
        });

        const offLeft = socketService.on('cursor:user-left', (data: { id: string }) => {
            setCursors((prev) => {
                const next = new Map(prev);
                next.delete(data.id);
                return next;
            })
        });

        return() => {
            offMove();
            offClick();
            offLeft();
        };
    }, [roomName, user, vividness]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if(!roomName || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const nx = clamp((e.clientX - rect.left) / (rect.width || 1), 0, 1);
        const ny = clamp((e.clientY - rect.top) / (rect.height || 1), 0, 1);
        socketService
            .emit('cursor:move', { room: roomName, nx, ny, ts: Date.now(), velocity: 0, angle: 0 })
            .catch((err) => console.error('Failed to send cursor move:', err));
    };

    const handleClick = (e: React.MouseEvent) => {
        if(!roomName || !containerRef.current) return;
        if(!enableRipples) return;
        const rect = containerRef.current.getBoundingClientRect();
        const nx = clamp((e.clientX - rect.left) / (rect.width || 1), 0, 1);
        const ny = clamp((e.clientY - rect.top) / (rect.height || 1), 0, 1);
        socketService
            .emit('cursor:click', { room: roomName, nx, ny, ts: Date.now() })
            .catch((err) => console.error('Failed to send cursor click:', err));
    };

    const cursorsArray = Array.from(cursors.values());
    const baseScale = clamp(size, 0.6, 2);
    const mainDot = 12 * baseScale;
    const trailDot = 3 * baseScale;

    return(
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            className={className}
            style={{ position: 'relative', overflow: 'hidden', ...style }}
        >
            {cursorsArray.map((cursor) => {
                const hue = hasH(cursor.id);
                const { base, halo, line } = parseToHsl(cursor.user?.color, hue, vividness);
                return(
                    <div key={cursor.id}>
                        {enableTrails && cursor.trail.map((p, i) => (
                            <div
                                key={`trail-${cursor.id}-${i}`}
                                style={{
                                    position: 'absolute',
                                    left: p.x - trailDot / 2,
                                    top: p.y - trailDot / 2,
                                    width: trailDot,
                                    height: trailDot,
                                    borderRadius: '50%',
                                    background: base,
                                    opacity: p.opacity * 0.35,
                                    pointerEvents: 'none',
                                    zIndex: 999,
                                    transform: `scale(${0.85 + p.opacity * 0.25})`,
                                    transition: reduced ? undefined : 'opacity 0.08s ease-out, transform 0.08s ease-out',
                                    filter: 'blur(0.2px)',
                                    mixBlendMode: 'plus-lighter',
                                }}
                            />
                        ))}

                        <div
                            style={{
                                position: 'absolute',
                                left: cursor.x - mainDot / 2,
                                top: cursor.y - mainDot / 2,
                                width: mainDot,
                                height: mainDot,
                                borderRadius: '9999px',
                                background: base,
                                pointerEvents: 'none',
                                zIndex: 1000,
                                transform: `scale(${cursor.isMoving && !reduced ? 1.12 : 1}) rotate(${cursor.angle}rad)`,
                                transition: reduced ? undefined : 'transform 140ms cubic-bezier(0.34,1.56,0.64,1)',
                                boxShadow: `0 0 ${6 * baseScale}px ${halo}, 0 0 ${14 * baseScale}px ${cssHsl(hue, 30, 60, 0.12)}`,
                                border: `1px solid ${cssHsl(hue, 24, 44, 0.45)}`,
                                outline: `1px solid ${cssHsl(hue, 20, 98, 0.08)}`,
                                backdropFilter: 'blur(0.5px)',
                            }}
                        />

                        {cursor.user?.firstName && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: cursor.x + 14 * baseScale,
                                    top: cursor.y - 22 * baseScale,
                                    fontSize: 12 * baseScale,
                                    color: 'rgb(234 236 239)',
                                    background: 'rgba(20,20,22,0.65)',
                                    padding: `${3 * baseScale}px ${8 * baseScale}px`,
                                    borderRadius: 9999,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    whiteSpace: 'nowrap',
                                    pointerEvents: 'none',
                                    zIndex: 1001,
                                    transform: `translateY(${cursor.isMoving && !reduced ? -3 * baseScale : 0}px)`,
                                    transition: reduced ? undefined : 'transform 120ms ease-out, opacity 120ms ease-out',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
                                    backdropFilter: 'blur(6px) saturate(120%)',
                                    opacity: 0.92,
                                }}
                            >
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: 6 * baseScale,
                                        height: 6 * baseScale,
                                        borderRadius: '50%',
                                        background: base,
                                        boxShadow: `0 0 6px ${halo}`,
                                        marginRight: 6 * baseScale,
                                        verticalAlign: 'middle',
                                    }}
                                />
                                {cursor.user.firstName}
                            </div>
                        )}

                        {enableRipples && cursor.clickRipples.map((r) => {
                            const age = (performance.now() - r.timestamp) / 1000;
                            const o = clamp(1 - age, 0, 1) * 0.6;
                            const sc = 1 + age * 2.2;
                            const rect = containerRef.current?.getBoundingClientRect();
                            const rx = rect ? r.x * rect.width : 0;
                            const ry = rect ? r.y * rect.height : 0;
                            return(
                                <div
                                    key={r.id}
                                    style={{
                                        position: 'absolute',
                                        left: (rect ? rx : r.x) - 14 * baseScale,
                                        top: (rect ? ry : r.y) - 14 * baseScale,
                                        width: 28 * baseScale,
                                        height: 28 * baseScale,
                                        borderRadius: '50%',
                                        border: `1px solid ${line}`,
                                        boxShadow: `0 0 0 1px ${cssHsl(hue, 24, 44, 0.08)} inset`,
                                        opacity: o,
                                        transform: `scale(${sc})`,
                                        pointerEvents: 'none',
                                        zIndex: 998,
                                        transition: reduced ? undefined : 'opacity 80ms ease-out',
                                        mixBlendMode: 'plus-lighter',
                                    }}
                                />
                            );
                        })}
                    </div>
                );
            })}

            <style>{`
                @media(prefers-reduced-motion: reduce) {
                div { transition: none !important; animation: none !important; }
                }
            `}</style>

            {children}
        </div>
    );
};

export default CursorShareLayer;
