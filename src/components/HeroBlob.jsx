"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";

// Simplex-style 3D noise
function createNoise() {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  return function noise3D(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
           lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w
    );
  };
}

export default function HeroBlob() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // The canvas sits on top of a CSS radial gradient glow (see render below)
    const canvasWrap = container.querySelector("[data-blob-canvas]");
    if (!canvasWrap) return;

    const noise = createNoise();

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    canvasWrap.appendChild(renderer.domElement);

    // Post-processing — bloom for soft edge glow
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.renderToScreen = true;

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.35,  // strength — gentle edge glow
      1.5,   // radius — spread it wide
      0.18   // threshold
    );
    composer.addPass(bloomPass);

    // Blob geometry — merge vertices for smooth shading, then compute smooth normals
    const rawGeometry = new THREE.IcosahedronGeometry(1.8, 40);
    const geometry = mergeVertices(rawGeometry);
    geometry.computeVertexNormals();
    rawGeometry.dispose();
    const basePositions = Float32Array.from(geometry.attributes.position.array);

    // Gradient shader material — lighter blue with depth
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLightPos1: { value: new THREE.Vector3(4, 2, 4) },
        uLightPos2: { value: new THREE.Vector3(-3, -1, 3) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying float vFresnel;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vec3 viewDir = normalize(cameraPosition - worldPos.xyz);
          vFresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uLightPos1;
        uniform vec3 uLightPos2;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying float vFresnel;

        void main() {
          // Base gradient: dark blue core to lighter blue at edges
          vec3 deepBlue = vec3(0.03, 0.06, 0.14);
          vec3 midBlue = vec3(0.06, 0.16, 0.38);
          vec3 lightBlue = vec3(0.12, 0.30, 0.58);
          vec3 highlight = vec3(0.25, 0.50, 0.80);

          // Fresnel-based gradient — edges are lighter
          float f = pow(vFresnel, 1.5);
          vec3 baseColor = mix(midBlue, lightBlue, f);

          // Diffuse lighting from two light sources
          vec3 lightDir1 = normalize(uLightPos1 - vWorldPos);
          vec3 lightDir2 = normalize(uLightPos2 - vWorldPos);
          float diff1 = max(dot(vNormal, lightDir1), 0.0);
          float diff2 = max(dot(vNormal, lightDir2), 0.0);
          float diffuse = diff1 * 0.7 + diff2 * 0.4;

          // Blend diffuse lighting into color
          vec3 color = mix(deepBlue, baseColor, 0.4 + diffuse * 0.6);

          // Specular highlight — soft, broad
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 halfDir1 = normalize(lightDir1 + viewDir);
          float spec = pow(max(dot(vNormal, halfDir1), 0.0), 25.0) * 0.35;
          color += highlight * spec;

          // Fresnel rim glow
          color += lightBlue * pow(vFresnel, 3.0) * 0.35;

          // Subtle emissive so it doesn't go full black in shadow
          color += deepBlue * 0.3;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(2.2, -0.3, 0);
    scene.add(mesh);

    // Lights (for bloom interaction — the shader handles its own lighting)
    const ambient = new THREE.AmbientLight(0x2a3a5a, 0.5);
    scene.add(ambient);

    const light1 = new THREE.PointLight(0x4488cc, 50, 30);
    light1.position.set(4, 2, 4);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x2255aa, 35, 30);
    light2.position.set(-3, -1, 3);
    scene.add(light2);

    const light3 = new THREE.PointLight(0x3366aa, 25, 30);
    light3.position.set(0, 3, -2);
    scene.add(light3);

    // Animation
    let animId;
    const pos = geometry.attributes.position;

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = performance.now() * 0.0004;

      // Morph vertices — original blobby displacement
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const bx = basePositions[ix], by = basePositions[ix + 1], bz = basePositions[ix + 2];
        const displacement = noise(bx * 1.5 + t, by * 1.5 + t * 0.7, bz * 1.5 + t * 0.5);
        const scale = 1 + displacement * 0.22;
        pos.array[ix] = bx * scale;
        pos.array[ix + 1] = by * scale;
        pos.array[ix + 2] = bz * scale;
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();

      material.uniforms.uTime.value = t;
      mesh.rotation.y = t * 0.3;
      mesh.rotation.x = Math.sin(t * 0.5) * 0.15;

      composer.render();
    }
    animate();

    // Resize handler
    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      composer.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (canvasWrap.contains(renderer.domElement)) {
        canvasWrap.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* WebGL canvas layer — renders first, behind glow */}
      <div data-blob-canvas className="absolute inset-0" />
      {/* Wide ambient glow on top of canvas, covers full background */}
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background: "radial-gradient(ellipse 90% 80% at 65% 50%, rgba(25,90,200,0.40) 0%, rgba(18,70,155,0.25) 25%, rgba(12,50,115,0.14) 45%, rgba(6,25,70,0.06) 65%, transparent 85%)",
        }}
      />
      {/* Tighter glow centered on the blob */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-20%",
          right: "-25%",
          width: "100%",
          height: "140%",
          background: "radial-gradient(ellipse at center, rgba(35,110,220,0.30) 0%, rgba(25,80,175,0.15) 30%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />
      {/* Left-side fade to protect text readability */}
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background: "linear-gradient(to right, rgba(9,9,11,0.95) 0%, rgba(9,9,11,0.7) 35%, rgba(9,9,11,0.3) 50%, transparent 65%)",
        }}
      />
    </div>
  );
}
