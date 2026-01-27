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

varying vec3 vColor;
varying vec3 vWorldPosition;

uniform float ambientFactor;
uniform float diffuseFactor;
uniform float specularFactor;
uniform float shininess;
uniform float rimFactor;
uniform float rimPower;
uniform float opacity;

/**
 * Fragment shader for rendering cicular point sprites with a "fake sphere" normal
 * reconstructed from `gl_PointCoord`. Applies a stylized Phong-like lighting model
 * (ambient + diffuse + reduced specular) plus subtle rim lighting.
*/
void main(){
    #include <clipping_planes_fragment>

    // Recenter point coordinates so (0, 0) is sprite center.
    vec2 coord = gl_PointCoord - vec2(0.5);
    
    // Keep only fragments inside a radius-0.5 circle (circular sprite).
    if(length(coord) > 0.5) discard;
    
    // Reconstruct Z on a hemisphere of radius 0.5 to fake a spherical surface
    float z = sqrt(0.25 - dot(coord, coord));
    
    // Pseudo-normal in sprite-local space
    vec3 fakeNormal = normalize(vec3(coord.x, coord.y, z));
    
    // View direction in world space.
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    // Fixed directional light
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    
    float diffuse = max(0.0, dot(fakeNormal, lightDir));
    
    // Ambient and diffuse are color-tinted by vColor
    vec3 ambientColor = vColor * ambientFactor;
    vec3 diffuseColor = vColor * diffuse * diffuseFactor;
    
    // Specular (Blinn-Phong) - scaled by opacity to avoid bright highlights on transparent surfaces
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(fakeNormal, halfwayDir), 0.0), shininess);
    vec3 specularColor = vec3(0.8) * spec * specularFactor * opacity;
    
    // Rim lighting - scaled by opacity to avoid bright edges on transparent surfaces
    float rimDot = 1.0 - max(dot(viewDir, fakeNormal), 0.0);
    float rim = pow(rimDot, rimPower);
    vec3 rimColor = vec3(0.5) * rim * rimFactor * opacity; 
    
    // Final mix emphasizes the base color by down-weighting specular and rim.
    vec3 finalColor = ambientColor + diffuseColor + specularColor * 0.3 + rimColor * 0.2;
    
    gl_FragColor = vec4(finalColor, opacity);
}