/**
 * Copyright (c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#include <clipping_planes_pars_fragment>
#include <volt/atom-common>

varying vec3 vColor;
varying vec3 vWorldPosition;

uniform float ambientFactor;
uniform float diffuseFactor;
uniform float specularFactor;
uniform float shininess;
uniform float rimFactor;
uniform float rimPower;
uniform float edgeSoftness;
uniform float lightingMix;
uniform float opacity;

/**
 * Fragment shader for rendering circular point sprites with a "fake sphere"
 * normal reconstructed from `gl_PointCoord`. Delegates lighting to the
 * phongSphereImpostor helper from volt/atom-common.
*/
void main(){
    #include <clipping_planes_fragment>

    vec2 coord = gl_PointCoord - vec2(0.5);
    float radius = length(coord);
    if(radius > 0.5) discard;

    float z = sqrt(0.25 - dot(coord, coord));
    vec3 fakeNormal = normalize(vec3(coord.x, coord.y, z));
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));

    vec3 litColor = phongSphereImpostor(
        vColor,
        fakeNormal,
        lightDir,
        viewDir,
        ambientFactor,
        diffuseFactor,
        specularFactor * opacity,
        shininess,
        rimFactor * opacity,
        rimPower
    );

    vec3 finalColor = mix(vColor, litColor, lightingMix);
    float alphaFactor = edgeSoftness > 0.0
        ? smoothstep(0.5, 0.5 - edgeSoftness, radius)
        : 1.0;

    gl_FragColor = vec4(finalColor, opacity * alphaFactor);
}
