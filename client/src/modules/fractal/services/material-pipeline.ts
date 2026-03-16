import * as THREE from 'three';
import vertexShader from '@/modules/fractal/assets/shaders/point-cloud.vert?raw';
import fragmentShader from '@/modules/fractal/assets/shaders/point-cloud.frag?raw';
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

export class MaterialPipeline {
    private cache = new Map<string, THREE.Material>();
    private pointCloudMaterials = new Set<THREE.ShaderMaterial>();

    configurePointCloud(points: THREE.Points) {
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

        mat.uniforms.pointScale.value = dynamicPointScale;
        mat.userData.basePointScale = dynamicPointScale;
        this.pointCloudMaterials.add(mat);

        points.material = mat;
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
