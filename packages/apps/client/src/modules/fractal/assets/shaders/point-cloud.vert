#include <clipping_planes_pars_vertex>

uniform float pointScale;
uniform float uMinPointSize;

attribute float aVisible;

varying vec3 vColor;
varying vec3 vWorldPosition;
varying float vVisible;

/**
 * Vertex shader for point sprite rendering. The GLB streamed from the server
 * already carries baked vertex colors (default / color-coding / particle-filter
 * endpoints all produce a fully coloured point cloud), so the shader forwards
 * `color` to the fragment stage as `vColor`. VOLT models store it as RGBA8, which three
 * declares as `vec4 color` (USE_COLOR_ALPHA); other glTFs and the fallback use `vec3`.
 * Points take their opacity from a uniform, so only `.rgb` is read either way.
 */
void main(){
    vColor = color.rgb;
    vVisible = aVisible;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;

    float modelScale = length(modelMatrix[0].xyz);
    float perspectivePointSize = pointScale * modelScale * (300.0 / -mvPosition.z);
    // Why: perspective shrinks `gl_PointSize` without a floor, so atoms fall
    // below 1 px at normal zoom for big simulation cells. Clamp to a minimum
    // so they never vanish just because the camera framed the full cell.
    gl_PointSize = max(uMinPointSize, perspectivePointSize);

    #include <clipping_planes_vertex>
}
