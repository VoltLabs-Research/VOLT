import { Box3, Vector3, Sphere } from 'three';
import * as THREE from 'three';
import type { TrajectoryGLBs } from '@/types/stores/editor/model';

type MaterialCache = Map<string, THREE.MeshStandardMaterial>;
export type TimelineGLBMap = Record<number, string>;

const cache: MaterialCache = new Map();

type LoadModelsParams = {
    trajectoryId: string;
    analysisId: string;
    timesteps: number[];
    preloadBehavior?: boolean;
    concurrency?: number;
    signal?: AbortSignal;
    onProgress?: (progress: number, metrics?: { bps: number }) => void;
    /**
     * Límite de frames a precargar. Si no se especifica, precarga todos.
     * Útil para simulaciones grandes para evitar consumo excesivo de RAM.
     */
    maxFramesToPreload?: number;
    /**
     * Frame actual para precargar frames cercanos(+-maxFramesToPreload/2)
     */
    currentFrameIndex?: number;
};

export const buildGlbUrl = (
    trajectoryId: string,
    timestep: number,
    analysisId: string,
    type: string = '',
    cacheBuster?: number
): string => {
    const baseUrl = `/trajectories/${trajectoryId}/glb/${timestep}/${analysisId}`;
    const typeParam = type ? `type=${type}` : '';
    const cacheParam = cacheBuster ? `t=${cacheBuster}` : '';
    const params = [typeParam, cacheParam].filter(Boolean).join('&');
    return params ? `${baseUrl}?${params}` : baseUrl;
};

export const createTrajectoryGLBs = (
    trajectoryId: string,
    timestep: number,
    analysisId: string,
    cacheBuster?: number
): TrajectoryGLBs => ({
    trajectory: buildGlbUrl(trajectoryId, timestep, analysisId, '', cacheBuster),
    defect_mesh: buildGlbUrl(trajectoryId, timestep, analysisId, 'defect_mesh', cacheBuster),
    interface_mesh: buildGlbUrl(trajectoryId, timestep, analysisId, 'interface_mesh', cacheBuster),
    atoms_colored_by_type: buildGlbUrl(trajectoryId, timestep, analysisId, 'atoms_colored_by_type', cacheBuster),
    dislocations: buildGlbUrl(trajectoryId, timestep, analysisId, 'dislocations', cacheBuster),
    core_atoms: '',
});

const resolveGlbUrl = (trajectoryId: string, timestep: number, analysisId: string): string => {
    const res = createTrajectoryGLBs(trajectoryId, timestep, analysisId);
    if(typeof res === 'string') return res as unknown as string;
    if(res && typeof res.trajectory === 'string') return res.trajectory;
    throw new Error('Invalid GLB URL');
};

export const fetchModels = async(params: LoadModelsParams): Promise<TimelineGLBMap> =>{
    const {
        trajectoryId,
        analysisId,
        timesteps,
        preloadBehavior = true,
        concurrency = 3,
        signal,
        onProgress,
        maxFramesToPreload,
        currentFrameIndex
    } = params;

    const unique = Array.from(new Set(timesteps)).sort((a, b) => a - b);

    // Determinar qué frames precargar
    let framesToPreload = unique;

    if(maxFramesToPreload && maxFramesToPreload > 0 && currentFrameIndex !== undefined){
        // Precargar solo frames cercanos al actual
        const halfWindow = Math.floor(maxFramesToPreload / 2);
        const startIdx = Math.max(0, currentFrameIndex - halfWindow);
        const endIdx = Math.min(unique.length, currentFrameIndex + halfWindow + 1);
        framesToPreload = unique.slice(startIdx, endIdx);

        console.log(`[fetchModels] Smart preload: Loading ${framesToPreload.length}/${unique.length} frames(window: ${halfWindow} frames around index ${currentFrameIndex})`);
    }else if(unique.length > 50){
        // Advertencia si se van a precargar muchos frames
        console.warn(`[fetchModels] WARNING: Preloading ${unique.length} frames. This may consume significant memory. Consider using maxFramesToPreload parameter.`);
    }

    const urlsByTs: TimelineGLBMap = {};
    for(const ts of unique){
        urlsByTs[ts] = resolveGlbUrl(trajectoryId, ts, analysisId);
    }

    if(!preloadBehavior || framesToPreload.length === 0){
        onProgress?.(0, { bps: 0 });
        return urlsByTs;
    }

    const endpoint = (u: string) => `${import.meta.env.VITE_API_URL}/api${u}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const totalFiles = framesToPreload.length;
    let completedFiles = 0;
    const partials = new Map<number, number>();

    let totalLoaded = 0;
    let speedBps = 0;
    let lastSampleTime = performance.now();
    let lastSampleBytes = 0;

    const emitProgress = () =>{
        const now = performance.now();
        const dt = Math.max(1, now - lastSampleTime);
        const dBytes = totalLoaded - lastSampleBytes;
        const inst = dBytes * (1000 / dt);
        speedBps = speedBps === 0 ? inst : speedBps * 0.8 + inst * 0.2;
        lastSampleTime = now;
        lastSampleBytes = totalLoaded;
        let partialSum = 0;
        partials.forEach((v) => (partialSum += v));
        const p = Math.min(0.999, (completedFiles + partialSum) / totalFiles);
        onProgress?.(p, { bps: speedBps });
    };

    const queue = [...framesToPreload];
    const workers = Array.from({ length: Math.min(concurrency, framesToPreload.length) }, () => (async() => {
        while(queue.length){
            if(signal?.aborted) return;
            const ts = queue.shift() as number;
            const url = urlsByTs[ts];
            const res = await fetch(endpoint(url), {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                cache: 'default',
                method: 'GET'
            });
            const len = parseInt(res.headers.get('content-length') || '0', 10);
            const reader = res.body?.getReader();
            const start = performance.now();
            let loadedThis = 0;
            if(!reader){
                completedFiles++;
                partials.delete(ts);
                emitProgress();
                continue;
            }while(true){
                const { done, value } = await reader.read();
                if(done) break;
                if(value && value.byteLength){
                    loadedThis += value.byteLength;
                    totalLoaded += value.byteLength;
                    if(len > 0){
                        const frac = Math.min(0.95, loadedThis / len * 0.95);
                        partials.set(ts, frac);
                    }else{
                        const t = performance.now() - start;
                        const frac = Math.min(0.9, 1 - Math.exp(-t / 900));
                        partials.set(ts, frac);
                    }
                    emitProgress();
                }
            }
            completedFiles++;
            partials.delete(ts);
            emitProgress();
        }
    })());

    await Promise.all(workers);

    onProgress?.(1, { bps: 0 });

    return urlsByTs;
};

export const getOptimizedMaterial = (
    baseMaterial: THREE.Material,
    clippingPlanes: THREE.Plane[]
): THREE.MeshStandardMaterial => {
    const key = `${baseMaterial.uuid}-${clippingPlanes.length}`;
    if(cache.has(key)) {
        const cached = cache.get(key)!;
        // @ts-ignore
        cached.clippingPlanes = clippingPlanes;
        return cached;
    }

    if(baseMaterial instanceof THREE.MeshStandardMaterial){
        baseMaterial = new THREE.MeshStandardMaterial({
            color: baseMaterial.color,
            map: baseMaterial.map,
            normalMap: baseMaterial.normalMap,
            roughnessMap: baseMaterial.roughnessMap,
            metalnessMap: baseMaterial.metalnessMap,
            emissiveMap: baseMaterial.emissiveMap,
            emissive: baseMaterial.emissive,
            roughness: baseMaterial.roughness,
            metalness: baseMaterial.metalness,
            opacity: baseMaterial.opacity,
            vertexColors: baseMaterial.vertexColors,
            clipShadows: true,
            transparent: false,
            alphaTest: 0.1,
            side: THREE.FrontSide,
            depthWrite: true,
            depthTest: true,
        });
    }else if(baseMaterial instanceof THREE.MeshBasicMaterial){
        baseMaterial = new THREE.MeshStandardMaterial({
            color: baseMaterial.color,
            map: baseMaterial.map,
            opacity: baseMaterial.opacity,
            vertexColors: baseMaterial.vertexColors,
            clipShadows: true,
            transparent: false,
            alphaTest: 0.1,
            side: THREE.FrontSide,
            depthWrite: true,
            depthTest: true,
        });
    }else{
        baseMaterial = baseMaterial.clone();
    }

    // @ts-ignore
    if(clippingPlanes.length > 0) baseMaterial.clippingPlanes = clippingPlanes;
    // @ts-ignore(baseMaterial as any).clipIntersection = true;
    // @ts-ignore
    baseMaterial.precision = 'highp';
    // @ts-ignore
    baseMaterial.fog = false;
    // @ts-ignore
    baseMaterial.userData.isOptimized = true;
    // @ts-ignore
    return baseMaterial;
};

export const calculateModelBounds = (glb: any) => {
    const box = new Box3().setFromObject(glb.scene);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);

    const boundingSphere = new Sphere();
    box.getBoundingSphere(boundingSphere);

    return {
        box,
        size,
        center,
        boundingSphere,
        maxDimension: Math.max(size.x, size.y, size.z),
    };
};

export const calculateOptimalTransforms = (bounds: ReturnType<typeof calculateModelBounds>) => {
    const { size, center, maxDimension } = bounds;
    const targetSize = 8;
    const scale = maxDimension > 0 ? targetSize / maxDimension : 1;

    const shouldRotate = size.y > size.z * 1.2 || size.z < Math.min(size.x, size.y) * 0.8;
    const rotation = shouldRotate ? { x: Math.PI / 2, y: 0, z: 0 } : { x: 0, y: 0, z: 0 };

    const position = {
        x: -center.x * scale,
        y: -center.y * scale,
        z: -center.z * scale,
    };

    return { position, rotation, scale };
};

export const calculateClosestCameraPositionZY = (modelBounds: Box3, camera: any) => {
    const center = modelBounds.getCenter(new THREE.Vector3());
    const size = modelBounds.getSize(new THREE.Vector3());

    const viewHeight = size.z;
    const viewWidth = size.y;
    const fovRad = THREE.MathUtils.degToRad(camera.fov);

    let distByHeight = (viewHeight / 2) / Math.tan(fovRad / 2);
    let distByWidth = (viewWidth / 2) / (Math.tan(fovRad / 2) * camera.aspect);

    let distance = Math.max(distByHeight, distByWidth);
    distance *= 1.01;

    return {
        position: new THREE.Vector3(center.x + distance, center.y, center.z),
        target: center.clone(),
        up: new THREE.Vector3(0, 0, 1)
    };
};
