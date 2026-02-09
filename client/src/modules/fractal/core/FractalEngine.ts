import * as THREE from 'three';
import { Plane, Raycaster, Vector3, Euler } from 'three';
import { AssetLoader } from '@/modules/fractal/core/AssetLoader';
import { MaterialPipeline } from '@/modules/fractal/core/MaterialPipeline';
import { ModelTransform, type BoundsInfo } from '@/modules/fractal/core/ModelTransform';

type FractalParams = {
    url?: string | null;
    sliceClippingPlanes: Plane[];
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
    updateThrottle: number;
    disableAutoTransform?: boolean;
    useFixedReference?: boolean;
    onSelect?: () => void;
    orbitControlsRef?: { current?: any };
    onEmptyData?: () => void;
    sceneKey?: string;
    boxBounds?: { xlo: number; xhi: number; ylo: number; yhi: number; zlo: number; zhi: number };
    normalizationScale?: number;
};

type EngineCallbacks = {
    onModelLoaded?: (bounds: BoundsInfo) => void;
    onLoadingState?: (state: { isLoading: boolean; progress: number; error: string | null }) => void;
    onModelAvailable?: (model: THREE.Group | null) => void;
};

export class FractalEngine {
    private state = {
        model: null as THREE.Group | null,
        mesh: null as THREE.Mesh | THREE.Points | null,
        bounds: null as BoundsInfo | null,
        lastLoadedUrl: null as string | null,
        isLoading: false,
        loadProgress: 0,
        loadError: null as string | null,

        selected: null as THREE.Group | null,
        dragging: false,
        isHovered: false,
        isSelectedPersistent: false,
        targetPosition: null as THREE.Vector3 | null,

        currentRotation: new Euler(0, 0, 0),
        targetRotation: null as Euler | null,
        currentScale: 1,
        targetScale: 1,
        lastInteractionTime: 0,
        isRotating: false,
        lastRotationActiveMs: 0,
        rotationFreezeSize: null as THREE.Vector3 | null
    };

    private params: FractalParams;
    private callbacks: EngineCallbacks;
    private assetLoader = new AssetLoader();
    private materialPipeline = new MaterialPipeline();
    private modelTransform = new ModelTransform();

    private selectionOverlay: {
        group: THREE.Group | null;
        base: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial> | null;
        showSelection: boolean;
    };

    private simulationBox: {
        mesh: THREE.Mesh | null;
        baseSize: THREE.Vector3 | null;
        size: THREE.Vector3 | null;
        sizeAnimActive: boolean;
        sizeAnimFrom: THREE.Vector3 | null;
        sizeAnimTo: THREE.Vector3 | null;
        sizeAnimStartMs: number;
        external: boolean;
    };

    private raycaster = new Raycaster();
    private groundPlane = new Plane(new Vector3(0, 0, 1), 0);
    private dragOffset = new Vector3();
    private lastClickTime = 0;

    constructor(
        private surface: {
            scene: THREE.Scene;
            camera: THREE.Camera;
            gl: THREE.WebGLRenderer;
            invalidate: () => void;
        },
        params: FractalParams,
        callbacks: EngineCallbacks = {}
    ) {
        this.params = params;
        this.callbacks = callbacks;
        this.selectionOverlay = { group: null as THREE.Group | null, base: null as THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial> | null, showSelection: false };
        this.simulationBox = { mesh: null as THREE.Mesh | null, baseSize: null as THREE.Vector3 | null, size: null as THREE.Vector3 | null, sizeAnimActive: false, sizeAnimFrom: null as THREE.Vector3 | null, sizeAnimTo: null as THREE.Vector3 | null, sizeAnimStartMs: 0, external: false };
    }

    configure(params: FractalParams) {
        this.params = params;
        this.setLocalClippingEnabled((params.sliceClippingPlanes?.length ?? 0) > 0);
        if (this.state.model) this.applyClippingToModel(this.state.model, params.sliceClippingPlanes);
    }

    setCallbacks(callbacks: EngineCallbacks) {
        this.callbacks = callbacks;
    }

    setCamera(camera: THREE.Camera) {
        this.surface.camera = camera;
    }

    attachEvents() {
        const canvas = this.surface.gl.domElement;
        if (!canvas) return;

        canvas.addEventListener('pointerdown', this.handlePointerDown);
        canvas.addEventListener('pointermove', this.handlePointerMove);
        canvas.addEventListener('pointerup', this.handlePointerUp);
        window.addEventListener('keydown', this.handleKeyDown);
    }

    detachEvents() {
        const canvas = this.surface.gl.domElement;
        if (canvas) {
            canvas.removeEventListener('pointerdown', this.handlePointerDown);
            canvas.removeEventListener('pointermove', this.handlePointerMove);
            canvas.removeEventListener('pointerup', this.handlePointerUp);
        }
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    async loadIfNeeded() {
        const url = this.params.url ?? null;
        if (!url || url === this.state.lastLoadedUrl || this.state.isLoading) return;

        this.state.isLoading = true;
        this.state.loadProgress = 0;
        this.state.loadError = null;
        this.callbacks.onLoadingState?.({ isLoading: true, progress: 0, error: null });

        try {
            const loadedModel = await this.assetLoader.load(url, (progress) => {
                const pct = Math.round(progress * 100);
                this.state.loadProgress = pct;
                this.callbacks.onLoadingState?.({ isLoading: true, progress: pct, error: null });
            });

            if (!this.hasRenderableData(loadedModel)) {
                this.params.onEmptyData?.();
            }

            const pointCloud = this.materialPipeline.detectPointCloud(loadedModel);
            if (pointCloud) {
                this.materialPipeline.configurePointCloud(pointCloud);
                this.state.mesh = pointCloud;
            } else {
                this.state.mesh = this.materialPipeline.configureGeometry(loadedModel, this.params.sliceClippingPlanes);
            }

            this.applyClippingToModel(loadedModel, this.params.sliceClippingPlanes);
            const bounds = this.modelTransform.apply(loadedModel, {
                position: this.params.position,
                rotation: this.params.rotation,
                scale: this.params.scale,
                disableAutoTransform: this.params.disableAutoTransform,
                useFixedReference: this.params.useFixedReference
            });

            if (this.state.model) {
                this.state.model.removeFromParent();
            }

            this.state.model = loadedModel;
            this.state.bounds = bounds;
            this.state.lastLoadedUrl = url;

            this.callbacks.onModelLoaded?.(bounds);
            this.callbacks.onModelAvailable?.(loadedModel);
            this.callbacks.onLoadingState?.({ isLoading: false, progress: 100, error: null });
        } catch (error: any) {
            const message = error instanceof Error ? error.message : String(error);
            this.state.loadError = message;
            this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: message });
        } finally {
            this.state.isLoading = false;
            this.surface.invalidate();
            const latestUrl = this.params.url ?? null;
            if (latestUrl && latestUrl !== this.state.lastLoadedUrl) {
                this.loadIfNeeded();
            }
        }
    }

    private hasRenderableData(model: THREE.Group) {
        let hasData = false;
        model.traverse((child) => {
            if (hasData) return;
            if (child instanceof THREE.Points) {
                const geom = child.geometry;
                const pos = geom?.getAttribute('position');
                if (pos && pos.count > 0) hasData = true;
                return;
            }
            if (child instanceof THREE.Mesh) {
                const geom = child.geometry;
                const pos = geom?.getAttribute('position');
                if (!pos || pos.count < 3) return;
                if (geom.index) {
                    if (geom.index.count >= 3) hasData = true;
                    return;
                }
                if (pos.count >= 3) hasData = true;
            }
        });
        return hasData;
    }

    updatePointSize(multiplier: number, normalizationScale?: number, boxBounds?: FractalParams['boxBounds']) {
        const mesh = this.state.mesh;
        if (!mesh || !(mesh instanceof THREE.Points) || !mesh.material) return;

        const mat = mesh.material as THREE.ShaderMaterial;
        let baseScale = mat.userData.basePointScale;

        if (boxBounds) {
            const { xlo, xhi, ylo, yhi, zlo, zhi } = boxBounds;
            const width = xhi - xlo;
            const height = yhi - ylo;
            const depth = zhi - zlo;
            const volume = width * height * depth;
            const numPoints = mesh.geometry.attributes.position.count;

            if (volume > 0 && numPoints > 0) {
                const spacing = Math.pow(volume / numPoints, 1.0 / 3.0);
                baseScale = spacing * 1.5;
            }
        }

        const normScale = normalizationScale || 1;
        if (baseScale !== undefined) {
            mat.uniforms.pointScale.value = baseScale * normScale * multiplier;
            this.surface.invalidate();
        }
    }

    updateOpacity(sceneKey: string | undefined, sceneOpacities: Record<string, number>) {
        if (!this.state.model || !sceneKey) return;
        const opacity = sceneOpacities[sceneKey] ?? 1.0;
        this.state.model.traverse((child) => {
            if (child instanceof THREE.Points && child.material) {
                const mat = child.material as THREE.ShaderMaterial;
                if (mat.uniforms?.opacity) {
                    mat.uniforms.opacity.value = opacity;
                }
            } else if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material as THREE.Material;
                mat.transparent = opacity < 1.0;
                mat.opacity = opacity;
                mat.needsUpdate = true;
            }
        });
        this.surface.invalidate();
    }

    setSimBoxMesh(mesh: THREE.Mesh | null) {
        this.simulationBox.mesh = mesh;
        this.simulationBox.external = !!mesh;
        if (mesh) {
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            if (mesh.geometry.boundingBox) {
                const size = new THREE.Vector3();
                mesh.geometry.boundingBox.getSize(size);
                this.simulationBox.baseSize = size.clone();
                this.simulationBox.size = size.clone();
            }
        } else {
            this.simulationBox.baseSize = null;
            this.simulationBox.size = null;
        }
    }

    tick() {
        if (!this.state.model) return;

        const now = Date.now();
        const boundsBox = new THREE.Box3().setFromObject(this.state.model);
        const center = boundsBox.getCenter(new Vector3());

        this.ensureSimulationBox(boundsBox);

        if (this.state.selected && this.state.targetPosition) {
            this.state.targetPosition.z = Math.max(0, this.state.targetPosition.z);
            this.state.selected.position.lerp(this.state.targetPosition, 0.08);
            this.surface.invalidate();
        }

        if (this.state.selected && this.state.targetRotation) {
            const f = 0.1;
            this.state.currentRotation.x += (this.state.targetRotation.x - this.state.currentRotation.x) * f;
            this.state.currentRotation.y += (this.state.targetRotation.y - this.state.currentRotation.y) * f;
            this.state.currentRotation.z += (this.state.targetRotation.z - this.state.currentRotation.z) * f;
            this.state.selected.rotation.copy(this.state.currentRotation);

            const dx = Math.abs(this.state.targetRotation.x - this.state.currentRotation.x);
            const dy = Math.abs(this.state.targetRotation.y - this.state.currentRotation.y);
            const dz = Math.abs(this.state.targetRotation.z - this.state.currentRotation.z);
            const rotatingNow = dx + dy + dz > 1e-3;

            if (rotatingNow) {
                this.state.isRotating = true;
                this.state.lastRotationActiveMs = now;
                this.state.rotationFreezeSize = this.simulationBox.size?.clone() ?? null;
            } else if (this.state.isRotating && now - this.state.lastRotationActiveMs >= 160) {
                this.state.isRotating = false;
                this.startResizeFromRotation(boundsBox, this.state.isHovered, this.state.rotationFreezeSize);
            }
        }

        if (this.state.selected) {
            if (Math.abs(this.state.targetScale - this.state.currentScale) > 1e-3) {
                const nextScale = this.state.currentScale + (this.state.targetScale - this.state.currentScale) * 0.08;
                this.state.selected.scale.setScalar(nextScale);
                this.state.currentScale = nextScale;
                this.surface.invalidate();
            }
        }

        const sizeAnim = this.tickSimulationBox(now);

        const timeSince = (now - this.state.lastInteractionTime) / 1000;
        const pulseI = Math.max(0, 1 - timeSince * 0.5);
        const pulse = 0.9 + 0.1 * Math.sin(now * 0.003) * pulseI;

        const hover = this.state.isHovered && !this.state.isSelectedPersistent;
        if (sizeAnim) this.updateSelectionGeometry(sizeAnim, hover);
        this.updateSelectionPulse(center, this.state.isSelectedPersistent || this.state.isHovered ? 1 : 0.001, hover, pulse);
    }

    dispose() {
        if (this.state.model) {
            this.state.model.removeFromParent();
            this.state.model = null;
        }
        this.disposeSelection();
        this.simulationBox.mesh = null;
    }

    isSelected() {
        return this.state.isSelectedPersistent;
    }

    isHovered() {
        return this.state.isHovered;
    }

    deselect() {
        this.state.isSelectedPersistent = false;
        this.state.selected = null;
        this.hideSelection();
        this.surface.invalidate();
    }

    resetTransform() {
        if (!this.state.selected) return;
        this.state.targetRotation = new Euler(0, 0, 0);
        this.state.targetScale = 1;
        this.state.lastInteractionTime = Date.now();

        if (this.state.bounds) {
            const center = new Vector3();
            this.state.bounds.box.getCenter(center);
            this.state.targetPosition = new Vector3(0, 0, Math.max(0, center.z));
        }
    }

    private setLocalClippingEnabled(enabled: boolean) {
        this.surface.gl.localClippingEnabled = enabled;
    }

    private applyClippingToModel(root: THREE.Group, planes: Plane[]) {
        root.traverse((obj: any) => {
            if (!obj.material) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((material: THREE.Material) => {
                if ((material as any).clippingPlanes !== undefined) {
                    (material as any).clippingPlanes = planes;
                    material.needsUpdate = true;
                }

                if (material instanceof THREE.ShaderMaterial && material.uniforms?.clippingPlanes) {
                    material.uniforms.clippingPlanes.value = planes;
                    material.uniformsNeedUpdate = true;
                }
            });
        });
        this.surface.invalidate();
    }

    private ensureSimulationBox(bounds: THREE.Box3) {
        if (this.simulationBox.external) return;
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bounds.getSize(size);
        bounds.getCenter(center);

        const EPS = 1e-4;
        if (!this.simulationBox.mesh) {
            const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
            const material = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0.0,
                depthWrite: false,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = 'FractalInvisibleRaycastBox';
            mesh.visible = true;
            mesh.renderOrder = -1;

            this.surface.scene.add(mesh);
            this.simulationBox.mesh = mesh;
            this.simulationBox.baseSize = size.clone();
            this.simulationBox.size = size.clone();
        } else if (!this.simulationBox.sizeAnimActive && !this.simulationBox.external) {
            const current = this.simulationBox.size || new THREE.Vector3();
            if (Math.abs(current.x - size.x) > EPS ||
                Math.abs(current.y - size.y) > EPS ||
                Math.abs(current.z - size.z) > EPS) {
                this.simulationBox.mesh.geometry.dispose();
                this.simulationBox.mesh.geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
                this.simulationBox.mesh.scale.set(1, 1, 1);
                this.simulationBox.baseSize = size.clone();
                this.simulationBox.size = size.clone();
            }
        }

        this.simulationBox.mesh!.position.copy(center);
    }

    private startResizeFromRotation(bounds: THREE.Box3, hover: boolean, freezeSize?: THREE.Vector3 | null) {
        if (this.simulationBox.external) return;
        const sizeWorld = new THREE.Vector3();
        bounds.getSize(sizeWorld);
        const padding = hover ? 1.04 : 1.06;
        const sizeTarget = sizeWorld.multiplyScalar(padding);

        let sizeFrom = freezeSize?.clone();
        if (!sizeFrom && this.simulationBox.size) sizeFrom = this.simulationBox.size.clone();
        if (!sizeFrom) sizeFrom = sizeTarget.clone();

        this.simulationBox.sizeAnimFrom = sizeFrom.clone();
        this.simulationBox.sizeAnimTo = sizeTarget.clone();
        this.simulationBox.sizeAnimStartMs = Date.now();
        this.simulationBox.sizeAnimActive = true;

        if (this.simulationBox.mesh) {
            this.simulationBox.mesh.geometry.dispose();
            this.simulationBox.mesh.geometry = new THREE.BoxGeometry(sizeFrom.x, sizeFrom.y, sizeFrom.z);
            this.simulationBox.mesh.scale.set(1, 1, 1);
        }

        this.simulationBox.baseSize = sizeFrom.clone();
        this.simulationBox.size = sizeFrom.clone();
    }

    private tickSimulationBox(now: number) {
        if (this.simulationBox.external) return null;
        if (!this.simulationBox.sizeAnimActive ||
            !this.simulationBox.sizeAnimFrom ||
            !this.simulationBox.sizeAnimTo ||
            !this.simulationBox.mesh ||
            !this.simulationBox.baseSize) {
            return null;
        }

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        const t = Math.min(1, (now - this.simulationBox.sizeAnimStartMs) / 240);
        const tt = easeOutCubic(t);

        const cur = new THREE.Vector3(
            this.simulationBox.sizeAnimFrom.x + (this.simulationBox.sizeAnimTo.x - this.simulationBox.sizeAnimFrom.x) * tt,
            this.simulationBox.sizeAnimFrom.y + (this.simulationBox.sizeAnimTo.y - this.simulationBox.sizeAnimFrom.y) * tt,
            this.simulationBox.sizeAnimFrom.z + (this.simulationBox.sizeAnimTo.z - this.simulationBox.sizeAnimFrom.z) * tt
        );

        this.simulationBox.mesh.scale.set(
            cur.x / this.simulationBox.baseSize.x,
            cur.y / this.simulationBox.baseSize.y,
            cur.z / this.simulationBox.baseSize.z
        );

        this.simulationBox.size = cur.clone();

        if (t >= 1) {
            this.simulationBox.mesh.geometry.dispose();
            this.simulationBox.mesh.geometry = new THREE.BoxGeometry(this.simulationBox.sizeAnimTo.x, this.simulationBox.sizeAnimTo.y, this.simulationBox.sizeAnimTo.z);
            this.simulationBox.mesh.scale.set(1, 1, 1);
            this.simulationBox.baseSize = this.simulationBox.sizeAnimTo.clone();
            this.simulationBox.size = this.simulationBox.sizeAnimTo.clone();
            this.simulationBox.sizeAnimActive = false;
        }

        return cur;
    }

    private updateSelectionGeometry(_size: THREE.Vector3, _hover: boolean) {
        return;
    }

    private updateSelectionPulse(_position: THREE.Vector3, _targetScale: number, _hover: boolean, _pulseOpacity: number) {
        return;
    }

    private showSelection(_size: THREE.Vector3, _hover: boolean) {
        return;
    }

    private hideSelection() {
        return;
    }

    private disposeSelection() {
        if (this.selectionOverlay.group) {
            this.selectionOverlay.group.visible = false;
        }
        if (this.selectionOverlay.base) {
            this.selectionOverlay.base.visible = false;
        }
    }

    private handlePointerDown = (event: MouseEvent) => {
        if (!this.state.model) return;
        const simBox = this.simulationBox.mesh;
        if (!simBox) return;

        const rect = this.surface.gl.domElement.getBoundingClientRect();
        const mouse = new Vector3(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
            0
        );

        this.raycaster.setFromCamera({ x: mouse.x, y: mouse.y }, this.surface.camera as any);
        const simHits = this.raycaster.intersectObject(simBox, false);

        if (event.button === 0 && simHits.length > 0) {
            if (!this.state.isSelectedPersistent) {
                this.state.isSelectedPersistent = true;
                this.state.selected = (simBox.parent as THREE.Group) || simBox;
                if (this.state.bounds) {
                    const size = this.state.bounds.size.clone().multiplyScalar(1.06);
                    this.showSelection(size, false);
                }
                this.params.onSelect?.();
            }

            const now = Date.now();
            if (now - this.lastClickTime < 300) {
                this.state.dragging = true;
                const intersection = this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
                if (intersection && this.state.selected) {
                    this.dragOffset.copy(this.state.selected.position).sub(intersection);
                }
                this.setOrbitControlsEnabled(false);
            } else {
                this.state.dragging = false;
            }
            this.lastClickTime = now;

            this.state.lastInteractionTime = Date.now();
            this.surface.invalidate();
        } else {
            this.state.isSelectedPersistent = false;
            this.state.selected = null;
            this.hideSelection();
            this.surface.invalidate();
        }
    };

    private handlePointerMove = (event: MouseEvent) => {
        if (!this.state.model) return;
        const simBox = this.simulationBox.mesh;
        if (!simBox) return;

        const rect = this.surface.gl.domElement.getBoundingClientRect();
        const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.surface.camera as any);
        const simHits = this.raycaster.intersectObject(simBox, false);

        const wasHovered = this.state.isHovered;
        this.state.isHovered = simHits.length > 0;

        if (this.state.isHovered && !this.state.isSelectedPersistent && !wasHovered) {
            if (this.state.bounds) {
                const size = this.state.bounds.size.clone().multiplyScalar(1.04);
                this.showSelection(size, true);
            }
        } else if (!this.state.isHovered && !this.state.isSelectedPersistent && wasHovered) {
            this.hideSelection();
        }

        const intersection = this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
        if (this.state.dragging && this.state.selected && intersection) {
            const target = intersection.clone().add(this.dragOffset);
            this.state.targetPosition = new THREE.Vector3(target.x, target.y, Math.max(0, target.z));
            this.surface.invalidate();
        }
    };

    private handlePointerUp = (event: MouseEvent) => {
        if (event.button === 0 && this.state.dragging) {
            this.state.dragging = false;
            this.state.targetPosition = null;
            this.setOrbitControlsEnabled(true);
        }
    };

    private handleKeyDown = (event: KeyboardEvent) => {
        if (!this.state.selected) return;
        const isCtrl = event.ctrlKey || event.metaKey;
        if (isCtrl) {
            switch (event.code) {
                case 'ArrowUp': event.preventDefault(); this.rotate(-Math.PI / 24, 0, 0); this.surface.invalidate(); break;
                case 'ArrowDown': event.preventDefault(); this.rotate(Math.PI / 24, 0, 0); this.surface.invalidate(); break;
                case 'ArrowLeft': event.preventDefault(); this.rotate(0, -Math.PI / 24, 0); this.surface.invalidate(); break;
                case 'ArrowRight': event.preventDefault(); this.rotate(0, Math.PI / 24, 0); this.surface.invalidate(); break;
                case 'Equal':
                case 'NumpadAdd': event.preventDefault(); this.scale(0.1); this.surface.invalidate(); break;
                case 'Minus':
                case 'NumpadSubtract': event.preventDefault(); this.scale(-0.1); this.surface.invalidate(); break;
            }
        } else if (event.shiftKey) {
            switch (event.code) {
                case 'ArrowLeft': event.preventDefault(); this.rotate(0, 0, -Math.PI / 24); this.surface.invalidate(); break;
                case 'ArrowRight': event.preventDefault(); this.rotate(0, 0, Math.PI / 24); this.surface.invalidate(); break;
            }
        }

        if (event.key === 'Escape') {
            this.state.isSelectedPersistent = false;
            this.state.selected = null;
            this.hideSelection();
        }
    };

    private setOrbitControlsEnabled(enabled: boolean) {
        if (this.params.orbitControlsRef?.current) {
            this.params.orbitControlsRef.current.enabled = enabled;
        }
    }

    private rotate(dx: number, dy: number, dz: number) {
        if (!this.state.selected) return;
        const r = this.state.currentRotation.clone();
        r.x += dx;
        r.y += dy;
        r.z += dz;
        this.state.targetRotation = r;
        this.state.lastInteractionTime = Date.now();
    }

    private scale(delta: number) {
        if (!this.state.selected) return;
        const newScale = Math.max(0.1, Math.min(5.0, this.state.targetScale + delta));
        this.state.targetScale = newScale;
        this.state.lastInteractionTime = Date.now();
    }
}
