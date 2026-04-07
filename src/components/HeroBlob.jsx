"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
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
    container.appendChild(renderer.domElement);

    // Post-processing — bloom for glow effect
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      1.5,   // strength
      0.8,   // radius
      0.2    // threshold
    );
    composer.addPass(bloomPass);

    // Blob geometry — high subdivision, subtle displacement
    const geometry = new THREE.IcosahedronGeometry(1.8, 128);
    const basePositions = Float32Array.from(geometry.attributes.position.array);

    // Material — subtle reflections, not mirror-like
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0d1e35),
      roughness: 0.55,
      metalness: 0.3,
      emissive: new THREE.Color(0x1a4080),
      emissiveIntensity: 0.6,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(2.2, -0.3, 0);
    scene.add(mesh);

    // Glow shell — slightly larger, additive blended
    const glowGeometry = new THREE.IcosahedronGeometry(1.85, 64);
    const glowBasePositions = Float32Array.from(glowGeometry.attributes.position.array);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x3388dd),
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.position.copy(mesh.position);
    scene.add(glowMesh);

    // Outer haze shell — even larger for atmospheric glow
    const hazeGeometry = new THREE.IcosahedronGeometry(2.2, 32);
    const hazeBasePositions = Float32Array.from(hazeGeometry.attributes.position.array);
    const hazeMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x2266aa),
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const hazeMesh = new THREE.Mesh(hazeGeometry, hazeMaterial);
    hazeMesh.position.copy(mesh.position);
    scene.add(hazeMesh);

    // Lights — soft, diffuse
    const ambient = new THREE.AmbientLight(0x2a3a5a, 1.5);
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
    const glowPos = glowGeometry.attributes.position;
    const hazePos = hazeGeometry.attributes.position;

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = performance.now() * 0.0003;

      // Morph main blob vertices — subtle displacement (more spherical)
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        const bx = basePositions[ix], by = basePositions[ix + 1], bz = basePositions[ix + 2];
        const displacement = noise(bx * 1.2 + t, by * 1.2 + t * 0.6, bz * 1.2 + t * 0.4);
        const scale = 1 + displacement * 0.1;
        pos.array[ix] = bx * scale;
        pos.array[ix + 1] = by * scale;
        pos.array[ix + 2] = bz * scale;
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();

      // Morph glow shell to follow the blob loosely
      for (let i = 0; i < glowPos.count; i++) {
        const ix = i * 3;
        const bx = glowBasePositions[ix], by = glowBasePositions[ix + 1], bz = glowBasePositions[ix + 2];
        const displacement = noise(bx * 1.0 + t * 0.8, by * 1.0 + t * 0.5, bz * 1.0 + t * 0.3);
        const scale = 1 + displacement * 0.08;
        glowPos.array[ix] = bx * scale;
        glowPos.array[ix + 1] = by * scale;
        glowPos.array[ix + 2] = bz * scale;
      }
      glowPos.needsUpdate = true;

      // Morph haze
      for (let i = 0; i < hazePos.count; i++) {
        const ix = i * 3;
        const bx = hazeBasePositions[ix], by = hazeBasePositions[ix + 1], bz = hazeBasePositions[ix + 2];
        const displacement = noise(bx * 0.8 + t * 0.6, by * 0.8 + t * 0.4, bz * 0.8 + t * 0.2);
        const scale = 1 + displacement * 0.06;
        hazePos.array[ix] = bx * scale;
        hazePos.array[ix + 1] = by * scale;
        hazePos.array[ix + 2] = bz * scale;
      }
      hazePos.needsUpdate = true;

      mesh.rotation.y = t * 0.25;
      mesh.rotation.x = Math.sin(t * 0.4) * 0.1;
      glowMesh.rotation.copy(mesh.rotation);
      hazeMesh.rotation.copy(mesh.rotation);

      // Pulse the glow
      glowMaterial.opacity = 0.18 + Math.sin(t * 2) * 0.06;
      hazeMaterial.opacity = 0.10 + Math.sin(t * 1.5 + 1) * 0.04;

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
      glowGeometry.dispose();
      hazeGeometry.dispose();
      material.dispose();
      glowMaterial.dispose();
      hazeMaterial.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
