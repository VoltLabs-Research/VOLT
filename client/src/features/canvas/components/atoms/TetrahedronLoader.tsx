import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LoadingPolyhedronProps {
    speed?: number;
    theme?: 'light' | 'dark' | 'warm' | 'cool';
    facePointDensity?: number;
}

const TetrahedronLoader = ({ speed = 5, theme = 'light', facePointDensity }: LoadingPolyhedronProps) => {
    const groupRef = useRef<THREE.Group>(null);
    const pointsRef = useRef<THREE.Points>(null);
    const facePointsRef = useRef<THREE.Points>(null);
    const linesRef = useRef<THREE.LineSegments>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const ambientRef = useRef<THREE.Points>(null);

    const [vertices, setVertices] = useState<number[][]>([]);
    const [edges, setEdges] = useState<number[][]>([]);
    const [faces, setFaces] = useState<number[][]>([]);
    const [facePoints, setFacePoints] = useState<number[][]>([]);

    const [animationPhase, setAnimationPhase] = useState(0);
    const [progress, setProgress] = useState(0);
    const themes = {
        light: {
            primary: [0.2, 0.2, 0.2],
            secondary: [0.6, 0.6, 0.6],
            accent: [0.9, 0.9, 0.9],
            surface: [0.95, 0.95, 0.95],
            facePoint: [0.4, 0.4, 0.4],
            background: '#f8f9fa'
            },
        dark: {
            primary: [0.9, 0.9, 0.9],
            secondary: [0.5, 0.5, 0.5],
            accent: [0.7, 0.7, 0.7],
            surface: [0.15, 0.15, 0.15],
            facePoint: [0.6, 0.6, 0.6],
            background: '#1a1a1a'
        },
        warm: {
            primary: [0.4, 0.3, 0.25],
            secondary: [0.7, 0.6, 0.5],
            accent: [0.9, 0.85, 0.8],
            surface: [0.95, 0.92, 0.88],
            facePoint: [0.6, 0.5, 0.4],
            background: '#faf8f6'
        },
        cool: {
            primary: [0.25, 0.3, 0.4],
            secondary: [0.5, 0.6, 0.7],
            accent: [0.8, 0.85, 0.9],
            surface: [0.88, 0.92, 0.95],
            facePoint: [0.4, 0.5, 0.6],
            background: '#f6f8fa'
        }
    };

    const currentTheme = themes[theme];

    const generateFacePoints = (faceVertices: number[][], density: number): number[][] => {
        const points: number[][] = [];
        for(let i = 0; i < density; i++){
            for(let j = 0; j < density - i; j++){
                const u = i / density;
                const v = j / density;
                const w = 1 - u - v;

                if(w >= 0){
                    const point = [
                        faceVertices[0][0] * w + faceVertices[1][0] * u + faceVertices[2][0] * v,
                        faceVertices[0][1] * w + faceVertices[1][1] * u + faceVertices[2][1] * v,
                        faceVertices[0][2] * w + faceVertices[1][2] * u + faceVertices[2][2] * v
                    ];

                    const length = Math.sqrt(point[0] ** 2 + point[1] ** 2 + point[2] ** 2);
                    if(length > 0){
                        const radius = Math.sqrt(faceVertices[0][0] ** 2 + faceVertices[0][1] ** 2 + faceVertices[0][2] ** 2);
                        points.push([
                            point[0] / length * radius,
                            point[1] / length * radius,
                            point[2] / length * radius
                        ]);
                    }
                }
            }
        }

        return points;
    };

    useEffect(() => {
        const tetrahedron = {
            vertices: [
                [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]
            ].map(v => v.map(c => c * 1.2)),
            edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
            faces: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]
        };

        setVertices(tetrahedron.vertices);
        setEdges(tetrahedron.edges);
        setFaces(tetrahedron.faces);

        const allFacePoints: number[][] = [];
        tetrahedron.faces.forEach((face) => {
            const faceVertices = face.map((idx) => tetrahedron.vertices[idx]);
            const points = generateFacePoints(faceVertices, facePointDensity as number);
            allFacePoints.push(...points);
        });

        setFacePoints(allFacePoints);
        setAnimationPhase(0);
        setProgress(0);
    }, [facePointDensity]);

    const ambientGeometry = useMemo(() => {
        const particles = new THREE.BufferGeometry();
        const particleCount = 100;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        for(let i = 0; i < particleCount; i++){
            const radius = 5 + Math.random() * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            colors[i * 3] = currentTheme.secondary[0];
            colors[i * 3 + 1] = currentTheme.secondary[1];
            colors[i * 3 + 2] = currentTheme.secondary[2];

            sizes[i] = 0.5 + Math.random() * 1;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        return particles;
    }, []);

    const globalTimerRef = useRef(0);

    useFrame((_, delta) => {
        globalTimerRef.current += delta;
        if(vertices.length === 0) return;

        setProgress((prev) => {
            const newProgress = prev + delta * speed * 1.5;
            if(animationPhase === 0 && newProgress >= vertices.length + 1.5){
                setAnimationPhase(1);
                return 0;
            }else if(animationPhase === 1 && newProgress >= edges.length + 1.5){
                setAnimationPhase(2);
                return 0;
            }else if(animationPhase === 2 && newProgress >= faces.length + 1.5){
                setAnimationPhase(3);
                return 0;
            }

            return newProgress;
        });

        updateGeometries();

        if(groupRef.current){
            const time = globalTimerRef.current * 0.8;
            groupRef.current.rotation.x = Math.sin(time * 0.4) * 0.15 + time * 0.05;
            groupRef.current.rotation.y = time * 0.2;
            groupRef.current.rotation.z = Math.sin(time * 0.6) * 0.05;
        }

        if(ambientRef.current && ambientRef.current.geometry.attributes.position){
            const positions = ambientRef.current.geometry.attributes.position.array as Float32Array;
            for(let i = 0; i < positions.length; i += 3){
                const angle = globalTimerRef.current * 0.1 + i * 0.01;
                const radius = Math.sqrt(positions[i] ** 2 + positions[i + 2] ** 2);
                positions[i] = Math.cos(angle) * radius;
                positions[i + 2] = Math.sin(angle) * radius;
            }

            ambientRef.current.geometry.attributes.position.needsUpdate = true;
        }
    });

    const updateGeometries = () => {
        const easeInOutCubic = (t: number): number => {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };

        if(pointsRef.current){
            const pointsGeom = new THREE.BufferGeometry();
            const pointsArray: number[] = [];
            const colors: number[] = [];
            const sizes: number[] = [];

            const visibleVertices = Math.min(Math.ceil(progress), vertices.length);

            for(let i = 0; i < visibleVertices; i++){
                const v = vertices[i];
                const rawFade = Math.max(0, Math.min(1, progress - i));
                const fadeIn = easeInOutCubic(rawFade);

                pointsArray.push(v[0], v[1], v[2]);

                const intensity = fadeIn * 0.9 + 0.1;
                colors.push(
                    currentTheme.primary[0] * intensity,
                    currentTheme.primary[1] * intensity,
                    currentTheme.primary[2] * intensity
                );

                sizes.push(0.8 + fadeIn * 0.4);
            }

            pointsGeom.setAttribute('position', new THREE.Float32BufferAttribute(pointsArray, 3));
            pointsGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            pointsGeom.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

            if(pointsRef.current.geometry) pointsRef.current.geometry.dispose();
            pointsRef.current.geometry = pointsGeom;
        }

        if(facePointsRef.current && animationPhase >= 3){
            const facePointsGeom = new THREE.BufferGeometry();
            const facePointsArray: number[] = [];
            const facePointColors: number[] = [];
            const facePointSizes: number[] = [];

            const visibleFacePoints = Math.min(Math.ceil(progress * 10), facePoints.length);

            for(let i = 0; i < visibleFacePoints; i++){
                const point = facePoints[i];
                const rawFade = Math.max(0, Math.min(1, (progress * 10) - i));
                const fadeIn = easeInOutCubic(rawFade);

                facePointsArray.push(point[0], point[1], point[2]);

                const intensity = fadeIn * 0.7 + 0.2;
                facePointColors.push(
                    currentTheme.facePoint[0] * intensity,
                    currentTheme.facePoint[1] * intensity,
                    currentTheme.facePoint[2] * intensity
                );

                facePointSizes.push(0.3 + fadeIn * 0.2);
            }

            facePointsGeom.setAttribute('position', new THREE.Float32BufferAttribute(facePointsArray, 3));
            facePointsGeom.setAttribute('color', new THREE.Float32BufferAttribute(facePointColors, 3));
            facePointsGeom.setAttribute('size', new THREE.Float32BufferAttribute(facePointSizes, 1));

            if(facePointsRef.current.geometry) facePointsRef.current.geometry.dispose();

            facePointsRef.current.geometry = facePointsGeom;
        }

        if(linesRef.current && animationPhase >= 1){
            const linesGeom = new THREE.BufferGeometry();
            const linesArray: number[] = [];
            const lineColors: number[] = [];

            const visibleEdges = animationPhase === 1 ?
                Math.min(Math.ceil(progress), edges.length) : edges.length;

            for(let i = 0; i < visibleEdges; i++){
                const edge = edges[i];
                const v1 = vertices[edge[0]];
                const v2 = vertices[edge[1]];
                const rawFade = animationPhase === 1 ?
                Math.max(0, Math.min(1, progress - i)) : 1;
                const fadeIn = easeInOutCubic(rawFade);

                linesArray.push(v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);

                const intensity = fadeIn * 0.6 + 0.2;

                lineColors.push(
                    currentTheme.secondary[0] * intensity,
                    currentTheme.secondary[1] * intensity,
                    currentTheme.secondary[2] * intensity,
                    currentTheme.secondary[0] * intensity,
                    currentTheme.secondary[1] * intensity,
                    currentTheme.secondary[2] * intensity
                );
            }

            linesGeom.setAttribute('position', new THREE.Float32BufferAttribute(linesArray, 3));
            linesGeom.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

            if(linesRef.current.geometry) linesRef.current.geometry.dispose();
            linesRef.current.geometry = linesGeom;
        }

        if(meshRef.current && animationPhase >= 2){
            const meshGeom = new THREE.BufferGeometry();
            const triangles: number[] = [];
            const normals: number[] = [];
            const faceColors: number[] = [];

            const visibleFaces = animationPhase === 2 ?
                Math.min(Math.ceil(progress), faces.length) : faces.length;

            for(let i = 0; i < visibleFaces; i++){
                const face = faces[i];
                const rawFade = animationPhase === 2 ?
                Math.max(0, Math.min(1, progress - i)) : 1;
                const fadeIn = easeInOutCubic(rawFade);

                for(let j = 1; j < face.length - 1; j++){
                    const v1 = vertices[face[0]];
                    const v2 = vertices[face[j]];
                    const v3 = vertices[face[j + 1]];

                    triangles.push(v1[0], v1[1], v1[2]);
                    triangles.push(v2[0], v2[1], v2[2]);
                    triangles.push(v3[0], v3[1], v3[2]);

                    const vec1 = new THREE.Vector3(v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]);
                    const vec2 = new THREE.Vector3(v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]);
                    const normal = vec1.cross(vec2).normalize();

                    for(let k = 0; k < 3; k++){
                        normals.push(normal.x, normal.y, normal.z);
                    }

                    const surfaceIntensity = fadeIn * 0.8 + 0.1;

                    for(let k = 0; k < 3; k++){
                        faceColors.push(
                            currentTheme.accent[0] * surfaceIntensity,
                            currentTheme.accent[1] * surfaceIntensity,
                            currentTheme.accent[2] * surfaceIntensity
                        );
                    }
                }
            }

            meshGeom.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
            meshGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            meshGeom.setAttribute('color', new THREE.Float32BufferAttribute(faceColors, 3));

            if(meshRef.current.geometry) meshRef.current.geometry.dispose();
            meshRef.current.geometry = meshGeom;
        }
    };

     return(
        <group scale={[1.5, 1.5, 1.5]}>
            <points ref={ambientRef} geometry={ambientGeometry}>
                <pointsMaterial
                    vertexColors
                    transparent
                    opacity={0.15}
                    size={0.02}
                    sizeAttenuation={true}
                />
            </points>

            <group ref={groupRef}>
                <points ref={pointsRef}>
                    <pointsMaterial
                        vertexColors
                        transparent
                        opacity={0.9}
                        size={0.9}
                        sizeAttenuation={false}
                    />
                </points>

                {animationPhase >= 1 && (
                    <lineSegments ref={linesRef}>
                        <lineBasicMaterial
                            vertexColors
                            transparent
                            opacity={0.7}
                        />
                    </lineSegments>
                )}

                {animationPhase >= 2 && (
                    <mesh ref={meshRef}>
                        <meshBasicMaterial
                            vertexColors
                            transparent
                            opacity={0.15}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                )}

                {animationPhase >= 3 && (
                    <points ref={facePointsRef}>
                        <pointsMaterial
                            vertexColors
                            transparent
                            opacity={0.8}
                            sizeAttenuation={false}
                        />
                    </points>
                )}
            </group>
        </group>
    );
};

export default TetrahedronLoader;
