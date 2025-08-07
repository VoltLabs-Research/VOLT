import { Camera, Vector3 } from 'three';
import { GLB_CONSTANTS } from '@/utilities/glb/loader';

class CullingService{
    private worker: Worker | null = null;
    private lastCameraPosition = new Vector3();
    private visibleIndices = new Set<number>();

    constructor(private onCullResult: (visible: Set<number>, lodLevel: number) => void){
        this.initializeWorker();
    }

    private initializeWorker(): void{
        try{
            this.worker = new Worker(new URL('@/workers/cullingWorker.ts', import.meta.url));
            
            this.worker.onmessage = (e) => {
                if(e.data.type === 'cullResult'){
                    this.visibleIndices.clear();
                    e.data.visible.forEach((index: number) => {
                        this.visibleIndices.add(index);
                    });
                    this.onCullResult(this.visibleIndices, e.data.lodLevel);
                }
            };
    }catch(error){
            console.warn('Worker creation failed, using main thread culling');
            this.worker = null;
        }
    }

    initializeAtoms(atoms: any[]): void{
        if(this.worker){
            this.worker.postMessage({
                type: 'init',
                data: {
                atoms: atoms.map(a => ({
                    position: [a.position.x, a.position.y, a.position.z],
                    color: [a.color.r, a.color.g, a.color.b],
                    size: a.size,
                }))},
            });
        }
    }

    performCulling(camera: Camera, atoms: any[]): void{
        const cameraPos = camera.position;
        const deltaDistance = cameraPos.distanceTo(this.lastCameraPosition);

        if(deltaDistance < GLB_CONSTANTS.MIN_CAMERA_MOVEMENT) return;
        if(this.worker){
            this.worker.postMessage({
                type: 'updateCamera',
                data: { position: [cameraPos.x, cameraPos.y, cameraPos.z] },
            });
            this.worker.postMessage({ type: 'cull', data: {} });
        }else{
            this.performMainThreadCulling(camera, atoms);
        }

        this.lastCameraPosition.copy(cameraPos);
    }

    private performMainThreadCulling(camera: Camera, atoms: any[]): void{
        const cameraPos = camera.position;
        this.visibleIndices.clear();

        const globalDistance = cameraPos.length();
        const lodLevel = globalDistance > 30 ? 0.15 : globalDistance > 20 ? 0.4 : globalDistance > 10 ? 0.7 : 1;
        const step = Math.max(1, Math.ceil(1 / lodLevel));
        const maxDistanceSq = GLB_CONSTANTS.FRUSTUM_CULL_DISTANCE * GLB_CONSTANTS.FRUSTUM_CULL_DISTANCE;

        atoms.forEach((atom, index) => {
            if(index % step != 0) return;
            const dx = atom.position.x - cameraPos.x;
            const dy = atom.position.y - cameraPos.y;
            const dz = atom.position.z - cameraPos.z;
            if((dx * dx + dy * dy + dz * dz) < maxDistanceSq){
                this.visibleIndices.add(index);
            }
        });

        this.onCullResult(this.visibleIndices, lodLevel);
    }

    getVisibleIndices(): Set<number>{
        return this.visibleIndices;
    }

    terminate(): void{
        if(this.worker){
            this.worker.terminate();
            this.worker = null;
        }
    }
};

export default CullingService;
