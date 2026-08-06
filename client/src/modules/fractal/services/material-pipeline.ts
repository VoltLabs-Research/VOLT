import * as THREE from 'three';
import pointCloudVertexSource from '@/modules/fractal/assets/shaders/point-cloud.vert?raw';
import pointCloudFragmentSource from '@/modules/fractal/assets/shaders/point-cloud.frag?raw';
import { debugFractal } from '@/modules/fractal/utils/debug-log';
import { disposeMaterialResources } from '@/modules/fractal/utils/resource-disposal';
import { sharedShaderRegistry } from '@/modules/fractal/services/shader-registry';

const DEFAULT_MIN_POINT_SIZE = 2.0;

interface PointCloudColorInfo {
    hasColorAttribute: boolean;
    injectedFallbackColor: boolean;
}

const OPTIMIZED_MATERIAL_DEFAULTS: THREE.MeshStandardMaterialParameters = {
    clipShadows: true,
    transparent: false,
    alphaTest: 0.1,
    side: THREE.FrontSide,
    depthWrite: true,
    depthTest: true
};

const TYPE_COLOR_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
    [0.5, 0.5, 0.5],
    [1.0, 0.267, 0.267],
    [0.267, 1.0, 0.267],
    [0.267, 0.267, 1.0],
    [1.0, 1.0, 0.267],
    [1.0, 0.267, 1.0],
    [0.267, 1.0, 1.0],
    [0.6, 0.6, 0.6]
];

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

const ensurePointCloudVisibilityAttribute = (geometry: THREE.BufferGeometry): void => {
    const existing = geometry.getAttribute('aVisible');
    const pointCount = geometry.getAttribute('position')?.count ?? 0;
    if (existing instanceof THREE.BufferAttribute && existing.count === pointCount) {
        return;
    }
    geometry.setAttribute('aVisible', new THREE.BufferAttribute(new Float32Array(pointCount).fill(1), 1));
};

const ensurePointCloudColorAttribute = (geometry: THREE.BufferGeometry): PointCloudColorInfo => {
    const colorAttribute = geometry.getAttribute('color');
    const paletteIndexAttribute = geometry.getAttribute('_color_index');
    const pointCount = geometry.getAttribute('position')?.count ?? 0;
    const buildFallbackColors = () => {
        const fallbackColors = new Float32Array(pointCount * 3);
        for (let index = 0; index < pointCount; index += 1) {
            const colorOffset = index * 3;
            fallbackColors[colorOffset] = 0.31;
            fallbackColors[colorOffset + 1] = 0.64;
            fallbackColors[colorOffset + 2] = 1.0;
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(fallbackColors, 3));
    };

    const buildPaletteColors = () => {
        if (!paletteIndexAttribute || paletteIndexAttribute.count === 0) {
            return false;
        }
        const paletteColors = new Float32Array(pointCount * 3);
        for (let index = 0; index < pointCount; index += 1) {
            const colorOffset = index * 3;
            const paletteIndex = Math.max(
                0,
                Math.min(TYPE_COLOR_PALETTE.length - 1, Math.round(paletteIndexAttribute.getX(index)))
            );
            const color = TYPE_COLOR_PALETTE[paletteIndex];
            paletteColors[colorOffset] = color[0];
            paletteColors[colorOffset + 1] = color[1];
            paletteColors[colorOffset + 2] = color[2];
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(paletteColors, 3));
        geometry.deleteAttribute('_color_index');
        return true;
    };

    if ((!colorAttribute || colorAttribute.count === 0) && !buildPaletteColors()) {
        buildFallbackColors();
        return {
            hasColorAttribute: false,
            injectedFallbackColor: true
        };
    }

    const attribute = geometry.getAttribute('color');
    const colorArray = attribute instanceof THREE.BufferAttribute && !attribute.normalized
        ? attribute.array
        : null;
    const stride = attribute.itemSize;

    let sumR = 0; let sumG = 0; let sumB = 0;
    let maxChannelRunning = Number.NEGATIVE_INFINITY;
    let hasFiniteColor = false;

    for (let index = 0; index < attribute.count; index += 1) {
        let r: number; let g: number; let b: number;
        if (colorArray) {
            const offset = index * stride;
            r = colorArray[offset]; g = colorArray[offset + 1]; b = colorArray[offset + 2];
        } else {
            r = attribute.getX(index); g = attribute.getY(index); b = attribute.getZ(index);
        }
        if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;
        hasFiniteColor = true;
        sumR += r; sumG += g; sumB += b;
        if (r > maxChannelRunning) maxChannelRunning = r;
        if (g > maxChannelRunning) maxChannelRunning = g;
        if (b > maxChannelRunning) maxChannelRunning = b;
    }

    const avgLuma = hasFiniteColor
        ? ((sumR * 0.2126) + (sumG * 0.7152) + (sumB * 0.0722)) / attribute.count
        : 0;
    const shouldReplaceDarkColors = !hasFiniteColor || (maxChannelRunning <= 0.02 && avgLuma <= 0.02);
    if (shouldReplaceDarkColors) {
        buildFallbackColors();
    }

    return {
        hasColorAttribute: true,
        injectedFallbackColor: shouldReplaceDarkColors
    };
};

const raycastSphere = new THREE.Sphere();
const raycastHitPoint = new THREE.Vector3();

/**
 * Replaces per-vertex picking with a bounding-sphere hit.
 *
 * `THREE.Points.raycast` walks every vertex, and R3F raycasts handler-bearing
 * ancestors recursively — `SimulationCellBox` puts an unconditional `onClick` and
 * `onPointerDown` on the group the model is added to. So each pointer event ran one
 * distance test per atom on the main thread, which at millions of atoms is the whole
 * interaction budget spent before anything is drawn.
 *
 * Nothing consumes the per-atom hit: the line picker bails unless the hit carries a
 * `faceIndex`, which a point cloud never produces, and the cell selector only needs
 * to know that something under the cursor was hit — it passes its own container on.
 * Reporting one hit where the ray enters the bounds preserves both behaviours at
 * O(1). Atom-level selection is driven by masks, not by picking.
 */
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

    configurePointCloud(points: THREE.Points): THREE.Points {
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
            /*
             * The default uniforms (`edgeSoftness` 0, `opacity` 1) make the fragment
             * alpha exactly 1, so this starts in the opaque render list and only moves
             * to the transparent one when a style or opacity change actually needs it
             * (see `syncBlendingMode`). Declaring it transparent up front cost every
             * occluded sprite a full lighting evaluation.
             */
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
        points.frustumCulled = false;
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

    optimizeMaterial(base: THREE.Material, clippingPlanes: THREE.Plane[]): THREE.Material {
        const key = base.uuid;
        const cached = this.cache.get(key);
        if (cached) {
            cached.clippingPlanes = clippingPlanes;
            return cached;
        }

        let material: THREE.Material;
        if (base instanceof THREE.MeshStandardMaterial) {
            material = new THREE.MeshStandardMaterial({
                ...OPTIMIZED_MATERIAL_DEFAULTS,
                color: base.color,
                map: base.map,
                normalMap: base.normalMap,
                roughnessMap: base.roughnessMap,
                metalnessMap: base.metalnessMap,
                emissiveMap: base.emissiveMap,
                emissive: base.emissive,
                roughness: base.roughness,
                metalness: base.metalness,
                opacity: base.opacity,
                vertexColors: base.vertexColors
            });
        } else if (base instanceof THREE.MeshBasicMaterial) {
            material = new THREE.MeshStandardMaterial({
                ...OPTIMIZED_MATERIAL_DEFAULTS,
                color: base.color,
                map: base.map,
                opacity: base.opacity,
                vertexColors: base.vertexColors
            });
        } else {
            material = base.clone();
        }

        material.clippingPlanes = clippingPlanes;
        material.precision = 'highp';
        material.userData.isOptimized = true;
        this.cache.set(key, material);
        return material;
    }

    configureGeometry(root: THREE.Group, clippingPlanes: THREE.Plane[]): THREE.Mesh | null {
        let mainMesh: THREE.Mesh | null = null;
        root.traverse((child) => {
            if (child instanceof THREE.Mesh && !mainMesh) {
                mainMesh = child;
                child.frustumCulled = true;
                child.visible = true;
                child.material = this.optimizeMaterial(child.material, clippingPlanes);
            }
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
