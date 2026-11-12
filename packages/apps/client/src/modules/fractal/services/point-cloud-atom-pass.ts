import * as THREE from 'three';
import { spriteReach, type SpriteSize } from '@/modules/fractal/services/point-cloud-block-drawing';

/**
 * Draws a point cloud's atoms without multisampling while the rest of the scene keeps it.
 * Multisampling multiplies the cost of every atom (2.2–2.9× the frame for 3.8M atoms) without
 * smoothing it: an atom's round edge comes from discarding pixels, which multisampling does not
 * soften. So when the points' turn to draw comes, their atoms are drawn into a target of their own
 * and a full-screen pass copies their colour and depth into whatever the scene is being drawn to
 * (the canvas, an effect buffer or a screenshot), where they meet the other objects by depth as
 * before. The copy is raw, as the atom shader's output is, so colours do not change.
 *
 * The atoms draw directly instead when they are see-through (blending needs what is behind them)
 * or when a pass replaces every material (the normal pass of ambient occlusion).
 */

const COPY_VERTEX = /* glsl */ `
uniform vec4 uRect;
void main(){
    // Only the part of the target the atoms can cover, in clip space.
    gl_Position = vec4(mix(uRect.xy, uRect.zw, position.xy * 0.5 + 0.5), 0.0, 1.0);
}`;

const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D uColor;
uniform sampler2D uDepth;
void main(){
    ivec2 pixel = ivec2(gl_FragCoord.xy);
    float depth = texelFetch(uDepth, pixel, 0).r;
    if (depth >= 1.0) discard;
    gl_FragColor = texelFetch(uColor, pixel, 0);
    gl_FragDepth = depth;
}`;


const targetSize = new THREE.Vector2();
const clearColor = new THREE.Color();
const corner = new THREE.Vector3();
const sphere = new THREE.Sphere();

// The atoms' target stores colour as the target they are copied into does (8 bits for the canvas,
// half floats for an effect buffer), so the copy is exact either way.
const createTarget = (type: THREE.TextureDataType): THREE.WebGLRenderTarget => {
    const depthTexture = new THREE.DepthTexture(1, 1);
    depthTexture.type = THREE.UnsignedIntType;
    return new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: true, depthTexture, samples: 0 });
};

export class PointCloudAtomPass {
    private target: THREE.WebGLRenderTarget;
    private readonly copyScene = new THREE.Scene();
    private readonly copyMaterial: THREE.ShaderMaterial;
    private drawing = false;

    constructor(private readonly points: THREE.Points) {
        this.target = createTarget(THREE.UnsignedByteType);
        this.copyMaterial = new THREE.ShaderMaterial({
            vertexShader: COPY_VERTEX,
            fragmentShader: COPY_FRAGMENT,
            uniforms: {
                uColor: { value: this.target.texture },
                uDepth: { value: this.target.depthTexture },
                uRect: { value: new THREE.Vector4(-1, -1, 1, 1) }
            },
            blending: THREE.NoBlending,
            depthTest: true,
            depthWrite: true,
            toneMapped: false
        });
        const copy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMaterial);
        copy.frustumCulled = false;
        this.copyScene.add(copy);
    }

    /** True while the atoms are being drawn into the pass's own target. */
    get drawingAtoms(): boolean {
        return this.drawing;
    }

    /** Whether the points draw straight into the scene's target in this draw. */
    drawsDirectly(drawMaterial: THREE.Material): boolean {
        const own = this.points.material;
        return drawMaterial !== own || (own instanceof THREE.Material && own.transparent);
    }

    /** Draws the atoms into the pass's target, then copies them into the scene's current target. */
    render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, size: SpriteSize): void {
        const outer = renderer.getRenderTarget();
        if (outer) targetSize.set(outer.width, outer.height);
        else renderer.getDrawingBufferSize(targetSize);
        const type = outer?.texture.type ?? THREE.UnsignedByteType;
        if (this.target.texture.type !== type) {
            this.disposeTarget();
            this.target = createTarget(type);
            this.copyMaterial.uniforms.uColor.value = this.target.texture;
            this.copyMaterial.uniforms.uDepth.value = this.target.depthTexture;
        }
        if (this.target.width !== targetSize.x || this.target.height !== targetSize.y) {
            this.target.setSize(targetSize.x, targetSize.y);
        }
        this.updateRect(camera, size);

        const autoClear = renderer.autoClear;
        const clearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(clearColor);
        renderer.autoClear = false;
        this.drawing = true;
        try {
            renderer.setRenderTarget(this.target);
            renderer.setClearColor(0x000000, 0);
            renderer.clear(true, true, false);
            renderer.render(this.points, camera);
        } finally {
            this.drawing = false;
            renderer.setClearColor(clearColor, clearAlpha);
            renderer.setRenderTarget(outer);
        }
        try {
            renderer.render(this.copyScene, camera);
        } finally {
            renderer.autoClear = autoClear;
        }
    }

    dispose(): void {
        this.copyScene.children.forEach((child) => {
            if (child instanceof THREE.Mesh) child.geometry.dispose();
        });
        this.copyMaterial.dispose();
        this.disposeTarget();
    }

    private disposeTarget(): void {
        this.target.depthTexture?.dispose();
        this.target.dispose();
    }

    // The clip-space rectangle the cloud's atoms and their sprites can cover, so the copy touches
    // only those pixels; the whole target when the camera is inside or close to the cloud.
    private updateRect(camera: THREE.Camera, size: SpriteSize): void {
        const rect = this.copyMaterial.uniforms.uRect.value as THREE.Vector4;
        rect.set(-1, -1, 1, 1);
        const geometry = this.points.geometry;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        if (!geometry.boundingSphere) return;
        sphere.copy(geometry.boundingSphere).applyMatrix4(this.points.matrixWorld);
        const depth = -corner.copy(sphere.center).applyMatrix4(camera.matrixWorldInverse).z;
        sphere.radius += spriteReach(size, depth - sphere.radius, depth + sphere.radius);
        if (!Number.isFinite(sphere.radius)) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let k = 0; k < 8; k += 1) {
            corner.set(
                sphere.center.x + (k & 1 ? sphere.radius : -sphere.radius),
                sphere.center.y + (k & 2 ? sphere.radius : -sphere.radius),
                sphere.center.z + (k & 4 ? sphere.radius : -sphere.radius)
            ).applyMatrix4(camera.matrixWorldInverse);
            // A corner at or behind the camera: the cloud can cover any part of the view.
            if (camera instanceof THREE.PerspectiveCamera && corner.z >= -camera.near) return;
            corner.applyMatrix4(camera.projectionMatrix);
            minX = Math.min(minX, corner.x);
            maxX = Math.max(maxX, corner.x);
            minY = Math.min(minY, corner.y);
            maxY = Math.max(maxY, corner.y);
        }
        rect.set(Math.max(-1, minX), Math.max(-1, minY), Math.min(1, maxX), Math.min(1, maxY));
    }
}
