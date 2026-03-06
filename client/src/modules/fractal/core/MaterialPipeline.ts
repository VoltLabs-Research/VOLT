import * as THREE from 'three';
import vertexShader from '@/modules/fractal/presentation/assets/shaders/point-cloud.vert?raw';
import fragmentShader from '@/modules/fractal/presentation/assets/shaders/point-cloud.frag?raw';
import { disposeMaterialResources } from './resource-disposal';

export class MaterialPipeline {
    private cache = new Map<string, THREE.MeshStandardMaterial>();
    private pointCloudMaterials = new Set<THREE.ShaderMaterial>();

    configurePointCloud(points: THREE.Points) {
        const mat = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                cameraPosition: { value: new THREE.Vector3() },
                ambientFactor: { value: 0.7 },
                diffuseFactor: { value: 0.6 },
                specularFactor: { value: 0.1 },
                shininess: { value: 50.0 },
                rimFactor: { value: 0.05 },
                rimPower: { value: 2.0 },
                pointScale: { value: 1.0 },
                opacity: { value: 1.0 }
            },
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

        (mat.uniforms.pointScale as any).value = dynamicPointScale;
        mat.userData.basePointScale = dynamicPointScale;
        this.pointCloudMaterials.add(mat);

        points.material = mat;
        return points;
    }

    detectPointCloud(root: THREE.Group): THREE.Points | null {
        let pointClouds: THREE.Points | null = null;
        root.traverse((child) => {
            if (child instanceof THREE.Points) {
                pointClouds = child;
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

        (material as any).clippingPlanes = clippingPlanes;

        (material as any).precision = 'highp';
        (material as any).userData.isOptimized = true;
        this.cache.set(key, material as THREE.MeshStandardMaterial);

        return material as THREE.MeshStandardMaterial;
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
}
