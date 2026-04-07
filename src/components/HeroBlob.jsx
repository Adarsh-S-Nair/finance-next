"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Simplex-style 3D noise (compact implementation)
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

    // Blob geometry — high subdivision for smooth surface
    const geometry = new THREE.IcosahedronGeometry(1.8, 128);
    const basePositions = Float32Array.from(geometry.attributes.position.array);

    // Material — glossy dark with brighter blue reflections
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0f1f38),
      roughness: 0.15,
      metalness: 0.7,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      emissive: new THREE.Color(0x1a3a6a),
      emissiveIntensity: 0.4,
      reflectivity: 0.9,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(2.2, -0.3, 0); // Push blob to the right
    scene.add(mesh);

    // Lights — brighter for more definition
    const ambient = new THREE.AmbientLight(0x2a3a5a, 0.8);
    scene.add(ambient);

    const light1 = new THREE.PointLight(0x5599dd, 60, 30);
    light1.position.set(4, 2, 4);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x3366bb, 40, 30);
    light2.position.set(-3, -1, 3);
    scene.add(light2);

    const light3 = new THREE.PointLight(0x224466, 30, 30);
    light3.position.set(0, 3, -2);
    scene.add(light3);

    // Subtle rim light from behind
    const light4 = new THREE.PointLight(0x6699cc, 20, 30);
    light4.position.set(2, -2, -3);
    scene.add(light4);

    // Animation
    let animId;
    const pos = geometry.attributes.position;

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = performance.now() * 0.0004;

      // Morph vertices with noise
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

      mesh.rotation.y = t * 0.3;
      mesh.rotation.x = Math.sin(t * 0.5) * 0.15;

      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    function onResize() {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
