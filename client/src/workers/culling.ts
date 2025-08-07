// TODO: duplicated code, maybe receive it as message data
const GLB_CONSTANTS = {
    DEFAULT_POSITION: Object.freeze({ x: 0, y: 0, z: 0 }),
    DEFAULT_ROTATION: Object.freeze({ x: 0, y: 0, z: 0 }),
    LOD_LEVELS: [1, 0.7, 0.4, 0.15],
    MAX_VISIBLE_INSTANCES: 100000,
    FRUSTUM_CULL_DISTANCE: 50,
    CULL_FRAME_INTERVAL: 5,
    POOL_SIZE: 500,
    MIN_CAMERA_MOVEMENT: 1,
} as const;

interface AtomWorkerData {
    position: [number, number, number];
    color: [number, number, number];
    size: number;
}

interface WorkerMessage {
    type: 'init' | 'updateCamera' | 'cull';
    data: any;
}

let atoms: AtomWorkerData[] = [];
let cameraPosition: [number, number, number] = [0, 0, 0];
let lastDistance = 0;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { type, data } = e.data;

    switch(type){
        case 'init':
            atoms = data.atoms;
            break;

        case 'updateCamera':
            cameraPosition = data.position;
            break;

        case 'cull':
            const visible = new Set<number>();
            const distance = Math.sqrt(
                cameraPosition[0] * cameraPosition[0] +
                cameraPosition[1] * cameraPosition[1] +
                cameraPosition[2] * cameraPosition[2]
            );

            if(Math.abs(distance - lastDistance) < GLB_CONSTANTS.MIN_CAMERA_MOVEMENT){
                return;
            }

            lastDistance = distance;

            const lodLevel = distance > 30 ? 0.15 : distance > 20 ? 0.4 : distance > 10 ? 0.7 : 1;
            const maxDistance = GLB_CONSTANTS.FRUSTUM_CULL_DISTANCE;
            const step = Math.max(1, Math.ceil(1 / lodLevel));

            for(let i = 0; i < atoms.length; i += step){
                const atom = atoms[i];
                if(!atom) continue;
                
                const dx = atom.position[0] - cameraPosition[0];
                const dy = atom.position[1] - cameraPosition[1];
                const dz = atom.position[2] - cameraPosition[2];
                const atomDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if(atomDistance < maxDistance){
                    visible.add(i);
                }
            }

            self.postMessage({
                type: 'cullResult',
                visible: Array.from(visible),
                lodLevel: lodLevel
            });

            break;
    }
};