import { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform vec2  iResolution;
  uniform float iTime;
  uniform vec2  iMouse;
  uniform float iDark;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),             hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv    = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    vec2 mouse = (iMouse          - 0.5 * iResolution.xy) / iResolution.y;

    float t = iTime * 0.055;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Mouse glow
    float mouseGlow = smoothstep(0.7, 0.0, length(uv - mouse)) * 0.8;

    // Two noise layers drifting in opposite directions
    float n1 = smoothNoise(uv * 1.2 + vec2( t * 0.35,  t * 0.28));
    float n2 = smoothNoise(uv * 2.2 + vec2(-t * 0.18,  t * 0.42));
    float pattern = n1 * 0.65 + n2 * 0.35;

    // Radial mask — wide falloff so sides stay lit
    float radial = smoothstep(0.0, 0.15, r) * smoothstep(1.3, 0.5, r);

    // Colour palette: indigo / teal / purple — matches the app tokens
    vec3 indigo = vec3(0.388, 0.400, 0.945);  // #6366f1
    vec3 teal   = vec3(0.082, 0.722, 0.651);  // #14b8a6
    vec3 purple = vec3(0.659, 0.333, 0.969);  // #a855f7

    float shift = sin(a * 2.0 + t * 0.6) * 0.5 + 0.5;
    vec3 accent = mix(indigo, teal, shift);
    accent      = mix(accent, purple, smoothstep(0.3, 0.75, n1));

    float strength = iDark > 0.5 ? 1.3 : 0.5;
    float intensity = (pattern * radial + mouseGlow) * strength;

    gl_FragColor = vec4(accent * intensity, 1.0);
  }
`;

export default function ShaderBackground({ isDark = true }) {
  const containerRef = useRef(null);
  const uniformsRef  = useRef(null);

  // Keep iDark uniform in sync without rebuilding the scene
  useEffect(() => {
    if (uniformsRef.current) {
      uniformsRef.current.iDark.value = isDark ? 1.0 : 0.0;
    }
  }, [isDark]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const clock  = new THREE.Clock();

    const uniforms = {
      iTime:       { value: 0 },
      iResolution: { value: new THREE.Vector2() },
      iMouse:      { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
      iDark:       { value: isDark ? 1.0 : 0.0 },
    };
    uniformsRef.current = uniforms;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true });
    scene.add(new THREE.Mesh(geometry, material));

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      uniforms.iResolution.value.set(w, h);
    };
    window.addEventListener("resize", onResize);
    onResize();

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      uniforms.iMouse.value.set(
        e.clientX - rect.left,
        rect.height - (e.clientY - rect.top),
      );
    };
    window.addEventListener("mousemove", onMouseMove);

    renderer.setAnimationLoop(() => {
      uniforms.iTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.setAnimationLoop(null);
      const canvas = renderer.domElement;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      uniformsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
    />
  );
}
