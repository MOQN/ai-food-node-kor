uniform sampler2D tColor;

varying vec2 vSampleUv;
varying vec2 vLocalUv;
varying float vAlphaMask;

void main() {
  vec4 texColor = texture2D(tColor, vSampleUv);

  vec3 baseColor = texColor.rgb;
  if (texColor.a > .0001) {
    baseColor = clamp(texColor.rgb / texColor.a, 0., 1.);
  }

  vec2 centered = vLocalUv - .5;
  float dist = length(centered);
  float hardCircle = step(dist, .46);

  float alpha = texColor.a * hardCircle * vAlphaMask;
  if (alpha < .005) discard;

  gl_FragColor = vec4(baseColor * alpha, alpha);
}
