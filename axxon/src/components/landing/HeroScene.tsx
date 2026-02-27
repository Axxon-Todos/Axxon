'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

function OrbCluster({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    if (reducedMotion) return;

    const handlePointerMove = (event: PointerEvent) => {
      pointer.current.targetX = (event.clientX / window.innerWidth - 0.5) * 0.45;
      pointer.current.targetY = (event.clientY / window.innerHeight - 0.5) * 0.35;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [reducedMotion]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group || reducedMotion) return;

    pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, pointer.current.targetX, 0.07);
    pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, pointer.current.targetY, 0.07);

    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, pointer.current.y, 0.08);
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, pointer.current.x, 0.08);
    group.rotation.z += delta * 0.04;
  });

  return (
    <group ref={groupRef} position={[0, 0, -1.6]}>
      <Float speed={reducedMotion ? 0 : 1.1} rotationIntensity={0.45} floatIntensity={0.8}>
        <mesh position={[-2.3, 0.8, 0]}>
          <icosahedronGeometry args={[1.1, 1]} />
          <meshStandardMaterial
            color="#1fb4a6"
            metalness={0.45}
            roughness={0.2}
            emissive="#1fb4a6"
            emissiveIntensity={0.18}
          />
        </mesh>
      </Float>

      <Float speed={reducedMotion ? 0 : 0.95} rotationIntensity={0.3} floatIntensity={1}>
        <mesh position={[2.2, -0.6, 0.5]}>
          <torusKnotGeometry args={[0.85, 0.28, 120, 18]} />
          <meshStandardMaterial
            color="#f28f47"
            metalness={0.5}
            roughness={0.25}
            emissive="#f28f47"
            emissiveIntensity={0.15}
          />
        </mesh>
      </Float>

      <Float speed={reducedMotion ? 0 : 1.4} rotationIntensity={0.35} floatIntensity={0.9}>
        <mesh position={[0.2, 1.7, -0.7]}>
          <dodecahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial
            color="#3878e0"
            metalness={0.4}
            roughness={0.28}
            emissive="#3878e0"
            emissiveIntensity={0.12}
          />
        </mesh>
      </Float>
    </group>
  );
}

export default function HeroScene() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="h-full w-full pointer-events-none" aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6.7], fov: 44 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[3.4, 3.8, 5.5]} intensity={1.3} color="#fff2df" />
          <pointLight position={[-4.2, -0.5, 2.4]} intensity={1.2} color="#52b8f6" />

          <Stars
            radius={95}
            depth={35}
            count={reducedMotion ? 700 : 1900}
            factor={2.2}
            saturation={0.2}
            fade
            speed={reducedMotion ? 0 : 0.35}
          />

          <OrbCluster reducedMotion={Boolean(reducedMotion)} />
        </Suspense>
      </Canvas>
    </div>
  );
}
