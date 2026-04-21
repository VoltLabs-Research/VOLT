// Shared atom rendering helpers. Assumes lights from a single directional light.
// Returns the shaded color combining ambient + diffuse + specular + rim.

vec3 phongSphereImpostor(
    vec3 baseColor,
    vec3 normal,
    vec3 lightDir,
    vec3 viewDir,
    float ambientFactor,
    float diffuseFactor,
    float specularFactor,
    float shininess,
    float rimFactor,
    float rimPower
){
    float diffuse = max(0.0, dot(normal, lightDir));
    vec3 ambientColor = baseColor * ambientFactor;
    vec3 diffuseColor = baseColor * diffuse * diffuseFactor;
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0), shininess);
    vec3 specularColor = vec3(0.8) * spec * specularFactor;
    float rimDot = 1.0 - max(dot(viewDir, normal), 0.0);
    float rim = pow(rimDot, rimPower);
    vec3 rimColor = vec3(0.5) * rim * rimFactor;
    return ambientColor + diffuseColor + specularColor * 0.3 + rimColor * 0.2;
}
