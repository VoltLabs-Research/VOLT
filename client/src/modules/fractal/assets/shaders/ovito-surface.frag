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

#ifdef USE_COLOR_ALPHA
varying vec4 vSurfaceColor;
#elif defined( USE_COLOR )
varying vec3 vSurfaceColor;
#endif

varying vec3 vEyeNormal;
varying vec3 vEyePosition;

uniform vec3 uColor;
uniform float uOpacity;

// Transcribed from OVITO's only surface shading model, which every mesh, cylinder
// and impostor primitive routes through:
// ovito/src/ovito/opengl/resources/glsl/shading.frag -> outputShadedRay().
//
// It is a camera-attached headlight with a flat ambient floor: no shadows, no
// ambient occlusion, no image-based lighting, no tone mapping. `abs()` on the
// diffuse term is what makes it two-sided for free -- back faces are lit exactly
// like front faces, which is why an open or inside-out mesh never shows up as a
// black interior in OVITO.
const float OVITO_AMBIENT = 0.4;
const float OVITO_DIFFUSE_STRENGTH = 0.6;
const float OVITO_SHININESS = 6.0;
const float OVITO_SPECULAR_SCALE = 0.25;

// normalize(vec3(-1.8, 1.5, -0.2)), folded here because GLSL ES 1.00 does not
// guarantee constant folding of built-ins inside a const initializer.
const vec3 OVITO_SPECULAR_LIGHTDIR = vec3(-0.76543786, 0.63786488, -0.08504865);

void main(){
    #include <clipping_planes_fragment>

    vec3 baseColor = uColor;
    float alpha = uOpacity;

    #ifdef USE_COLOR_ALPHA
    baseColor *= vSurfaceColor.rgb;
    alpha *= vSurfaceColor.a;
    #elif defined( USE_COLOR )
    baseColor *= vSurfaceColor;
    #endif

    vec3 surfaceNormal = normalize(vEyeNormal);

    // OVITO reconstructs this ray from the inverse projection matrix; the
    // interpolated eye-space position is the same ray, already available here.
    vec3 rayDirection = isOrthographic
        ? vec3(0.0, 0.0, -1.0)
        : normalize(vEyePosition);

    float specular = pow(
        max(0.0, dot(reflect(OVITO_SPECULAR_LIGHTDIR, surfaceNormal), rayDirection)),
        OVITO_SHININESS
    ) * OVITO_SPECULAR_SCALE;
    float diffuse = abs(surfaceNormal.z) * OVITO_DIFFUSE_STRENGTH;

    gl_FragColor = vec4(baseColor * (diffuse + OVITO_AMBIENT) + vec3(specular), alpha);
}
