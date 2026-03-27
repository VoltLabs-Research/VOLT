import * as THREE from 'three';
import vertexShader from '@/modules/fractal/assets/shaders/point-cloud.vert?raw';
import fragmentShader from '@/modules/fractal/assets/shaders/point-cloud.frag?raw';
import { debugFractal } from '@/modules/fractal/utilities/debug-log';
import { disposeMaterialResources } from '@/modules/fractal/utilities/resource-disposal';

interface PointCloudUniforms extends Record<string, THREE.IUniform<number | THREE.Vector3>> {
    cameraPosition: THREE.IUniform<THREE.Vector3>;
    ambientFactor: THREE.IUniform<number>;
    diffuseFactor: THREE.IUniform<number>;
    specularFactor: THREE.IUniform<number>;
    shininess: THREE.IUniform<number>;
    rimFactor: THREE.IUniform<number>;
    rimPower: THREE.IUniform<number>;
    pointScale: THREE.IUniform<number>;
    edgeSoftness: THREE.IUniform<number>;
    lightingMix: THREE.IUniform<number>;
    opacity: THREE.IUniform<number>;
};

interface OptimizedMaterialUserData {
    isOptimized?: boolean;
};

interface PointCloudColorInfo {
    hasColorAttribute: boolean;
    injectedFallbackColor: boolean;
    replacedDarkColorAttribute: boolean;
    minColor: [number, number, number] | null;
    maxColor: [number, number, number] | null;
    averageColor: [number, number, number] | null;
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

const applyOptimizedMaterialSettings = (
    material: THREE.Material,
    clippingPlanes: THREE.Plane[]
): THREE.Material => {
    material.clippingPlanes = clippingPlanes;
    material.precision = 'highp';
    material.userData = {
        ...material.userData,
        isOptimized: true
    } satisfies OptimizedMaterialUserData;
    return material;
};

const createPointCloudUniforms = (): PointCloudUniforms => ({
    cameraPosition: { value: new THREE.Vector3() },
    ambientFactor: { value: 0.7 },
    diffuseFactor: { value: 0.6 },
    specularFactor: { value: 0.1 },
    shininess: { value: 50.0 },
    rimFactor: { value: 0.05 },
    rimPower: { value: 2.0 },
    pointScale: { value: 1.0 },
    edgeSoftness: { value: 0.0 },
    lightingMix: { value: 1.0 },
    opacity: { value: 1.0 }
});

const ensurePointCloudColorAttribute = (geometry: THREE.BufferGeometry) => {
    let colorAttribute = geometry.getAttribute('color');
    const paletteIndexAttribute = geometry.getAttribute('_color_index');
    const positions = geometry.getAttribute('position');
    const pointCount = positions?.count ?? 0;
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
        colorAttribute = geometry.getAttribute('color');
        return true;
    };

    if ((!colorAttribute || colorAttribute.count === 0) && !buildPaletteColors()) {
        buildFallbackColors();
        colorAttribute = geometry.getAttribute('color');
        return {
            hasColorAttribute: false,
            injectedFallbackColor: true,
            replacedDarkColorAttribute: false,
            minColor: null,
            maxColor: null,
            averageColor: null
        } satisfies PointCloudColorInfo;
    }

    let minR = Number.POSITIVE_INFINITY;
    let minG = Number.POSITIVE_INFINITY;
    let minB = Number.POSITIVE_INFINITY;
    let maxR = Number.NEGATIVE_INFINITY;
    let maxG = Number.NEGATIVE_INFINITY;
    let maxB = Number.NEGATIVE_INFINITY;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let hasFiniteColor = false;

    for (let index = 0; index < colorAttribute.count; index += 1) {
        const r = colorAttribute.getX(index);
        const g = colorAttribute.getY(index);
        const b = colorAttribute.getZ(index);

        if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
            continue;
        }

        hasFiniteColor = true;
        minR = Math.min(minR, r);
        minG = Math.min(minG, g);
        minB = Math.min(minB, b);
        maxR = Math.max(maxR, r);
        maxG = Math.max(maxG, g);
        maxB = Math.max(maxB, b);
        sumR += r;
        sumG += g;
        sumB += b;
    }

    const denominator = hasFiniteColor ? colorAttribute.count : 1;
    const averageColor: [number, number, number] | null = hasFiniteColor
        ? [sumR / denominator, sumG / denominator, sumB / denominator]
        : null;
    const minColor: [number, number, number] | null = hasFiniteColor
        ? [minR, minG, minB]
        : null;
    const maxColor: [number, number, number] | null = hasFiniteColor
        ? [maxR, maxG, maxB]
        : null;

    const maxChannel = hasFiniteColor ? Math.max(maxR, maxG, maxB) : 0;
    const avgLuma = averageColor
        ? (averageColor[0] * 0.2126) + (averageColor[1] * 0.7152) + (averageColor[2] * 0.0722)
        : 0;
    const shouldReplaceDarkColors = !hasFiniteColor || (maxChannel <= 0.02 && avgLuma <= 0.02);

    if (shouldReplaceDarkColors) {
        buildFallbackColors();
    }

    return {
        hasColorAttribute: true,
        injectedFallbackColor: shouldReplaceDarkColors,
        replacedDarkColorAttribute: shouldReplaceDarkColors,
        minColor,
        maxColor,
        averageColor
    } satisfies PointCloudColorInfo;
};

export class MaterialPipeline {
    private cache = new Map<string, THREE.Material>();
    private pointCloudMaterials = new Set<THREE.ShaderMaterial>();

    configurePointCloud(points: THREE.Points) {
        const colorInfo = ensurePointCloudColorAttribute(points.geometry);
        const mat = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: createPointCloudUniforms(),
            vertexColors: true,
            transparent: true,
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

        if (volume === 0) {
            volume = numPoints * 10.0;
        }

        const spacing = Math.pow(volume / numPoints, 1.0 / 3.0);
        const dynamicPointScale = spacing * 1.5;
        debugFractal('material-pipeline.configure-point-cloud', {
            numPoints,
            volume,
            spacing,
            dynamicPointScale,
            hasColorAttribute: colorInfo.hasColorAttribute,
            injectedFallbackColor: colorInfo.injectedFallbackColor,
            replacedDarkColorAttribute: colorInfo.replacedDarkColorAttribute,
            minColor: colorInfo.minColor,
            maxColor: colorInfo.maxColor,
            averageColor: colorInfo.averageColor,
            attributeKeys: Object.keys(points.geometry.attributes),
            boundingSphereRadius: points.geometry.boundingSphere?.radius ?? null
        });

        mat.uniforms.pointScale.value = dynamicPointScale;
        mat.userData.basePointScale = dynamicPointScale;
        this.pointCloudMaterials.add(mat);

        points.material = mat;
        points.frustumCulled = false;
        // Disable raycasting on point clouds — THREE.Points.raycast() is brute-force O(n)
        // and causes massive frame drops when R3F synthetic events trigger recursive raycasting
        // against millions of vertices. The invisible BoxGeometry proxy mesh in SimulationCellBox
        // handles all hit-testing instead.
        points.raycast = () => {};
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

    optimizeMaterial(base: THREE.Material, clippingPlanes: THREE.Plane[]) {
        const key = base.uuid;
        if (this.cache.has(key)) {
            const cached = this.cache.get(key)!;
            cached.clippingPlanes = clippingPlanes;
            return cached;
        }

        let material: THREE.Material;
        if (base instanceof THREE.MeshStandardMaterial) {
            material = new THREE.MeshStandardMaterial({
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
                vertexColors: base.vertexColors,
                clipShadows: true,
                transparent: false,
                alphaTest: 0.1,
                side: THREE.FrontSide,
                depthWrite: true,
                depthTest: true
            });
        } else if (base instanceof THREE.MeshBasicMaterial) {
            material = new THREE.MeshStandardMaterial({
                color: base.color,
                map: base.map,
                opacity: base.opacity,
                vertexColors: base.vertexColors,
                clipShadows: true,
                transparent: false,
                alphaTest: 0.1,
                side: THREE.FrontSide,
                depthWrite: true,
                depthTest: true
            });
        } else {
            material = base.clone();
        }

        const optimizedMaterial = applyOptimizedMaterialSettings(material, clippingPlanes);
        this.cache.set(key, optimizedMaterial);

        return optimizedMaterial;
    }

    configureGeometry(root: THREE.Group, clippingPlanes: THREE.Plane[]) {
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
        this.cache.forEach((material) => {
            disposeMaterialResources(material);
        });
        this.cache.clear();

        this.pointCloudMaterials.forEach((material) => {
            disposeMaterialResources(material);
        });
        this.pointCloudMaterials.clear();
    }
};
