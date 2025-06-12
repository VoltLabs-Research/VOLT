// @ts-nocheck
import React, { useMemo, useRef, useEffect } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

interface VTKPoint {
    x: number;
    y: number;
    z: number;
}

interface VTKDislocationLine {
    id: number;
    pointIndices: number[];
    points: VTKPoint[];
    burgersVector: [number, number, number];
    length: number;
    magnitude: number;
}

interface VTKDislocationData {
    points: VTKPoint[];
    lines: VTKDislocationLine[];
    cells: number[][];
}

export function parseVTKString(vtkContent: string): VTKDislocationData {
    const lines = vtkContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('Parsing VTK with', lines.length, 'lines');
    
    let i = 0;
    let points: VTKPoint[] = [];
    let cells: number[][] = [];
    let segmentLengths: number[] = [];
    let burgersVectorMagnitudes: number[] = [];
    let segmentIds: number[] = [];
    
    // Extract Burgers vectors from comments
    const burgersVectors: { [key: number]: [number, number, number] } = {};
    
    while (i < lines.length) {
        const line = lines[i];
        
        // Parse Burgers vectors from comments
        if (line.startsWith('# Segment ')) {
            const segmentMatch = line.match(/# Segment (\d+): \[([-\d.]+) ([-\d.]+) ([-\d.]+)\]/);
            if (segmentMatch) {
                const segmentId = parseInt(segmentMatch[1]);
                burgersVectors[segmentId] = [
                    parseFloat(segmentMatch[2]),
                    parseFloat(segmentMatch[3]),
                    parseFloat(segmentMatch[4])
                ];
            }
            i++;
            continue;
        }
        
        // Parse points section
        if (line.startsWith('POINTS')) {
            const match = line.match(/POINTS (\d+)/);
            if (match) {
                const numPoints = parseInt(match[1]);
                i++;
                
                let pointsRead = 0;
                while (pointsRead < numPoints && i < lines.length) {
                    const pointLine = lines[i].trim();
                    if (pointLine && !pointLine.startsWith('#')) {
                        const coords = pointLine.split(/\s+/).map(Number);
                        for (let j = 0; j < coords.length; j += 3) {
                            if (j + 2 < coords.length && pointsRead < numPoints) {
                                points.push({
                                    x: coords[j],
                                    y: coords[j + 1],
                                    z: coords[j + 2]
                                });
                                pointsRead++;
                            }
                        }
                    }
                    i++;
                }
                continue;
            }
        }
        
        // Parse cells section
        if (line.startsWith('CELLS')) {
            const match = line.match(/CELLS (\d+)/);
            if (match) {
                const numCells = parseInt(match[1]);
                i++;
                
                for (let cellIdx = 0; cellIdx < numCells; cellIdx++) {
                    if (i >= lines.length) break;
                    const cellLine = lines[i].trim();
                    if (cellLine && !cellLine.startsWith('#')) {
                        const indices = cellLine.split(/\s+/).map(Number);
                        if (indices.length > 1) {
                            const numPointsInLine = indices[0];
                            const pointIndices = indices.slice(1, numPointsInLine + 1);
                            cells.push(pointIndices);
                        }
                    }
                    i++;
                }
                continue;
            }
        }
        
        // Parse scalar data sections
        if (line.startsWith('SCALARS segment_length')) {
            i++; // Skip LOOKUP_TABLE line
            if (i < lines.length) i++;
            
            while (i < lines.length && segmentLengths.length < cells.length) {
                const value = parseFloat(lines[i].trim());
                if (!isNaN(value)) {
                    segmentLengths.push(value);
                }
                i++;
            }
            continue;
        }
        
        if (line.startsWith('SCALARS burgers_vector_magnitude')) {
            i++; // Skip LOOKUP_TABLE line  
            if (i < lines.length) i++;
            
            while (i < lines.length && burgersVectorMagnitudes.length < cells.length) {
                const value = parseFloat(lines[i].trim());
                if (!isNaN(value)) {
                    burgersVectorMagnitudes.push(value);
                }
                i++;
            }
            continue;
        }
        
        if (line.startsWith('SCALARS segment_id')) {
            i++; // Skip LOOKUP_TABLE line
            if (i < lines.length) i++;
            
            while (i < lines.length && segmentIds.length < cells.length) {
                const value = parseInt(lines[i].trim());
                if (!isNaN(value)) {
                    segmentIds.push(value);
                }
                i++;
            }
            continue;
        }
        
        i++;
    }
    
    // Create dislocation lines from cells (like Python code)
    const dislocationLines: VTKDislocationLine[] = cells.map((pointIndices, index) => {
        const segmentId = segmentIds[index] || index;
        const linePoints = pointIndices.map(idx => points[idx] || { x: 0, y: 0, z: 0 });
        
        return {
            id: segmentId,
            pointIndices,
            points: linePoints,
            burgersVector: burgersVectors[segmentId] || [0, 0, 0],
            length: segmentLengths[index] || 0,
            magnitude: burgersVectorMagnitudes[index] || 0
        };
    });
    
    // Calculate bounding box for dislocations
    const dislocationBounds = points.length > 0 ? {
        x: [Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x))],
        y: [Math.min(...points.map(p => p.y)), Math.max(...points.map(p => p.y))],
        z: [Math.min(...points.map(p => p.z)), Math.max(...points.map(p => p.z))]
    } : null;

    console.log('VTK Parser Results:', {
        totalLines: lines.length,
        pointsParsed: points.length,
        cellsParsed: cells.length,
        dislocationLinesCreated: dislocationLines.length,
        dislocationBounds,
        dislocationDimensions: dislocationBounds ? {
            width: dislocationBounds.x[1] - dislocationBounds.x[0],
            height: dislocationBounds.y[1] - dislocationBounds.y[0],
            depth: dislocationBounds.z[1] - dislocationBounds.z[0]
        } : null,
        sampleLine: dislocationLines[0],
        firstLinePoints: dislocationLines[0]?.points.slice(0, 3)
    });

    return { points, lines: dislocationLines, cells };
}

interface DislocationViewerProps {
    vtkData: string;
    scale: number;
    centerOffset?: [number, number, number];
    showBurgersVectors?: boolean;
    colorByBurgersVector?: boolean;
}

const DislocationViewer: React.FC<DislocationViewerProps> = ({ 
    vtkData, 
    scale = 1,
    centerOffset = [0, 0, 0],
    showBurgersVectors = true,
    colorByBurgersVector = true
}) => {
    console.log('DislocationViewer rendered with:', {
        vtkDataLength: vtkData.length,
        scale,
        centerOffset,
        showBurgersVectors,
        colorByBurgersVector
    });

    const dislocationData = useMemo(() => {
        try {
            const parsed = parseVTKString(vtkData);
            console.log('Parsed VTK data:', {
                pointsCount: parsed.points.length,
                linesCount: parsed.lines.length,
                cellsCount: parsed.cells.length,
                firstFewPoints: parsed.points.slice(0, 3),
                firstFewLines: parsed.lines.slice(0, 3).map(line => ({
                    id: line.id,
                    pointCount: line.points.length,
                    firstPoints: line.points.slice(0, 3),
                    burgersVector: line.burgersVector
                }))
            });
            
            // Calculate center and scale for dislocations to match atom visualization
            if (parsed.points.length > 0) {
                const xs = parsed.points.map(p => p.x);
                const ys = parsed.points.map(p => p.y);
                const zs = parsed.points.map(p => p.z);
                
                const dislocationCenter = {
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    z: (Math.min(...zs) + Math.max(...zs)) / 2
                };
                
                console.log('Dislocation center vs atom center offset:', {
                    dislocationCenter,
                    atomCenterOffset: centerOffset,
                    atomScale: scale
                });
            }
            
            return parsed;
        } catch (error) {
            console.error('Error parsing VTK data:', error);
            return { points: [], lines: [], cells: [] };
        }
    }, [vtkData, centerOffset, scale]);

    // Generate colors based on Burgers vector
    const getLineColor = (line: VTKDislocationLine): THREE.Color => {
        if (!colorByBurgersVector) {
            return new THREE.Color(0xff0000); // Bright red default for visibility
        }

        const [bx, by, bz] = line.burgersVector;
        
        // Create color based on Burgers vector direction with better visibility
        const r = Math.abs(bx) * 3; // Increased scaling
        const g = Math.abs(by) * 3;
        const b = Math.abs(bz) * 3;
        
        return new THREE.Color(
            Math.min(1, Math.max(0.3, r)), // Higher minimum for visibility
            Math.min(1, Math.max(0.3, g)),
            Math.min(1, Math.max(0.3, b))
        );
    };

    // Generate line thickness based on segment length or magnitude
    const getLineWidth = (line: VTKDislocationLine): number => {
        const baseWidth = 5.0; // Much thicker lines for visibility
        const lengthFactor = Math.log(line.length + 1) / 5;
        return baseWidth + lengthFactor;
    };

    if (dislocationData.lines.length === 0) {
        console.log('No lines to render, returning null');
        return null;
    }

    console.log('Rendering', dislocationData.lines.length, 'dislocation lines');

    return (
        <group position={centerOffset}>
            {dislocationData.lines.map((line, lineIndex) => {
                // Convert line points to Three.js coordinates (like Python's ax.plot)
                const linePoints: [number, number, number][] = line.points.map(point => [
                    point.x * scale,
                    point.z * scale, // Swap Y and Z for typical 3D viewing
                    point.y * scale
                ]);

                // Log first few lines for debugging
                if (lineIndex < 3) {
                    console.log(`Line ${lineIndex}:`, {
                        pointCount: line.points.length,
                        originalPoints: line.points.slice(0, 3),
                        transformedPoints: linePoints.slice(0, 3),
                        scale,
                        centerOffset,
                        burgersVector: line.burgersVector,
                        length: line.length
                    });
                }

                const color = getLineColor(line);
                const lineWidth = getLineWidth(line);

                // Only render lines with more than 1 point (like Python code)
                if (linePoints.length > 1) {
                    return (
                        <group key={`line-${lineIndex}`}>
                            {/* Main dislocation line - render as continuous line */}
                            <Line
                                points={linePoints}
                                color={color}
                                lineWidth={lineWidth}
                                dashed={false}
                            />
                            
                            {/* Burgers vector visualization at the center of the line */}
                            {showBurgersVectors && linePoints.length > 0 && (
                                <BurgersVectorArrow
                                    position={[
                                        linePoints[Math.floor(linePoints.length / 2)][0],
                                        linePoints[Math.floor(linePoints.length / 2)][1],
                                        linePoints[Math.floor(linePoints.length / 2)][2]
                                    ]}
                                    direction={line.burgersVector}
                                    scale={scale}
                                    color={color}
                                />
                            )}
                        </group>
                    );
                }
                return null;
            })}
        </group>
    );
};

// Componente para mostrar vectores de Burgers como flechas
const BurgersVectorArrow: React.FC<{
    position: [number, number, number];
    direction: [number, number, number];
    scale: number;
    color: THREE.Color;
}> = ({ position, direction, scale, color }) => {
    const arrowRef = useRef<THREE.Group>(null);

    useEffect(() => {
        if (!arrowRef.current) return;

        const [dx, dy, dz] = direction;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (length === 0) return;

        // Normalize and scale the direction
        const arrowLength = length * scale * 0.5;
        const normalizedDir = [dx / length, dz / length, dy / length]; // Swap Y and Z

        // Create arrow direction
        const arrowDirection = new THREE.Vector3(...normalizedDir);
        arrowRef.current.lookAt(
            position[0] + arrowDirection.x * arrowLength,
            position[1] + arrowDirection.y * arrowLength,
            position[2] + arrowDirection.z * arrowLength
        );
    }, [direction, scale, position]);

    const arrowLength = Math.sqrt(
        direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2
    ) * scale * 0.3;

    if (arrowLength === 0) return null;

    return (
        <group ref={arrowRef} position={position}>
            {/* Arrow shaft */}
            <mesh position={[0, 0, arrowLength / 2]}>
                <cylinderGeometry args={[0.02 * scale, 0.02 * scale, arrowLength, 8]} />
                <meshBasicMaterial color={color} transparent opacity={0.7} />
            </mesh>
            
            {/* Arrow head */}
            <mesh position={[0, 0, arrowLength]}>
                <coneGeometry args={[0.05 * scale, 0.1 * scale, 8]} />
                <meshBasicMaterial color={color} />
            </mesh>
        </group>
    );
};

export default DislocationViewer;