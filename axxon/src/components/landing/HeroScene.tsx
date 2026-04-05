// Renders the landing-page 3D hero scene that visualizes agents, work lanes, and repo-linked execution flow.
'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, Sparkles, Stars } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

function FloatingAgentSystem({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    if (reducedMotion) return;

    const handlePointerMove = (event: PointerEvent) => {
      pointer.current.targetX = (event.clientX / window.innerWidth - 0.5) * 0.5;
      pointer.current.targetY = (event.clientY / window.innerHeight - 0.5) * 0.35;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [reducedMotion]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (!reducedMotion) {
      pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, pointer.current.targetX, 0.06);
      pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, pointer.current.targetY, 0.06);
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, pointer.current.y, 0.08);
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, pointer.current.x, 0.08);
      group.rotation.z += delta * 0.08;
    }

    group.position.y = THREE.MathUtils.lerp(
      group.position.y,
      reducedMotion ? 0 : Math.sin(Date.now() * 0.00045) * 0.08,
      0.05
    );
  });

  const links = useMemo(
    () => [
      [[-2.45, 1.25, -0.8], [0, 0, 0]],
      [[-2.45, 0, -0.45], [0, 0, 0]],
      [[-2.45, -1.25, -0.25], [0, 0, 0]],
      [[2.45, 1.15, 0.55], [0.2, 0.1, 0]],
      [[2.45, -0.05, 0.65], [0.2, 0.1, 0]],
      [[2.45, -1.2, 0.8], [0.2, 0.1, 0]],
      [[0, 0, 0], [0, 1.95, -0.65]],
    ],
    []
  );

  const sideNodes = [
    { position: [-2.45, 1.25, -0.8], color: '#b7f06d' },
    { position: [-2.45, 0, -0.45], color: '#2fd087' },
    { position: [-2.45, -1.25, -0.25], color: '#45e0a5' },
    { position: [2.45, 1.15, 0.55], color: '#2fd087' },
    { position: [2.45, -0.05, 0.65], color: '#b7f06d' },
    { position: [2.45, -1.2, 0.8], color: '#7df6bc' },
    { position: [0, 1.95, -0.65], color: '#d7ffd2' },
  ];

  const lanes = [
    { position: [-2.4, 1.25, -1], scale: 0.86 },
    { position: [-2.4, 0, -0.65], scale: 1 },
    { position: [-2.4, -1.25, -0.3], scale: 0.9 },
    { position: [2.4, 1.15, 0.35], scale: 0.86 },
    { position: [2.4, -0.05, 0.55], scale: 1 },
    { position: [2.4, -1.2, 0.8], scale: 0.9 },
  ];

  return (
    <group ref={groupRef} position={[0, 0, -0.2]}>
      <Float speed={reducedMotion ? 0 : 1.1} rotationIntensity={0.55} floatIntensity={0.9}>
        <mesh>
          <icosahedronGeometry args={[0.82, 1]} />
          <meshStandardMaterial
            color="#31d48c"
            metalness={0.45}
            roughness={0.16}
            emissive="#31d48c"
            emissiveIntensity={0.3}
          />
        </mesh>
      </Float>

      <Float speed={reducedMotion ? 0 : 0.8} rotationIntensity={0.35} floatIntensity={0.45}>
        <mesh rotation={[0.8, 0.2, 0.6]}>
          <torusGeometry args={[1.3, 0.06, 24, 180]} />
          <meshStandardMaterial
            color="#c5ff8a"
            metalness={0.35}
            roughness={0.22}
            emissive="#c5ff8a"
            emissiveIntensity={0.18}
            transparent
            opacity={0.9}
          />
        </mesh>
      </Float>

      <Float speed={reducedMotion ? 0 : 1.25} rotationIntensity={0.25} floatIntensity={0.35}>
        <mesh position={[0, 1.95, -0.65]}>
          <sphereGeometry args={[0.11, 32, 32]} />
          <meshStandardMaterial
            color="#f5ffe6"
            emissive="#f5ffe6"
            emissiveIntensity={0.55}
          />
        </mesh>
      </Float>

      {lanes.map((lane) => (
        <Float
          key={lane.position.join('-')}
          speed={reducedMotion ? 0 : 0.75}
          rotationIntensity={0.15}
          floatIntensity={0.28}
        >
          <group position={lane.position as [number, number, number]} scale={lane.scale}>
            <mesh>
              <boxGeometry args={[1.15, 0.22, 0.7]} />
              <meshStandardMaterial
                color="#10241c"
                metalness={0.2}
                roughness={0.42}
                emissive="#10241c"
                emissiveIntensity={0.12}
                transparent
                opacity={0.92}
              />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.82, 0.05, 0.18]} />
              <meshStandardMaterial color="#d9ffe7" emissive="#d9ffe7" emissiveIntensity={0.18} />
            </mesh>
            <mesh position={[-0.25, -0.03, 0]}>
              <boxGeometry args={[0.28, 0.05, 0.18]} />
              <meshStandardMaterial color="#31d48c" emissive="#31d48c" emissiveIntensity={0.18} />
            </mesh>
          </group>
        </Float>
      ))}

      {sideNodes.map((node) => (
        <mesh key={node.position.join('-')} position={node.position as [number, number, number]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.4} />
        </mesh>
      ))}

      {links.map((line, index) => (
        <Line
          key={index}
          points={line as Array<[number, number, number]>}
          color={index % 2 === 0 ? '#31d48c' : '#c5ff8a'}
          transparent
          opacity={0.55}
          lineWidth={1.4}
        />
      ))}
    </group>
  );
}

export default function HeroScene() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none h-full w-full" aria-hidden>
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, 6.4], fov: 40 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#000000']} />
          <fog attach="fog" args={['#04100b', 6.5, 12]} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[5.5, 4.2, 5]} intensity={1.45} color="#f6fff1" />
          <pointLight position={[-4.5, 0.5, 2.5]} intensity={1.7} color="#2fd087" />
          <pointLight position={[3.5, 2.2, 2.6]} intensity={1.2} color="#c5ff8a" />

          <Stars
            radius={90}
            depth={38}
            count={reducedMotion ? 500 : 1600}
            factor={2.6}
            saturation={0.15}
            fade
            speed={reducedMotion ? 0 : 0.45}
          />

          <Sparkles
            count={reducedMotion ? 18 : 34}
            scale={[9, 6, 5]}
            size={2.6}
            speed={reducedMotion ? 0 : 0.5}
            color="#d7ffd2"
            opacity={0.75}
          />

          <FloatingAgentSystem reducedMotion={Boolean(reducedMotion)} />
        </Suspense>
      </Canvas>
    </div>
  );
}
