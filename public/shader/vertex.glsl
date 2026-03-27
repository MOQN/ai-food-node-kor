uniform sampler2D tDepth;
uniform float uTime;
uniform float uProgress;
uniform float uPhase;
uniform float uVisible;
uniform float uWindDirectionX;
uniform float uIdleOrbitRadius;
uniform float uIdleOrbitSpeedMin;
uniform float uIdleOrbitSpeedMax;
uniform float uDepthScale;
uniform float uDepthInvert;
uniform float uScatterRadiusXY;
uniform float uScatterRadiusZ;
uniform float uIncomingDepthOffset;
uniform float uOutgoingDepthOffset;
uniform float uIncomingStartXOffset;
uniform float uOutgoingEndXOffset;
uniform float uZMin;
uniform float uZMax;

attribute vec3 offset;
attribute vec2 aUv;
attribute float aRandom;

varying vec2 vSampleUv;
varying vec2 vLocalUv;
varying float vAlphaMask;

float hash11(float p) {
  p = fract(p * .1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec3 depthToGatheredCenter(sampler2D depthTex, vec2 uv) {
  vec4 depthSample = texture2D(depthTex, uv);
  float depthValue = mix(depthSample.r, 1. - depthSample.r, uDepthInvert);
  float centeredDepth = (depthValue - .5) * 2.;
  float zDisplacement = centeredDepth * uDepthScale;
  float yDisplacement = centeredDepth * uDepthScale * .9;

  vec3 gathered = offset;
  gathered.y += yDisplacement;
  gathered.z += zDisplacement;
  return gathered;
}

vec3 windScatter(vec3 gatheredCenter, float rnd, float progress, float directionSign) {
  float az = hash11(rnd + .13) * 6.28318530718;
  float z = hash11(rnd + .37) * 2. - 1.;
  float r = sqrt(max(0., 1. - z * z));
  vec3 unitDir = vec3(cos(az) * r, sin(az) * r, z);

  float radialDist = pow(hash11(rnd + 1.91), .55);
  float radiusXY = mix(.25, 1., radialDist) * uScatterRadiusXY;
  float radiusZ = mix(.2, 1., radialDist) * uScatterRadiusZ;

  float burstScale = mix(1., 1.25, progress);
  radiusXY *= burstScale;
  radiusZ *= burstScale;

  float windBias = radiusXY * (0.75 + progress * 0.45) * directionSign * sign(uWindDirectionX);
  vec3 scatter = vec3(unitDir.x * radiusXY + windBias, unitDir.y * radiusXY, unitDir.z * radiusZ);

  float phaseA = hash11(rnd + 7.2) * 6.28318530718;
  float phaseB = hash11(rnd + 3.6) * 6.28318530718;
  float phaseC = hash11(rnd + 9.4) * 6.28318530718;

  vec3 wobble = vec3(
    sin(uTime * .73 + phaseA),
    cos(uTime * .91 + phaseB),
    sin(uTime * 1.07 + phaseC)
  );

  scatter += vec3(radiusXY * .14, radiusXY * .14, radiusZ * .18) * wobble;
  return gatheredCenter + scatter;
}

vec3 idleOrbit(float rnd, float gatheredWeight) {
  float speed = mix(uIdleOrbitSpeedMin, uIdleOrbitSpeedMax, hash11(rnd + 5.7));
  float phase = hash11(rnd + 8.3) * 6.28318530718;
  float angle = uTime * speed + phase;

  vec3 axis = normalize(vec3(
    hash11(rnd + 1.3) * 2. - 1.,
    hash11(rnd + 2.1) * 2. - 1.,
    hash11(rnd + 3.7) * 2. - 1.
  ));

  vec3 ref = abs(axis.y) < .99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.);
  vec3 tangent = normalize(cross(axis, ref));
  vec3 bitangent = normalize(cross(axis, tangent));

  float radius = uIdleOrbitRadius * mix(.35, 1., hash11(rnd + 9.9));
  return (tangent * cos(angle) + bitangent * sin(angle)) * radius * gatheredWeight;
}

void main() {
  vSampleUv = aUv;
  vLocalUv = uv;

  float progress = clamp(uProgress, 0., 1.);
  float offsetSeed = hash11(offset.x * .001 + offset.y * .003);
  float rnd = fract(aRandom + offsetSeed);

  vec3 gathered = depthToGatheredCenter(tDepth, aUv);
  vec3 scatterRight = windScatter(gathered, rnd, progress, 1.0);
  vec3 scatterLeft = windScatter(gathered, rnd + .271, 1. - progress, -1.0);
  float outgoingAlpha = 1.0 - smoothstep(0.02, 0.82, progress);
  float incomingAlpha = smoothstep(0.02, 0.82, progress);

  vec3 centerPos;
  float phaseAlpha;
  // uPhase 0.0: outgoing (gather -> right scatter).
  // uPhase 1.0: incoming (left scatter -> gather).
  if (uPhase < 0.5) {
    centerPos = mix(gathered, scatterRight, progress);
    centerPos += idleOrbit(rnd, 1. - progress);
    centerPos.x += uOutgoingEndXOffset * progress;
    centerPos.z += uOutgoingDepthOffset * progress;
    phaseAlpha = outgoingAlpha;
  } else {
    centerPos = mix(scatterLeft, gathered, progress);
    centerPos += idleOrbit(rnd + .43, progress);
    centerPos.x -= uIncomingStartXOffset * (1. - progress);
    centerPos.z += uIncomingDepthOffset * (1. - progress);
    phaseAlpha = incomingAlpha;
  }

  centerPos.z = clamp(centerPos.z, uZMin, uZMax);

  vAlphaMask = phaseAlpha * uVisible;

  float sizeFactor = mix(0.4, 2.0, hash11(rnd + 4.2));
  vec3 localPos = position * sizeFactor;
  vec3 worldPos = centerPos + localPos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.);
}
