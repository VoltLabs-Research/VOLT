/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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

void main(){
    #include <clipping_planes_fragment>

    vec2 coord = gl_PointCoord - vec2(0.5);
    
    if(length(coord) > 0.5) discard;
    
    float z = sqrt(0.25 - dot(coord, coord));
    
    vec3 fakeNormal = normalize(vec3(coord.x, coord.y, z));
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    
    // Iluminación difusa más sutil
    float diffuse = max(0.0, dot(fakeNormal, lightDir));
    
    // Aumentar el factor ambiental para colores más sólidos
    vec3 ambientColor = vColor * ambientFactor;
    vec3 diffuseColor = vColor * diffuse * diffuseFactor;
    
    // Reducir drásticamente la especularidad
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(fakeNormal, halfwayDir), 0.0), shininess);
    vec3 specularColor = vec3(0.8) * spec * specularFactor; // Reducido de vec3(1.0) a vec3(0.8)
    
    // Reducir el rim lighting
    float rimDot = 1.0 - max(dot(viewDir, fakeNormal), 0.0);
    float rim = pow(rimDot, rimPower);
    vec3 rimColor = vec3(0.5) * rim * rimFactor; // Reducido de vec3(1.0) a vec3(0.5)
    
    // Combinar colores con mayor peso en el color base
    vec3 finalColor = ambientColor + diffuseColor + specularColor * 0.3 + rimColor * 0.2;
    
    // Eliminar la corrección gamma para colores más saturados
    gl_FragColor = vec4(finalColor, 1.0);
}