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

#include <clipping_planes_pars_vertex>

#ifdef USE_COLOR_ALPHA
attribute vec4 color;
varying vec4 vSurfaceColor;
#elif defined( USE_COLOR )
attribute vec3 color;
varying vec3 vSurfaceColor;
#endif

varying vec3 vEyeNormal;
varying vec3 vEyePosition;

/**
 * Vertex stage for the OVITO-equivalent surface shading. Both terms the fragment
 * stage needs live in eye space, so the normal goes through `normalMatrix` and the
 * position is kept as the raw eye-space coordinate (which doubles as the view ray).
 */
void main(){
    #if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )
    vSurfaceColor = color;
    #endif

    vEyeNormal = normalMatrix * normal;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vEyePosition = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;

    #include <clipping_planes_vertex>
}
