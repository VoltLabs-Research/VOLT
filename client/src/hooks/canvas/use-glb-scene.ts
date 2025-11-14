/**
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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
 **/
import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { GLB_CONSTANTS, loadGLB } from '@/utilities/glb/loader';
import { calculateModelBounds, calculateOptimalTransforms } from '@/utilities/glb/modelUtils';
import { ANIMATION_CONSTANTS } from '@/utilities/glb/simulation-box';
import type { SceneState } from '@/types/scene';
import { makeSelectionGroup, updateSelectionGeometry } from '@/utilities/glb/selection';
import { ensureSimulationBox, runSizeAnimationStep, startSizeAnimAfterRotation } from '@/utilities/glb/simulation-box';
import { configurePointCloudMaterial, configureGeometry, isPointCloudObject } from '@/utilities/glb/materials';
import { attachPointerEvents, attachKeyboard } from '@/utilities/glb/interaction';
import useThrottledCallback from '@/hooks/ui/use-throttled-callback';
import useLogger from '@/hooks/core/use-logger';
import {
    Group,
    Box3,
    Vector3,
    Points,
    ShaderMaterial,
    Plane,
    Raycaster,
    EdgesGeometry,
    Euler,
    MeshBasicMaterial,
    Material,
    WebGLRenderer,
    Scene,
    Camera
} from 'three';
import useModelStore from '@/stores/editor/model'

type UseGlbSceneParams = {
    sliceClippingPlanes: Plane[];
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
    enableInstancing?: boolean;
    updateThrottle: number;
    useFixedReference?: boolean;
    referencePoint?: 'origin' | 'initial' | 'custom';
    customReference?: { x: number; y: number; z: number }; 
    preserveInitialTransform?: boolean; 
};

interface ExtendedSceneState extends SceneState{
    referenceScaleFactor?: number;
    fixedReferencePoint?: Vector3 | null;
    useFixedReference?: boolean;
    initialTransform?: { position: Vector3; rotation: Euler; scale: number } | null;
    failedUrls?: Set<string>;
    isLoadingUrl?: boolean;
};

class ClippingManager{
    constructor(
        private gl: WebGLRenderer | null,
        private invalidate: () => void
    ){}

    applyToMaterial(material: Material, planes: Plane[]){
        if(material instanceof ShaderMaterial){
            if(this.gl){
                this.gl.localClippingEnabled = planes.length > 0;
            }

            material.clipping = planes.length > 0;
            material.clippingPlanes = planes.length > 0 ? planes : null;
            material.needsUpdate = true;

            if(material.uniforms && material.uniforms.clippingPlanes){
                material.uniforms.clippingPlanes.value = planes;
                material.uniformsNeedUpdate = true;
            }
        }else if('clippingPlanes' in (material as any)){
            material.clippingPlanes = planes;
            material.needsUpdate = true;
        }
    }
    
    applyToModel(root: Group | null, planes: Plane[]){
        if(!root) return;
        if(this.gl){
            this.gl.localClippingEnabled = planes.length > 0;
        }

        root.traverse((obj: any) => {
            if(!obj.material) return;

            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((material: Material) => {
                this.applyToMaterial(material, planes);
                
                if(obj instanceof Points && material instanceof ShaderMaterial){
                    material.needsUpdate = true;
                    obj.geometry.attributes.position.needsUpdate = true;
                }
            });
        });

        this.invalidate();
    }

    setLocalClippingEnabled(enabled: boolean): void{
        if(this.gl){
            this.gl.localClippingEnabled = enabled;
        }
    }
};

class AnimationController{
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private camera: Camera,
        private invalidate: () => void
    ){}

    update(): void{
        const now = Date.now();

        this.updateCameraUniforms();
        this.updateSimulationBox();
        this.updateDrag();
        this.updateRotation(now);
        this.updateScale();
        this.updateSizeAnimation(now);
        this.updateSelection(now);
    }

    private updateCameraUniforms(): void{
        const { mesh } = this.state;
        if(mesh && mesh instanceof Points && mesh.material instanceof ShaderMaterial){
            if(mesh.material.uniforms?.cameraPosition){
                mesh.material.uniforms.cameraPosition.value.copy(this.camera.position);
            }
        }
    }

    private updateSimulationBox(): void{
        if(!this.state.model) return;
        
        // simbox centered to model
        const worldBox = new Box3().setFromObject(this.state.model);
        const center = new Vector3();
        worldBox.getCenter(center);

        ensureSimulationBox(this.state, this.scene, worldBox);
        if(this.state.simBoxMesh){
            this.state.simBoxMesh.position.copy(center);
        }
    }

    private updateDrag(): void{
        if(this.state.selected && this.state.targetPosition){
            this.state.targetPosition.z = Math.max(0, this.state.targetPosition.z);
            this.state.selected.position.lerp(
                this.state.targetPosition,
                ANIMATION_CONSTANTS.POSITION_LERP_SPEED
            );

            this.invalidate();
        }
    }

    private updateRotation(now: number): void{
        if(!this.state.selected || !this.state.targetRotation) return;

        const f = ANIMATION_CONSTANTS.ROTATION_LERP_SPEED;
        this.state.currentRotation.x += (this.state.targetRotation.x - this.state.currentRotation.x) * f;
        this.state.currentRotation.y += (this.state.targetRotation.y - this.state.currentRotation.y) * f;
        this.state.currentRotation.z += (this.state.targetRotation.z - this.state.currentRotation.z) * f;
        this.state.selected.rotation.copy(this.state.currentRotation);
        this.invalidate();

        const dx = Math.abs(this.state.targetRotation.x - this.state.currentRotation.x);
        const dy = Math.abs(this.state.targetRotation.y - this.state.currentRotation.y);
        const dz = Math.abs(this.state.targetRotation.z - this.state.currentRotation.z);
        const rotatingNow = dx + dy + dz > ANIMATION_CONSTANTS.ROT_EPS;

        if(rotatingNow){
            this.handleActiveRotation();
            this.state.isRotating = true;
            this.state.lastRotationActiveMs = now;
        }else{
            this.handleRotationSettle(now);
        }
    }

    private handleActiveRotation(): void{
        if(this.state.isRotating) return;
        
        if(this.state.selection){
            const baseGeo = this.state.selection.base.geometry as EdgesGeometry;
            baseGeo.computeBoundingBox();
            const curBB = baseGeo.boundingBox!;
            const curSize= new Vector3();
            curBB.getSize(curSize);
            this.state.rotationFreezeSize = curSize.clone();
        }

        if(this.state.sizeAnimActive){
            this.state.sizeAnimActive = false;

            if(this.state.sizeAnimTo && this.state.selection){
                updateSelectionGeometry(
                    this.state.selection,
                    this.state.sizeAnimTo.clone(),
                    this.state.isHovered && !this.state.isSelectedPersistent
                );
            }

            if(this.state.sizeAnimTo &&
                    this.state.simBoxMesh &&
                    this.state.simBoxBaseSize){
                const target = this.state.sizeAnimTo;
                const base = this.state.simBoxBaseSize;
                this.state.simBoxMesh.scale.set(
                    target.x / base.x,
                    target.y / base.y,
                    target.z / base.z
                );
                this.state.simBoxSize = target.clone();
            }
        }
    }

    private handleRotationSettle(now: number){
        if(this.state.isRotating &&
                now - this.state.lastRotationActiveMs >= ANIMATION_CONSTANTS.ROTATION_SETTLE_MS){
            this.state.isRotating = false;
            startSizeAnimAfterRotation(this.state, this.scene, now);
        }
    }

    private updateScale(): void{
        if(!this.state.selected) return;

        if(Math.abs(this.state.targetScale - this.state.currentScale) > 1e-3){
            const newScale = this.state.currentScale +
                (this.state.targetScale - this.state.currentScale) * ANIMATION_CONSTANTS.SCALE_LERP_SPEED;
            this.state.selected.scale.setScalar(newScale);
            this.state.currentScale = newScale;
            this.invalidate();
        }
    }

    private updateSizeAnimation(now: number): void{
        if(runSizeAnimationStep(this.state, now)){
            this.invalidate();
        }
    }

    private updateSelection(now: number): void{
        if(!this.state.selection || !this.state.model) return;

        const hover = this.state.isHovered && !this.state.isSelectedPersistent;
        const box = new Box3().setFromObject(this.state.model);
        const center = new Vector3();
        box.getCenter(center);
        this.state.selection.group.position.lerp(center, ANIMATION_CONSTANTS.SELECTION_LERP_SPEED);

        const timeSince = (now - this.state.lastInteractionTime) / 1000;
        const pulseI = Math.max(0, 1 - timeSince * 0.5);
        const pulse = 0.7 + 0.3 * Math.sin(now * ANIMATION_CONSTANTS.PULSE_SPEED) * pulseI;

        const material = this.state.selection.base.material as MeshBasicMaterial;
        material.opacity = (hover ? 0.9 : 0.75) * (0.9 + 0.1 * pulse);

        const target = this.state.showSelection || this.state.isHovered ? 1 : 0.001;
        const curScale = this.state.selection.group.scale.x || 1;
        const next = curScale + (target - curScale) * ANIMATION_CONSTANTS.SELECTION_LERP_SPEED;
        this.state.selection.group.scale.setScalar(next);

        if(!this.state.showSelection && !this.state.isHovered && next < 0.01){
            this.scene.remove(this.state.selection.group);
            this.state.selection = null;
        }

        this.invalidate();
    }
};

class TransformationManager{
    constructor(
        private state: ExtendedSceneState
    ){}

    rotate(dx: number, dy: number, dz: number): void{
        if(!this.state.selected) return;

        const r = this.state.currentRotation.clone();
        r.x += dx;
        r.y += dy;
        r.z += dz;

        this.state.targetRotation = r;
        this.state.lastInteractionTime = Date.now();
    }

    scale(delta: number): void{
        if(!this.state.selected) return;

        const newScale = Math.max(
            ANIMATION_CONSTANTS.MIN_SCALE,
            Math.min(ANIMATION_CONSTANTS.MAX_SCALE, this.state.targetScale + delta)
        );

        this.state.targetScale = newScale;
        this.state.lastInteractionTime = Date.now();
    }

    adjustToGround(model: Group): void{
        model.updateMatrixWorld(true);
        const box = new Box3().setFromObject(model);
        const minZ = box.min.z;
        if(minZ !== 0){
            model.position.z -= minZ;
            model.updateMatrixWorld(true);
        }
    }

    reset(): void{
        if(!this.state.selected) return;
        this.state.targetRotation = new Euler(0, 0, 0);
        this.state.targetScale = 1;
        this.state.lastInteractionTime = Date.now();

        const bounds = this.state.modelBounds;
        if(bounds){
            const center = new Vector3();
            bounds.box.getCenter(center);
            this.state.targetPosition = new Vector3(0, 0, Math.max(0, center.z));
        }
    }
};

class SelectionManager{
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private invalidate: () => void
    ){}
    
    createSelectionGroup(hover = false): Group{
        const selection = makeSelectionGroup();
        
        if(this.state.selection){
            this.scene.remove(this.state.selection.group);
        }

        this.scene.add(selection.group);
        this.state.selection = selection;
        this.state.showSelection = true;
        this.state.lastInteractionTime = Date.now();

        if(!this.state.model) return selection.group;

        const box = new Box3().setFromObject(this.state.model);
        const size = new Vector3();
        const center = new Vector3();

        box.getSize(size).multiplyScalar(
            hover ? ANIMATION_CONSTANTS.HOVER_BOX_PADDING : ANIMATION_CONSTANTS.SELECTION_BOX_PADDING);
        box.getCenter(center);

        selection.group.position.copy(center);
        updateSelectionGeometry(selection, size, hover);

        return selection.group;
    }

    show(hover = false): void{
        if(!this.state.model) return;
        this.createSelectionGroup(hover);
    }

    hide(): void{
        this.state.showSelection = false;
        if(this.state.selection){
            this.scene.remove(this.state.selection.group);
            this.state.selection = null;
        }
    }

    deselect(): void{
        this.state.isSelectedPersistent = false;
        this.state.selected = null;
        this.hide();
        this.invalidate();
    }

    isSelected(): boolean{
        return this.state.isSelectedPersistent;
    }

    isHovered(): boolean{
        return this.state.isHovered;
    }
};

class InteractionController{
    constructor(
        private state: ExtendedSceneState,
        private camera: Camera,
        private scene: Scene,
        private gl: WebGLRenderer,
        private raycaster: Raycaster,
        private groundPlane: Plane,
        private selectionManager: SelectionManager,
        private transformManager: TransformationManager,

        private detachPointer?: () => void,
        private detachKeyboard?: () => void
    ){}

    attach(): void{
        if(!this.gl.domElement) return;

        this.detachPointer = attachPointerEvents({
            glCanvas: this.gl.domElement,
            camera: this.camera,
            scene: this.scene,
            raycaster: this.raycaster,
            groundPlane: this.groundPlane,
            state: this.state,
            showSelectionBox: (hover) => this.selectionManager.show(!!hover),
            hideSelectionBox: () => this.selectionManager.hide(),
            deselect: () => this.selectionManager.deselect()
        });

        this.detachKeyboard = attachKeyboard({
            state: this.state,
            rotateModel: (dx, dy, dz) => this.transformManager.rotate(dx, dy, dz),
            scaleModel: (delta) => this.transformManager.scale(delta),
            deselect: () => this.selectionManager.deselect()
        });
    }

    detach(): void{
        this.detachPointer?.();
        this.detachKeyboard?.();
    }
};

class ResourceManager{
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private invalidate: () => void
    ){}

    cleanup(): void{
        this.cleanupModels();
        this.cleanupSelection();
        this.cleanupSimulationBox();
        this.resetState();
        this.invalidate();
    }

    private cleanupModels(): void{
        this.scene.children.forEach((child: any) => {
            if(child.userData?.glbUrl && child instanceof Group){
                this.scene.remove(child);
            }
        });
    }

    private cleanupSelection(): void{
        if(this.state.selection){
            this.scene.remove(this.state.selection.group)
            this.state.selection = null;
        }
    }

    private cleanupSimulationBox(): void{
        if(this.state.simBoxMesh){
            this.scene.remove(this.state.simBoxMesh);
            this.state.simBoxMesh.geometry.dispose();
            (this.state.simBoxMesh.material as MeshBasicMaterial).dispose();
            this.state.simBoxMesh = null;
            this.state.simBoxSize = null;
            this.state.simBoxBaseSize = null;
        }
    }

    private resetState(): void{
        this.state.model = null;
        this.state.mesh = null;
        this.state.isSetup = false;
        this.state.selected = null;
        this.state.isSelectedPersistent = false;
        this.state.isRotating = false;
        this.state.rotationFreezeSize = null;
        this.state.sizeAnimActive = false;
        this.state.referenceScaleFactor = undefined;
        this.state.fixedReferencePoint = null;
        this.state.useFixedReference = false;
        this.state.initialTransform = null;
    }
};

class ModelSetupManager{
    constructor(
        private state: ExtendedSceneState,
        private params: UseGlbSceneParams,
        private clippingManager: ClippingManager,
        private referenceManager: ReferencePointManager,
        private transformManager: TransformationManager,
        private setModelBounds: (bounds: any) => void,
        private invalidate: () => void,
    ){}

    setup(model: Group): Group{
        if(this.state.isSetup) return model;

        const bounds = calculateModelBounds({ scene: model });
        this.state.modelBounds = bounds;

        this.setupMaterials(model);
        this.clippingManager.applyToModel(model, this.params.sliceClippingPlanes);
        this.applyTransforms(model, bounds);
        this.transformManager.adjustToGround(model);

        model.updateMatrixWorld(true);
        const finalBounds = calculateModelBounds({ scene: model });
        this.setModelBounds(finalBounds);
        this.invalidate();
        this.state.isSetup = true;

        return model;
    }

    private setupMaterials(model: Group): void{
        const pointCloud = isPointCloudObject(model);

        if(pointCloud){
            configurePointCloudMaterial(pointCloud);
            this.state.mesh = pointCloud;
        }else{
            configureGeometry(
                model,
                this.params.sliceClippingPlanes,
                (mesh) => (this.state.mesh = mesh)
            );
        }
    }

    private applyTransforms(model: Group, bounds: any): void{
        const { position, rotation, scale } = this.params;

        if(!this.params.useFixedReference){
            this.applyNormalTransforms(model, bounds, position, rotation, scale);
        }else{
            this.applyFixedReferenceTransforms(model, bounds, position, rotation, scale);
        }

        this.state.currentRotation.copy(model.rotation);
        this.state.targetScale = model.scale.x;
        this.state.currentScale = model.scale.x;
    }

    private applyNormalTransforms(
        model: Group,
        bounds: any,
        position: any,
        rotation: any,
        scale: number
    ): void{
        const optimal = calculateOptimalTransforms(bounds);

        model.position.set(
            (position.x ?? GLB_CONSTANTS.DEFAULT_POSITION.x) + optimal.position.x,
            (position.y ?? GLB_CONSTANTS.DEFAULT_POSITION.y) + optimal.position.y,
            (position.z ?? GLB_CONSTANTS.DEFAULT_POSITION.z) + optimal.position.z
        );

        model.rotation.set(
            (rotation.x ?? GLB_CONSTANTS.DEFAULT_ROTATION.x) + optimal.rotation.x,
            (rotation.y ?? GLB_CONSTANTS.DEFAULT_ROTATION.y) + optimal.rotation.y,
            (rotation.z ?? GLB_CONSTANTS.DEFAULT_ROTATION.z) + optimal.rotation.z
        );

        const finalScale = scale * optimal.scale;
        model.scale.setScalar(finalScale);
    }

    private applyFixedReferenceTransforms(
        model: Group,
        bounds: any,
        position: any,
        rotation: any,
        scale: number
    ): void{
        if(this.state.referenceScaleFactor == null){
            const { scale: scaleRef } = calculateOptimalTransforms(bounds);
            this.state.referenceScaleFactor = scaleRef;
        }

        const finalScale = scale * (this.state.referenceScaleFactor || 1);
        model.scale.setScalar(finalScale);

        model.position.set(
            position.x ?? GLB_CONSTANTS.DEFAULT_POSITION.x,
            position.y ?? GLB_CONSTANTS.DEFAULT_POSITION.y,
            position.z ?? GLB_CONSTANTS.DEFAULT_POSITION.z
        );

        model.rotation.set(
            rotation.x ?? GLB_CONSTANTS.DEFAULT_ROTATION.x,
            rotation.y ?? GLB_CONSTANTS.DEFAULT_ROTATION.y,
            rotation.z ?? GLB_CONSTANTS.DEFAULT_ROTATION.z
        );
        
        if(!this.state.useFixedReference){
            this.referenceManager.setFixedReference(
                model,
                this.params.referencePoint,
                this.params.customReference 
                    ? new Vector3(
                        this.params.customReference.x,
                        this.params.customReference.y,
                        this.params.customReference.z
                    ) : undefined
            );
            this.state.useFixedReference = true;
        }
    }
}

class ModelLoader{
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private resourceManager: ResourceManager,
        private modelSetupManager: ModelSetupManager,
        private setIsModelLoading: (loading: boolean) => void,
        private invalidate: () => void,
        private logger: any,
        private onLoadingStateChange: (state: any) => void
    ){}

    async load(url: string): Promise<void>{
        if(this.state.lastLoadedUrl === url || this.state.isLoadingUrl) return;
        
        this.state.isLoadingUrl = true;
        this.setIsModelLoading(true);
        this.onLoadingStateChange({ isLoading: true, progress: 0, error: null });

        try{
            const loadedModel = await loadGLB(url, (progress) => {
                this.onLoadingStateChange((prev: any) => ({
                    ...prev,
                    progress: Math.round(progress * 100)
                }));
            });

            this.resourceManager.cleanup();
            const newModel = this.modelSetupManager.setup(loadedModel);
            newModel.userData.glbUrl = url;
            this.scene.add(newModel);

            this.state.model = newModel;
            this.state.lastLoadedUrl = url;
            this.state.failedUrls?.delete(url);

            this.onLoadingStateChange({ isLoading: false, progress: 100, error: null });
        }catch(error: any){
            const message = error instanceof Error ? error.message : String(error);
            this.state.failedUrls?.add(url);
            this.onLoadingStateChange({ isLoading: false, progress: 0, error: message });
            this.logger.error('Model loading failed:', message);
        }finally{
            this.state.isLoadingUrl = false;
            this.setIsModelLoading(false);
            this.invalidate();
        }
    }

    isLoading(): boolean{
        return !!this.state.isLoadingUrl;
    }
};

class ReferencePointManager{
    constructor(
        private state: ExtendedSceneState
    ){}

    setFixedReference(
        model: Group,
        refType: 'origin' | 'initial' | 'custom' = 'initial',
        customPoint?: Vector3
    ): void{
        switch(refType){
            case 'origin':
                this.state.fixedReferencePoint = new Vector3(0, 0, 0);
                break;
            case 'custom':
                this.state.fixedReferencePoint = customPoint ? customPoint.clone() : new Vector3(0, 0, 0);
                break;
            case 'initial':
            default:
                const initialBox = new Box3().setFromObject(model);
                const center = new Vector3();
                initialBox.getCenter(center);
                this.state.fixedReferencePoint = center.clone();
                break;
        }

        this.state.initialTransform = {
            position: model.position.clone(),
            rotation: model.rotation.clone(),
            scale: model.scale.x
        };
    }

    getFixedReferencePoint(){
        return this.state.fixedReferencePoint;
    }

    hasFixedReference(): boolean{
        return !!this.state.useFixedReference;
    } 
};

export default function useGlbScene(params: UseGlbSceneParams){
    const { scene, camera, gl, invalidate } = useThree();
    const logger = useLogger('use-glb-scene');

    const activeModel = useModelStore((s) => s.activeModel);
    const setModelBounds = useModelStore((s) => s.setModelBounds);
    const setIsModelLoading = useModelStore((s) => s.setIsModelLoading);
    const activeScene = useModelStore((state) => state.activeScene);

    const stateRef = useRef<ExtendedSceneState>({
        model: null,
        mesh: null,
        isSetup: false,
        lastLoadedUrl: null,
        failedUrls: new Set<string>(),
        isLoadingUrl: false,
        dragging: false,
        selected: null,
        selection: null,
        isSelectedPersistent: false,
        targetPosition: null,
        showSelection: false,
        isHovered: false,
        targetRotation: null,
        currentRotation: new Euler(0, 0, 0),
        targetScale: 1,
        currentScale: 1,
        modelBounds: null,
        lastInteractionTime: 0,
        simBoxMesh: null,
        simBoxSize: null,
        simBoxBaseSize: null,
        isRotating: false,
        rotationFreezeSize: null,
        lastRotationActiveMs: 0,
        sizeAnimActive: false,
        sizeAnimFrom: null,
        sizeAnimTo: null,
        sizeAnimStartMs: 0,
        referenceScaleFactor: undefined,
        fixedReferencePoint: null,
        useFixedReference: false,
        initialTransform: null,
    });

    const [loadingState, setLoadingState] = useState({
        isLoading: false,
        progress: 0,
        error: null as null | string
    });

    const raycaster = useRef(new Raycaster()).current;
    const groundPlane = useRef(new Plane(new Vector3(0, 0, 1), 0));

    // Initialize managers
    const clippingManager = useRef(new ClippingManager(gl, invalidate)).current;
    const referenceManager = useRef(new ReferencePointManager(stateRef.current)).current;
    const selectionManager = useRef(new SelectionManager(stateRef.current, scene, invalidate)).current;
    const transformManager = useRef(new TransformationManager(stateRef.current)).current;
    const resourceManager = useRef(new ResourceManager(stateRef.current, scene, invalidate)).current;
    
    const modelSetupManager = useRef(
        new ModelSetupManager(
        stateRef.current,
        params,
        clippingManager,
        referenceManager,
        transformManager,
        setModelBounds,
        invalidate
        )
    ).current;

    const modelLoader = useRef(
        new ModelLoader(
        stateRef.current,
        scene,
        resourceManager,
        modelSetupManager,
        setIsModelLoading,
        invalidate,
        logger,
        setLoadingState
        )
    ).current;

    const animationController = useRef(
        new AnimationController(stateRef.current, scene, camera, invalidate)
    ).current;

    const interactionController = useRef(
        new InteractionController(
        stateRef.current,
        camera,
        scene,
        gl,
        raycaster,
        groundPlane.current,
        selectionManager,
        transformManager
        )
    ).current;

    // Interaction setup
    useEffect(() => {
        interactionController.attach();
        return () => interactionController.detach();
    }, [interactionController]);

    // Animation loop
    useFrame(() => {
        animationController.update();
    });

    // Clipping planes setup
    useEffect(() => {
        if(!gl) return;
        clippingManager.setLocalClippingEnabled((params.sliceClippingPlanes?.length ?? 0) > 0);
    }, [gl, params.sliceClippingPlanes, clippingManager]);

    useEffect(() => {
        if(!stateRef.current.isSetup || !stateRef.current.model) return;
        clippingManager.applyToModel(stateRef.current.model, params.sliceClippingPlanes);
        invalidate();
    }, [params.sliceClippingPlanes, invalidate, clippingManager]);

    // Model loading
    const getTargetUrl = useCallback((): string | null => {
        if(!activeModel?.glbs || !activeScene) return null;
        return activeModel.glbs[activeScene];
    }, [activeModel, activeScene]);

    const updateScene = useCallback(() => {
        const targetUrl = getTargetUrl();
        if(targetUrl &&
                targetUrl !== stateRef.current.lastLoadedUrl &&
                !modelLoader.isLoading()){
            modelLoader.load(targetUrl);
        }
    }, [getTargetUrl, modelLoader]);

    const throttledUpdateScene = useThrottledCallback(updateScene, params.updateThrottle);

    useEffect(() => {
        throttledUpdateScene();
    }, [throttledUpdateScene]);

    return {
        meshRef: { current: stateRef.current.mesh },
        modelBounds: activeModel?.modelBounds,
        isLoading: loadingState.isLoading,
        loadProgress: loadingState.progress,
        loadError: loadingState.error,
        isSelected: stateRef.current.isSelectedPersistent,
        isHovered: stateRef.current.isHovered,
        resetModel: useCallback(() => {
            transformManager.reset();
        }, [transformManager]),
        clearCache: useCallback(() => {
            resourceManager.cleanup();
        }, [resourceManager]),
        deselect: useCallback(() => {
            selectionManager.deselect();
        }, [selectionManager])
    };
}