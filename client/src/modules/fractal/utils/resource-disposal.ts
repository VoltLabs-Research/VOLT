import * as THREE from 'three';

const isTexture = (value: unknown): value is THREE.Texture => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    return 'isTexture' in value && value.isTexture === true;
};

const disposeTextureValue = (
    value: unknown,
    disposedTextures: Set<THREE.Texture>
) => {
    if (Array.isArray(value)) {
        value.forEach((item) => disposeTextureValue(item, disposedTextures));
        return;
    }

    if (!isTexture(value) || disposedTextures.has(value)) {
        return;
    }

    disposedTextures.add(value);
    value.dispose();
};

const disposeSingleMaterial = (
    material: THREE.Material,
    disposedMaterials: Set<THREE.Material>,
    disposedTextures: Set<THREE.Texture>
) => {
    if (disposedMaterials.has(material)) {
        return;
    }

    disposedMaterials.add(material);

    Object.values(material).forEach((value) => {
        disposeTextureValue(value, disposedTextures);
    });

    if (material instanceof THREE.ShaderMaterial) {
        Object.values(material.uniforms).forEach((uniform) => {
            disposeTextureValue(uniform.value, disposedTextures);
        });
    }

    material.dispose();
};

export const disposeMaterialResources = (
    materialOrMaterials: THREE.Material | THREE.Material[]
) => {
    const disposedMaterials = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();
    let materials: THREE.Material[];
    if (Array.isArray(materialOrMaterials)) {
        materials = materialOrMaterials;
    } else {
        materials = [materialOrMaterials];
    }

    materials.forEach((material) => {
        disposeSingleMaterial(material, disposedMaterials, disposedTextures);
    });
};

export const disposeObject3DResources = (object: THREE.Object3D) => {
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    object.traverse((child) => {
        if (
            child instanceof THREE.Mesh ||
            child instanceof THREE.Points ||
            child instanceof THREE.Line
        ) {
            if (
                child.geometry instanceof THREE.BufferGeometry &&
                !disposedGeometries.has(child.geometry)
            ) {
                disposedGeometries.add(child.geometry);
                child.geometry.dispose();
            }

            let materials: THREE.Material[];
            if (Array.isArray(child.material)) {
                materials = child.material;
            } else {
                materials = [child.material];
            }

            materials.forEach((material) => {
                disposeSingleMaterial(material, disposedMaterials, disposedTextures);
            });
        }
    });
};
