import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { GLB_CONSTANTS, loadGLB, preloadGLBs } from '@/utilities/glb/loader';
import { calculateModelBounds, calculateOptimalTransforms } from '@/utilities/glb/modelUtils';
import { ANIMATION_CONSTANTS } from '@/utilities/glb/simulation-box';
import type { SceneState } from '@/types/scene';
import { makeSelectionGroup, updateSelectionGeometry } from '@/utilities/glb/selection';
import { ensureSimulationBox, runSizeAnimationStep, startSizeAnimAfterRotation } from '@/utilities/glb/simulation-box';
import { configurePointCloudMaterial, configureGeometry, isPointCloudObject } from '@/utilities/glb/materials';
import { attachPointerEvents, attachKeyboard } from '@/utilities/glb/interaction';
import useThrottledCallback from '@/hooks/ui/use-throttled-callback';
import useTimestepStore from '@/stores/editor/timesteps';
import useConfigurationStore from '@/stores/editor/configuration';
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
} from 'three';
import useModelStore from '@/stores/editor/model';

type UseGlbSceneParams = {
    sliceClippingPlanes: any;
    position: { x: number; y: number; z: number; };
    rotation: { x: number; y: number; z: number; };
    scale: number;
    enableInstancing?: boolean;
    updateThrottle: number;
};

export const useGlbScene = ({
    sliceClippingPlanes,
    position,
    rotation,
    scale,
    updateThrottle
}: UseGlbSceneParams) => {
    const { scene, camera, gl, invalidate } = useThree();
    const logger = useLogger('use-glb-scene');

    const activeModel = useModelStore((s) => s.activeModel);
	const setModelBounds = useModelStore((s) => s.setModelBounds);
    const setIsModelLoading = useModelStore((s) => s.setIsModelLoading);
    const activeScene = useModelStore((state) => state.activeScene);

    const stateRef = useRef<SceneState>({
        model: null,
        mesh: null,
        isSetup: false,
        lastLoadedUrl: null,

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
    });

    const [loadingState, setLoadingState] = useState({ isLoading: false, progress: 0, error: null as null | string });

    const raycaster = useRef(new Raycaster()).current;
    const groundPlane = useRef(new Plane(new Vector3(0, 0, 1), 0));

    const createSelectionGroup = useCallback((hover = false) => {
        const sel = makeSelectionGroup();
        if(stateRef.current.selection) scene.remove(stateRef.current.selection.group);
        scene.add(sel.group);
        stateRef.current.selection = sel;
        stateRef.current.showSelection = true;
        stateRef.current.lastInteractionTime = Date.now();

        const box = new Box3().setFromObject(stateRef.current.model!);
        const size = new Vector3();
        const center = new Vector3();
        box.getSize(size).multiplyScalar(hover ? ANIMATION_CONSTANTS.HOVER_BOX_PADDING : ANIMATION_CONSTANTS.SELECTION_BOX_PADDING);
        box.getCenter(center);
        sel.group.position.copy(center);
        updateSelectionGeometry(sel, size, hover);
        return sel.group;
    }, [scene]);

    const showSelectionBox = useCallback((hover = false) => {
        if(!stateRef.current.model) return;
        createSelectionGroup(hover);
    }, [createSelectionGroup]);

	const hideSelectionBox = useCallback(() => {
		stateRef.current.showSelection = false;
		if(stateRef.current.selection){
			scene.remove(stateRef.current.selection.group);
			stateRef.current.selection = null;
		}
	}, [scene]);

	const deselect = useCallback(() => {
		stateRef.current.isSelectedPersistent = false;
		stateRef.current.selected = null;
		hideSelectionBox();
		invalidate();
	}, [hideSelectionBox, invalidate]);

	const rotateModel = useCallback((dx: number, dy: number, dz: number) => {
		if(!stateRef.current.selected) return;
		const r = stateRef.current.currentRotation.clone();
		r.x += dx; 
		r.y += dy;
		r.z += dz;
		
		stateRef.current.targetRotation = r;
		stateRef.current.lastInteractionTime = Date.now();
	}, []);

	const scaleModel = useCallback((delta: number) => {
		if(!stateRef.current.selected) return;
		const s = Math.max(
			ANIMATION_CONSTANTS.MIN_SCALE,
			Math.min(ANIMATION_CONSTANTS.MAX_SCALE, stateRef.current.targetScale + delta)
		);
		stateRef.current.targetScale = s;
		stateRef.current.lastInteractionTime = Date.now();
	}, []);

	const adjustModelToGround = useCallback((model: Group) => {
		const finalBox = new Box3().setFromObject(model);
		const minZ = finalBox.min.z;
		if(minZ < 0) model.position.z += Math.abs(minZ);
	}, []);

	const setupModel = useCallback((model: Group) => {
		if(stateRef.current.isSetup) return model;

		const bounds = calculateModelBounds({ scene: model });
		// @ts-ignore
		stateRef.current.modelBounds = bounds;

		const pc = isPointCloudObject(model);
		if(pc){
			configurePointCloudMaterial(pc);
			stateRef.current.mesh = pc;
		}else{
			configureGeometry(model, sliceClippingPlanes, (m) => (stateRef.current.mesh = m));
		}

		const { position: p, rotation: r, scale: s } = calculateOptimalTransforms(bounds);

		model.position.set(
			(position.x ?? GLB_CONSTANTS.DEFAULT_POSITION.x) + p.x,
			(position.y ?? GLB_CONSTANTS.DEFAULT_POSITION.y) + p.y,
			(position.z ?? GLB_CONSTANTS.DEFAULT_POSITION.z) + p.z
		);

		model.rotation.set(
			(rotation.x ?? GLB_CONSTANTS.DEFAULT_ROTATION.x) + r.x,
			(rotation.y ?? GLB_CONSTANTS.DEFAULT_ROTATION.y) + r.y,
			(rotation.z ?? GLB_CONSTANTS.DEFAULT_ROTATION.z) + r.z
		);

		const finalScale = scale * s;
		model.scale.setScalar(finalScale);

		stateRef.current.currentRotation.copy(model.rotation);
		stateRef.current.targetScale = finalScale;
		stateRef.current.currentScale = finalScale;

		adjustModelToGround(model);
		model.updateMatrixWorld(true);
		const finalBounds = calculateModelBounds({ scene: model });
		setModelBounds(finalBounds);
		invalidate();
		stateRef.current.isSetup = true;

		return model;
	}, [position, rotation, scale, sliceClippingPlanes, adjustModelToGround, setModelBounds, invalidate]);

	const cleanupResources = useCallback(() => {
		scene.children.forEach((child: any) => {
			if(child.userData?.glbUrl && child instanceof Group){
				scene.remove(child);
			}
		});

		if(stateRef.current.selection){
			scene.remove(stateRef.current.selection.group);
			stateRef.current.selection = null;
		}

		if(stateRef.current.simBoxMesh){
			scene.remove(stateRef.current.simBoxMesh);
			stateRef.current.simBoxMesh.geometry.dispose();
			(stateRef.current.simBoxMesh.material as MeshBasicMaterial).dispose();
			stateRef.current.simBoxMesh = null;
			stateRef.current.simBoxSize = null;
			stateRef.current.simBoxBaseSize = null;
		}

		stateRef.current.model = null;
		stateRef.current.mesh = null;
		stateRef.current.isSetup = false;
		stateRef.current.selected = null;
		stateRef.current.isSelectedPersistent = false;
		stateRef.current.isRotating = false;
		stateRef.current.rotationFreezeSize = null;
		stateRef.current.sizeAnimActive = false;
		invalidate();
	}, [scene, invalidate]);

	const loadAndSetupModel = useCallback(async (url: string) => {
		if(stateRef.current.lastLoadedUrl === url || loadingState.isLoading) return;
		setIsModelLoading(true);
		setLoadingState({ isLoading: true, progress: 0, error: null });

		try{
			const loadedModel = await loadGLB(url, (progress) => {
				setLoadingState((prev) => ({ ...prev, progress: Math.round(progress * 100) }));
			});

			cleanupResources();
			const newModel = setupModel(loadedModel);
			newModel.userData.glbUrl = url;
			scene.add(newModel);
			stateRef.current.model = newModel;
			stateRef.current.lastLoadedUrl = url;
			//if(nextGlbUrl) preloadGLBs([nextGlbUrl?.[activeScene]]);
			setLoadingState({ isLoading: false, progress: 100, error: null });
		}catch(error: any){
			const message = error instanceof Error ? error.message : String(error);
			setLoadingState({ isLoading: false, progress: 0, error: null });
			logger.error('Model loading failed:', message);
		}finally{
			setIsModelLoading(false);
			invalidate();
		}
	}, [scene, activeScene]);

	const getTargetUrl = useCallback((): string | null => {
		if(!activeModel?.glbs || !activeScene) return null;
		return activeModel.glbs[activeScene];
	}, [activeModel, activeScene]);

	const updateScene = useCallback(() => {
		const targetUrl = getTargetUrl();
		if(targetUrl && targetUrl !== stateRef.current.lastLoadedUrl && !loadingState.isLoading){
			loadAndSetupModel(targetUrl);
		}
	}, [getTargetUrl, loadingState.isLoading, loadAndSetupModel]);

	const throttledUpdateScene = useThrottledCallback(updateScene, updateThrottle);
	useEffect(() => {
		throttledUpdateScene(); 
	}, [throttledUpdateScene]);

	useEffect(() => {
		if(!gl?.domElement) return;
		const detachPointer = attachPointerEvents({
			glCanvas: gl.domElement,
			camera,
			scene,
			raycaster,
			groundPlane: groundPlane.current,
			state: stateRef.current,
			showSelectionBox: (hover) => showSelectionBox(!!hover),
			hideSelectionBox,
			deselect
		});

		const detachKeyboard = attachKeyboard({
			state: stateRef.current,
			rotateModel,
			scaleModel,
			deselect
		});

		return () => {
			detachPointer?.();
			detachKeyboard?.();
		};
	}, [camera, gl, raycaster, showSelectionBox, hideSelectionBox, deselect, rotateModel, scaleModel]);

	useFrame(() => {
		const S = stateRef.current;
		const now = Date.now();
		
		if(S.mesh && 
			S.mesh instanceof Points && 
			S.mesh.material instanceof ShaderMaterial
		){
			S.mesh.material.uniforms.cameraPosition.value.copy(camera.position);
		}

		// simbox centered to model
		if (S.model) {
		const worldBox = new Box3().setFromObject(S.model);
		const center = new Vector3();
		worldBox.getCenter(center);
		ensureSimulationBox(S, scene, worldBox);
		if (S.simBoxMesh) S.simBoxMesh.position.copy(center);
		}

		// Drag
		if(S.selected && S.targetPosition){
			S.targetPosition.z = Math.max(0, S.targetPosition.z);
			S.selected.position.lerp(S.targetPosition, ANIMATION_CONSTANTS.POSITION_LERP_SPEED);
			invalidate();
		}

		// rotation + settle
		if(S.selected && S.targetRotation){
			const f = ANIMATION_CONSTANTS.ROTATION_LERP_SPEED;
			S.currentRotation.x += (S.targetRotation.x - S.currentRotation.x) * f;
			S.currentRotation.y += (S.targetRotation.y - S.currentRotation.y) * f;
			S.currentRotation.z += (S.targetRotation.z - S.currentRotation.z) * f;
			S.selected.rotation.copy(S.currentRotation);
			invalidate();

			const dx = Math.abs(S.targetRotation.x - S.currentRotation.x);
			const dy = Math.abs(S.targetRotation.y - S.currentRotation.y);
			const dz = Math.abs(S.targetRotation.z - S.currentRotation.z);
			const rotatingNow = (dx + dy + dz) > ANIMATION_CONSTANTS.ROT_EPS;

			if(rotatingNow){
				if(!S.isRotating){
					if(S.selection){
						const baseGeo = S.selection.base.geometry as EdgesGeometry;
						baseGeo.computeBoundingBox();
						const curBB = baseGeo.boundingBox!;
						const curSize = new Vector3();
						curBB.getSize(curSize);
						S.rotationFreezeSize = curSize.clone();
					}

					if(S.sizeAnimActive){
						S.sizeAnimActive = false;
						if(S.sizeAnimTo && S.selection){
							updateSelectionGeometry(S.selection, S.sizeAnimTo.clone(), S.isHovered && !S.isSelectedPersistent);
						}

						if(S.sizeAnimTo && S.simBoxMesh && S.simBoxBaseSize){
							const target = S.sizeAnimTo;
							const base = S.simBoxBaseSize;
							S.simBoxMesh.scale.set(target.x / base.x, target.y / base.y, target.z / base.z);
							S.simBoxSize = target.clone();
						}
					}
				}

				S.isRotating = true;
				S.lastRotationActiveMs = now;
			}else{
				if(S.isRotating && now - S.lastRotationActiveMs >= ANIMATION_CONSTANTS.ROTATION_SETTLE_MS) {
					S.isRotating = false;
					startSizeAnimAfterRotation(S, scene, now);
				}
			}
		}

		if(S.selected && Math.abs(S.targetScale - S.currentScale) > 1e-3){
			const newScale = S.currentScale + (S.targetScale - S.currentScale) * ANIMATION_CONSTANTS.SCALE_LERP_SPEED;
			S.selected.scale.setScalar(newScale);
			S.currentScale = newScale;
			invalidate();
		}

		if(runSizeAnimationStep(S, now)) invalidate();

		if(S.selection && S.model){
			const hover = S.isHovered && !S.isSelectedPersistent;

			const box = new Box3().setFromObject(S.model);
			const center = new Vector3();
			box.getCenter(center);
			S.selection.group.position.lerp(center, ANIMATION_CONSTANTS.SELECTION_LERP_SPEED);

			const timeSince = (now - S.lastInteractionTime) / 1000;
			const pulseI = Math.max(0, 1 - timeSince * 0.5);
			const pulse = 0.7 + 0.3 * Math.sin(now * ANIMATION_CONSTANTS.PULSE_SPEED) * pulseI;

			const mat = S.selection.base.material as MeshBasicMaterial;
			(mat as any).opacity = (hover ? 0.9 : 0.75) * (0.9 + 0.1 * pulse);

			const tgt = (S.showSelection || S.isHovered) ? 1 : 0.001;
			const curScale = S.selection.group.scale.x || 1;
			const next = curScale + (tgt - curScale) * ANIMATION_CONSTANTS.SELECTION_LERP_SPEED;
			S.selection.group.scale.setScalar(next);

			if(!S.showSelection && !S.isHovered && next < 0.01){
				scene.remove(S.selection.group);
				S.selection = null;
			}
			invalidate();
		}
	});

	const resetModel = useCallback(() => {
		if(!stateRef.current.selected) return;
		stateRef.current.targetRotation = new Euler(0, 0, 0);
		stateRef.current.targetScale = 1;
		stateRef.current.lastInteractionTime = Date.now();

		const bounds = stateRef.current.modelBounds;
		if(bounds){
			const center = new Vector3();
			// @ts-ignore
			bounds.box.getCenter(center);
			stateRef.current.targetPosition = new Vector3(0, 0, Math.max(0, center.z));
		}
	}, []);

	return {
		meshRef: { current: stateRef.current.mesh },
		modelBounds: activeModel?.modelBounds,
		isLoading: loadingState.isLoading,
		loadProgress: loadingState.progress,
		loadError: loadingState.error,
		isSelected: stateRef.current.isSelectedPersistent,
		isHovered: stateRef.current.isHovered,
		resetModel,
		forceReload: useCallback(() => {
			stateRef.current.lastLoadedUrl = null;
			throttledUpdateScene();
		}, [throttledUpdateScene]),
		clearCache: useCallback(() => { 
			cleanupResources(); 
		}, [cleanupResources]),
		deselect,
	};
};
