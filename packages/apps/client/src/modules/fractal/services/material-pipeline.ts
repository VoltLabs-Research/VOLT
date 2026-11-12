import * as THREE from 'three';
import pointCloudVertexSource from '@/modules/fractal/assets/shaders/point-cloud.vert?raw';
import pointCloudFragmentSource from '@/modules/fractal/assets/shaders/point-cloud.frag?raw';
import ovitoSurfaceVertexSource from '@/modules/fractal/assets/shaders/ovito-surface.vert?raw';
import ovitoSurfaceFragmentSource from '@/modules/fractal/assets/shaders/ovito-surface.frag?raw';
import { debugFractal } from '@/modules/fractal/utils/debug-log';
import { disposeMaterialResources } from '@/modules/fractal/utils/resource-disposal';
import { sharedShaderRegistry } from '@/modules/fractal/services/shader-registry';
import {
    enablePointCloudBlocks,
    selectVisiblePointCloudBlocks,
    skipPointCloudDraw
} from '@/modules/fractal/services/point-cloud-block-drawing';
import { PointCloudAtomPass } from '@/modules/fractal/services/point-cloud-atom-pass';

const DEFAULT_MIN_POINT_SIZE = 2.0;
// point-cloud.vert draws an atom pointScale × modelScale × POINT_SIZE_DEPTH_FACTOR / depth pixels wide.
const POINT_SIZE_DEPTH_FACTOR = 300;

interface PointCloudColorInfo {
    hasColorAttribute: boolean;
    injectedFallbackColor: boolean;
}

const OPTIMIZED_MATERIAL_DEFAULTS: THREE.MeshStandardMaterialParameters = {
    clipShadows: true,
    transparent: false,
    alphaTest: 0.1,
    depthWrite: true,
    depthTest: true
};

const MAX_MESH_ROUGHNESS = 0.75;
const MESH_ENV_MAP_INTENSITY = 0.7;

export type SurfaceShadingModel = 'pbr' | 'ovito';

const readMaterialColor = (material: THREE.Material): THREE.Color => {
    const candidate = material as THREE.Material & { color?: THREE.Color };
    return candidate.color instanceof THREE.Color
        ? candidate.color.clone()
        : new THREE.Color(1, 1, 1);
};

const createPointCloudUniforms = (pointScale: number): Record<string, THREE.IUniform> => ({
    cameraPosition: { value: new THREE.Vector3() },
    ambientFactor: { value: 0.7 },
    diffuseFactor: { value: 0.6 },
    specularFactor: { value: 0.1 },
    shininess: { value: 50.0 },
    rimFactor: { value: 0.05 },
    rimPower: { value: 2.0 },
    pointScale: { value: pointScale },
    uMinPointSize: { value: DEFAULT_MIN_POINT_SIZE },
    edgeSoftness: { value: 0.0 },
    lightingMix: { value: 1.0 },
    opacity: { value: 1.0 }
});

// One byte per point, read by the shader as 0 (deleted by a mask) or 1.
const ensurePointCloudVisibilityAttribute = (geometry: THREE.BufferGeometry): void => {
    const existing = geometry.getAttribute('aVisible');
    const pointCount = geometry.getAttribute('position')?.count ?? 0;
    if (existing instanceof THREE.BufferAttribute && existing.count === pointCount) {
        return;
    }
    geometry.setAttribute('aVisible', new THREE.BufferAttribute(new Uint8Array(pointCount).fill(255), 1, true));
};

const FALLBACK_POINT_COLOR = [0.31, 0.64, 1.0] as const;

// VOLT models carry their colours; a glTF from elsewhere may have none, or all black ones.
const ensurePointCloudColorAttribute = (geometry: THREE.BufferGeometry): PointCloudColorInfo => {
    const pointCount = geometry.getAttribute('position')?.count ?? 0;
    const applyFallbackColors = () => {
        const colors = new Float32Array(pointCount * 3);
        for (let index = 0; index < pointCount; index += 1) {
            colors.set(FALLBACK_POINT_COLOR, index * 3);
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    };

    const attribute = geometry.getAttribute('color');
    if (!(attribute instanceof THREE.BufferAttribute) || attribute.count === 0) {
        applyFallbackColors();
        return {
            hasColorAttribute: false,
            injectedFallbackColor: true
        };
    }

    const array = attribute.array;
    const stride = attribute.itemSize;
    const scale = !attribute.normalized ? 1 : array instanceof Uint8Array ? 1 / 255 : array instanceof Uint16Array ? 1 / 65535 : 1;
    let maxChannel = 0;
    let hasFiniteColor = false;
    for (let offset = 0; offset < array.length && maxChannel <= 0.02; offset += stride) {
        for (let channel = 0; channel < 3; channel += 1) {
            const value = array[offset + channel] * scale;
            if (!Number.isFinite(value)) continue;
            hasFiniteColor = true;
            if (value > maxChannel) maxChannel = value;
        }
    }

    const shouldReplaceDarkColors = !hasFiniteColor || maxChannel <= 0.02;
    if (shouldReplaceDarkColors) {
        applyFallbackColors();
    }

    return {
        hasColorAttribute: true,
        injectedFallbackColor: shouldReplaceDarkColors
    };
};

const drawingBufferSize = new THREE.Vector2();

const modelAxis = new THREE.Vector3();

// Right before the points draw: either their atoms go through their own pass (see
// PointCloudAtomPass), which draws them from inside it, or this is that draw, or they draw directly.
// A draw picks the blocks of atoms whose sprites can reach its target.
const preparePointCloudDraw = (
    points: THREE.Points,
    pass: PointCloudAtomPass,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    drawMaterial: THREE.Material
): void => {
    const material = points.material;
    if (!(material instanceof THREE.ShaderMaterial) || !material.uniforms.pointScale) return;
    const targetHeight = renderer.getRenderTarget()?.height ?? renderer.getDrawingBufferSize(drawingBufferSize).y;
    const modelScale = modelAxis.setFromMatrixColumn(points.matrixWorld, 0).length();
    const size = {
        pixelsAtUnitDepth: (material.uniforms.pointScale.value as number) * modelScale * POINT_SIZE_DEPTH_FACTOR,
        minPixels: material.uniforms.uMinPointSize.value as number,
        pixelsPerUnit: camera.projectionMatrix.elements[5] * targetHeight * 0.5,
        perspective: camera.projectionMatrix.elements[15] === 0
    };

    if (!pass.drawingAtoms && !pass.drawsDirectly(drawMaterial)) {
        pass.render(renderer, camera, size);
        skipPointCloudDraw(points);
        return;
    }
    selectVisiblePointCloudBlocks(points, renderer, camera, material, size);
};

const raycastSphere = new THREE.Sphere();
const raycastHitPoint = new THREE.Vector3();

const attachBoundedRaycast = (points: THREE.Points): void => {
    points.raycast = (raycaster, intersects): void => {
        const geometry = points.geometry;
        if (!geometry.boundingSphere) {
            geometry.computeBoundingSphere();
        }
        if (!geometry.boundingSphere) return;

        raycastSphere.copy(geometry.boundingSphere).applyMatrix4(points.matrixWorld);
        if (!raycaster.ray.intersectSphere(raycastSphere, raycastHitPoint)) return;

        const distance = raycaster.ray.origin.distanceTo(raycastHitPoint);
        if (distance < raycaster.near || distance > raycaster.far) return;

        intersects.push({
            distance,
            point: raycastHitPoint.clone(),
            object: points
        });
    };
};

export class MaterialPipeline {
    private cache = new Map<string, THREE.Material>();
    private pointCloudMaterials = new Set<THREE.ShaderMaterial>();

    configurePointCloud(points: THREE.Points, onBlocksReady?: () => void): THREE.Points {
        const colorInfo = ensurePointCloudColorAttribute(points.geometry);
        ensurePointCloudVisibilityAttribute(points.geometry);

        const numPoints = points.geometry.attributes.position.count;

        if (!points.geometry.boundingBox) {
            points.geometry.computeBoundingBox();
        }
        if (!points.geometry.boundingSphere) {
            points.geometry.computeBoundingSphere();
        }

        let volume = 0;
        if (points.geometry.boundingBox) {
            const size = new THREE.Vector3();
            points.geometry.boundingBox.getSize(size);
            volume = size.x * size.y * size.z;
        }
        if (volume === 0) volume = numPoints * 10.0;
        const spacing = Math.pow(volume / numPoints, 1.0 / 3.0);
        const dynamicPointScale = spacing * 1.75;

        const program = sharedShaderRegistry.compile({
            vertex: pointCloudVertexSource,
            fragment: pointCloudFragmentSource
        });
        const mat = new THREE.ShaderMaterial({
            vertexShader: program.vertex,
            fragmentShader: program.fragment,
            uniforms: createPointCloudUniforms(dynamicPointScale),
            vertexColors: true,

            transparent: false,
            opacity: 1.0,
            depthTest: true,
            depthWrite: true,
            blending: THREE.NormalBlending,
            alphaTest: 0.5,
            dithering: false,
            premultipliedAlpha: false,
            clipping: true
        });
        mat.clippingPlanes = [];

        points.userData.basePointScale = dynamicPointScale;
        this.pointCloudMaterials.add(mat);

        debugFractal('material-pipeline.configure-point-cloud', {
            numPoints,
            volume,
            spacing,
            dynamicPointScale,
            hasColorAttribute: colorInfo.hasColorAttribute,
            injectedFallbackColor: colorInfo.injectedFallbackColor,
            attributeKeys: Object.keys(points.geometry.attributes),
            boundingSphereRadius: points.geometry.boundingSphere?.radius ?? null
        });

        points.material = mat;
        const atomPass = new PointCloudAtomPass(points);
        mat.addEventListener('dispose', () => atomPass.dispose());
        points.onBeforeRender = (renderer, _scene, camera, _geometry, material) => {
            preparePointCloudDraw(points, atomPass, renderer, camera, material);
        };
        enablePointCloudBlocks(points, onBlocksReady);
        attachBoundedRaycast(points);
        return points;
    }

    detectPointClouds(root: THREE.Group): THREE.Points[] {
        const pointClouds: THREE.Points[] = [];
        root.traverse((child) => {
            if (child instanceof THREE.Points) {
                pointClouds.push(child);
            }
        });
        return pointClouds;
    }

    private createOvitoSurfaceMaterial(base: THREE.Material): THREE.ShaderMaterial {
        const program = sharedShaderRegistry.compile({
            vertex: ovitoSurfaceVertexSource,
            fragment: ovitoSurfaceFragmentSource
        });

        return new THREE.ShaderMaterial({
            vertexShader: program.vertex,
            fragmentShader: program.fragment,
            uniforms: {
                uColor: { value: readMaterialColor(base) },
                uOpacity: { value: base.opacity }
            },
            vertexColors: base.vertexColors,
            side: base.side,
            transparent: base.transparent,
            opacity: base.opacity,
            depthTest: true,
            depthWrite: true,
            clipping: true
        });
    }

    optimizeMaterial(
        base: THREE.Material,
        clippingPlanes: THREE.Plane[],
        shading: SurfaceShadingModel = 'pbr'
    ): THREE.Material {
        const key = `${shading}:${base.uuid}`;
        const cached = this.cache.get(key);
        if (cached) {
            cached.clippingPlanes = clippingPlanes;
            return cached;
        }

        let material: THREE.Material;
        if (shading === 'ovito') {
            material = this.createOvitoSurfaceMaterial(base);
        } else if (base instanceof THREE.MeshStandardMaterial) {
            material = new THREE.MeshStandardMaterial({
                ...OPTIMIZED_MATERIAL_DEFAULTS,
                side: base.side,
                color: base.color,
                map: base.map,
                normalMap: base.normalMap,
                roughnessMap: base.roughnessMap,
                metalnessMap: base.metalnessMap,
                emissiveMap: base.emissiveMap,
                emissive: base.emissive,
                roughness: Math.min(base.roughness, MAX_MESH_ROUGHNESS),
                metalness: base.metalness,
                envMapIntensity: MESH_ENV_MAP_INTENSITY,
                opacity: base.opacity,
                vertexColors: base.vertexColors
            });
        } else if (base instanceof THREE.MeshBasicMaterial) {
            material = new THREE.MeshStandardMaterial({
                ...OPTIMIZED_MATERIAL_DEFAULTS,
                side: base.side,
                color: base.color,
                map: base.map,
                roughness: MAX_MESH_ROUGHNESS,
                envMapIntensity: MESH_ENV_MAP_INTENSITY,
                opacity: base.opacity,
                vertexColors: base.vertexColors
            });
        } else {
            material = base.clone();
        }

        material.clippingPlanes = clippingPlanes;
        material.precision = 'highp';
        this.cache.set(key, material);
        return material;
    }

    configureGeometry(
        root: THREE.Group,
        clippingPlanes: THREE.Plane[],
        shading: SurfaceShadingModel = 'pbr'
    ): THREE.Mesh | null {
        let mainMesh: THREE.Mesh | null = null;
        root.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            if (!mainMesh) {
                mainMesh = child;
            }
            child.frustumCulled = true;
            child.visible = true;
            child.material = this.optimizeMaterial(child.material, clippingPlanes, shading);
        });
        return mainMesh;
    }

    dispose() {
        [
            ...this.cache.values(),
            ...this.pointCloudMaterials
        ].forEach((material) => {
            disposeMaterialResources(material);
        });
        this.cache.clear();
        this.pointCloudMaterials.clear();
    }
}
