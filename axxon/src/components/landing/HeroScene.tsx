// Renders the landing-page 3D control plane that visualizes Axxon's org, board, repo, agent, and review loop.
'use client';

import { type ReactNode, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, Sparkles } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

type Point3D = [number, number, number];

type FlowRoute = {
  color: string;
  curve: THREE.CatmullRomCurve3;
  key: string;
  size: number;
  speed: number;
  tracerOffset: number;
};

type ModuleCardProps = {
  accent: string;
  children: ReactNode;
  size: [number, number, number];
};

const COLORS = {
  accent: '#6366f1',
  accentSoft: '#818cf8',
  border: '#334155',
  cyan: '#22d3ee',
  foreground: '#e2e8f0',
  glow: '#bfdbfe',
  panel: '#0f172a',
  panelStrong: '#111827',
  review: '#38bdf8',
  success: '#34d399',
};

function createCurve(points: Point3D[]) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'catmullrom',
    0.12
  );
}

function ModuleCard({ accent, children, size }: ModuleCardProps) {
  const [width, height, depth] = size;
  const frontZ = depth / 2 + 0.012;
  const detailZ = depth / 2 + 0.024;

  return (
    <group>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={COLORS.panelStrong}
          metalness={0.2}
          roughness={0.34}
          emissive={COLORS.panelStrong}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0, 0, frontZ]}>
        <planeGeometry args={[width * 0.86, height * 0.8]} />
        <meshStandardMaterial
          color={COLORS.panel}
          metalness={0.08}
          roughness={0.54}
          emissive={COLORS.panel}
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh position={[-width * 0.18, height * 0.28, detailZ]}>
        <boxGeometry args={[width * 0.34, 0.055, 0.03]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[width * 0.26, height * 0.28, detailZ]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[width * 0.34, height * 0.28, detailZ]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial color={COLORS.border} emissive={COLORS.border} emissiveIntensity={0.12} />
      </mesh>
      {children}
    </group>
  );
}

function ControlPlaneBoard({ reducedMotion }: { reducedMotion: boolean }) {
  const columns = [
    { cards: [0.34, 0.08, -0.18, -0.46], color: COLORS.cyan, x: -0.86 },
    { cards: [0.2, -0.06, -0.34], color: COLORS.accent, x: 0 },
    { cards: [0.38, 0.02, -0.22], color: COLORS.success, x: 0.86 },
  ];

  return (
    <Float speed={reducedMotion ? 0 : 0.4} rotationIntensity={0.06} floatIntensity={0.1}>
      <group position={[0.05, 0.08, 0.02]} rotation={[-0.48, -0.28, 0.16]}>
        <mesh>
          <boxGeometry args={[2.9, 1.84, 0.18]} />
          <meshStandardMaterial
            color={COLORS.panelStrong}
            metalness={0.18}
            roughness={0.3}
            emissive={COLORS.panelStrong}
            emissiveIntensity={0.36}
          />
        </mesh>
        <mesh position={[0, 0, 0.102]}>
          <planeGeometry args={[2.72, 1.67]} />
          <meshStandardMaterial
            color={COLORS.panel}
            metalness={0.08}
            roughness={0.55}
            emissive={COLORS.panel}
            emissiveIntensity={0.22}
          />
        </mesh>
        <mesh position={[0, 0.72, 0.11]}>
          <boxGeometry args={[2.25, 0.08, 0.04]} />
          <meshStandardMaterial color={COLORS.border} emissive={COLORS.border} emissiveIntensity={0.16} />
        </mesh>
        <mesh position={[-0.94, 0.72, 0.125]}>
          <boxGeometry args={[0.54, 0.045, 0.03]} />
          <meshStandardMaterial color={COLORS.foreground} emissive={COLORS.foreground} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0.92, 0.72, 0.125]}>
          <boxGeometry args={[0.32, 0.045, 0.03]} />
          <meshStandardMaterial color={COLORS.accentSoft} emissive={COLORS.accentSoft} emissiveIntensity={0.48} />
        </mesh>

        {columns.map((column) => (
          <group key={column.x} position={[column.x, -0.04, 0.12]}>
            <mesh>
              <boxGeometry args={[0.72, 1.2, 0.06]} />
              <meshStandardMaterial
                color="#132033"
                metalness={0.05}
                roughness={0.62}
                emissive="#132033"
                emissiveIntensity={0.2}
              />
            </mesh>
            <mesh position={[0, 0.48, 0.04]}>
              <boxGeometry args={[0.42, 0.05, 0.03]} />
              <meshStandardMaterial color={column.color} emissive={column.color} emissiveIntensity={0.5} />
            </mesh>
            {column.cards.map((cardY, index) => (
              <group key={`${column.x}-${cardY}`} position={[0, cardY, 0.05]}>
                <mesh>
                  <boxGeometry args={[0.52, 0.14, 0.03]} />
                  <meshStandardMaterial
                    color={index === 0 ? '#dbeafe' : '#1e293b'}
                    emissive={index === 0 ? '#dbeafe' : '#1e293b'}
                    emissiveIntensity={index === 0 ? 0.16 : 0.12}
                  />
                </mesh>
                <mesh position={[-0.14, 0.002, 0.02]}>
                  <boxGeometry args={[0.12, 0.04, 0.02]} />
                  <meshStandardMaterial color={column.color} emissive={column.color} emissiveIntensity={0.42} />
                </mesh>
                <mesh position={[0.09, 0.002, 0.02]}>
                  <boxGeometry args={[0.18, 0.04, 0.02]} />
                  <meshStandardMaterial
                    color={index === 0 ? '#93c5fd' : COLORS.border}
                    emissive={index === 0 ? '#93c5fd' : COLORS.border}
                    emissiveIntensity={0.2}
                  />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
    </Float>
  );
}

function OrganizationModule({ reducedMotion }: { reducedMotion: boolean }) {
  const members: Array<[number, number]> = [
    [-0.26, 0.08],
    [0, 0.22],
    [0.27, 0.06],
    [-0.16, -0.18],
    [0.18, -0.18],
  ];

  return (
    <Float speed={reducedMotion ? 0 : 0.68} rotationIntensity={0.08} floatIntensity={0.18}>
      <group position={[-2.36, 1.28, -0.08]} rotation={[0.08, 0.38, -0.06]}>
        <ModuleCard accent={COLORS.cyan} size={[1.26, 0.9, 0.14]}>
          <mesh position={[0, 0, 0.09]}>
            <torusGeometry args={[0.33, 0.016, 16, 64]} />
            <meshStandardMaterial
              color={COLORS.cyan}
              emissive={COLORS.cyan}
              emissiveIntensity={0.3}
              transparent
              opacity={0.8}
            />
          </mesh>
          {members.map(([x, y], index) => (
            <mesh key={`${x}-${y}`} position={[x, y, 0.1]}>
              <sphereGeometry args={[index === 1 ? 0.07 : 0.055, 18, 18]} />
              <meshStandardMaterial
                color={index === 1 ? COLORS.foreground : COLORS.cyan}
                emissive={index === 1 ? COLORS.foreground : COLORS.cyan}
                emissiveIntensity={0.45}
              />
            </mesh>
          ))}
          <Line
            points={[
              [-0.26, 0.08, 0.1],
              [0, 0.22, 0.1],
              [0.27, 0.06, 0.1],
              [0.18, -0.18, 0.1],
              [-0.16, -0.18, 0.1],
              [-0.26, 0.08, 0.1],
            ]}
            color={COLORS.accentSoft}
            transparent
            opacity={0.42}
            lineWidth={1.2}
          />
        </ModuleCard>
      </group>
    </Float>
  );
}

function RepositoryModule({ reducedMotion }: { reducedMotion: boolean }) {
  const branchPoints: Point3D[] = [
    [-0.35, -0.16, 0.11],
    [-0.08, 0.04, 0.11],
    [0.18, -0.08, 0.11],
    [0.36, 0.16, 0.11],
  ];

  return (
    <Float speed={reducedMotion ? 0 : 0.54} rotationIntensity={0.06} floatIntensity={0.16}>
      <group position={[-2.4, -1.18, 0.16]} rotation={[0.18, 0.46, 0.08]}>
        <ModuleCard accent={COLORS.accentSoft} size={[1.36, 0.92, 0.14]}>
          <mesh position={[-0.05, 0.24, 0.11]}>
            <boxGeometry args={[0.68, 0.1, 0.03]} />
            <meshStandardMaterial
              color={COLORS.foreground}
              emissive={COLORS.foreground}
              emissiveIntensity={0.18}
            />
          </mesh>
          {[0.06, -0.16, -0.38].map((lineY, index) => (
            <group key={lineY} position={[-0.05, lineY, 0.11]}>
              <mesh>
                <boxGeometry args={[0.74 - index * 0.08, 0.09, 0.03]} />
                <meshStandardMaterial
                  color={index === 0 ? '#1d4ed8' : '#1e293b'}
                  emissive={index === 0 ? '#1d4ed8' : '#1e293b'}
                  emissiveIntensity={index === 0 ? 0.16 : 0.08}
                />
              </mesh>
              <mesh position={[-0.22, 0, 0.02]}>
                <boxGeometry args={[0.12, 0.04, 0.02]} />
                <meshStandardMaterial
                  color={index === 0 ? COLORS.cyan : COLORS.border}
                  emissive={index === 0 ? COLORS.cyan : COLORS.border}
                  emissiveIntensity={0.28}
                />
              </mesh>
            </group>
          ))}
          <Line
            points={branchPoints}
            color={COLORS.cyan}
            transparent
            opacity={0.52}
            lineWidth={1.4}
          />
          {branchPoints.map((point, index) => (
            <mesh key={point.join('-')} position={point}>
              <sphereGeometry args={[index === 1 ? 0.05 : 0.04, 16, 16]} />
              <meshStandardMaterial
                color={index === 1 ? COLORS.success : COLORS.cyan}
                emissive={index === 1 ? COLORS.success : COLORS.cyan}
                emissiveIntensity={0.42}
              />
            </mesh>
          ))}
        </ModuleCard>
      </group>
    </Float>
  );
}

function AgentModule({ reducedMotion }: { reducedMotion: boolean }) {
  const capsuleRows = [
    { color: COLORS.accent, y: 0.22 },
    { color: COLORS.cyan, y: -0.02 },
    { color: COLORS.success, y: -0.26 },
  ];

  return (
    <Float speed={reducedMotion ? 0 : 0.72} rotationIntensity={0.08} floatIntensity={0.18}>
      <group position={[2.28, 0.62, 0.3]} rotation={[0.08, -0.42, 0.06]}>
        <ModuleCard accent={COLORS.accent} size={[1.42, 1.08, 0.14]}>
          <mesh position={[0, 0.28, 0.11]}>
            <sphereGeometry args={[0.16, 24, 24]} />
            <meshStandardMaterial
              color={COLORS.foreground}
              emissive={COLORS.foreground}
              emissiveIntensity={0.4}
            />
          </mesh>
          <mesh position={[0, 0.28, 0.16]}>
            <ringGeometry args={[0.2, 0.24, 36]} />
            <meshBasicMaterial color={COLORS.accentSoft} transparent opacity={0.48} />
          </mesh>
          {capsuleRows.map((row) => (
            <group key={row.y} position={[0, row.y - 0.06, 0.11]}>
              <mesh>
                <capsuleGeometry args={[0.085, 0.42, 8, 16]} />
                <meshStandardMaterial
                  color="#1e293b"
                  emissive="#1e293b"
                  emissiveIntensity={0.12}
                />
              </mesh>
              <mesh position={[-0.11, 0, 0.02]}>
                <sphereGeometry args={[0.035, 16, 16]} />
                <meshStandardMaterial color={row.color} emissive={row.color} emissiveIntensity={0.42} />
              </mesh>
              <mesh position={[0.08, 0, 0.02]}>
                <boxGeometry args={[0.16, 0.04, 0.02]} />
                <meshStandardMaterial
                  color={row.color}
                  emissive={row.color}
                  emissiveIntensity={0.28}
                />
              </mesh>
            </group>
          ))}
        </ModuleCard>
      </group>
    </Float>
  );
}

function ReviewModule({ reducedMotion }: { reducedMotion: boolean }) {
  const barHeights = [0.18, 0.32, 0.5, 0.72];
  const chartPoints: Point3D[] = [
    [-0.42, -0.18, 0.11],
    [-0.16, -0.02, 0.11],
    [0.08, 0.18, 0.11],
    [0.34, 0.36, 0.11],
  ];

  return (
    <Float speed={reducedMotion ? 0 : 0.62} rotationIntensity={0.07} floatIntensity={0.18}>
      <group position={[2.08, -1.26, 0.46]} rotation={[0.18, -0.36, 0.08]}>
        <ModuleCard accent={COLORS.success} size={[1.48, 0.98, 0.14]}>
          <group position={[0, -0.06, 0.11]}>
            {barHeights.map((height, index) => (
              <mesh key={height} position={[-0.42 + index * 0.26, -0.32 + height / 2, 0]}>
                <boxGeometry args={[0.12, height, 0.04]} />
                <meshStandardMaterial
                  color={index >= 2 ? COLORS.success : COLORS.review}
                  emissive={index >= 2 ? COLORS.success : COLORS.review}
                  emissiveIntensity={0.28}
                />
              </mesh>
            ))}
          </group>
          <Line
            points={chartPoints}
            color={COLORS.foreground}
            transparent
            opacity={0.58}
            lineWidth={1.4}
          />
          {chartPoints.slice(-2).map((point) => (
            <mesh key={point.join('-')} position={point}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial
                color={COLORS.foreground}
                emissive={COLORS.foreground}
                emissiveIntensity={0.36}
              />
            </mesh>
          ))}
          {[-0.3, 0.02, 0.34].map((x) => (
            <group key={x} position={[x, 0.26, 0.11]}>
              <mesh>
                <sphereGeometry args={[0.055, 16, 16]} />
                <meshStandardMaterial
                  color={COLORS.success}
                  emissive={COLORS.success}
                  emissiveIntensity={0.44}
                />
              </mesh>
              <mesh position={[0, 0, 0.022]} rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.022, 0.07, 0.012]} />
                <meshBasicMaterial color="#052e16" />
              </mesh>
              <mesh position={[0.018, -0.012, 0.022]} rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[0.022, 0.04, 0.012]} />
                <meshBasicMaterial color="#052e16" />
              </mesh>
            </group>
          ))}
        </ModuleCard>
      </group>
    </Float>
  );
}

function ConnectionPaths({ routes }: { routes: FlowRoute[] }) {
  return (
    <>
      {routes.map((route) => (
        <Line
          key={route.key}
          points={route.curve.getPoints(56).map((point) => point.toArray() as Point3D)}
          color={route.color}
          transparent
          opacity={0.42}
          lineWidth={1.3}
        />
      ))}
    </>
  );
}

function FlowTracers({ reducedMotion, routes }: { reducedMotion: boolean; routes: FlowRoute[] }) {
  const tracerRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame(({ clock }) => {
    routes.forEach((route, index) => {
      const tracer = tracerRefs.current[index];
      if (!tracer) return;

      const progress = reducedMotion
        ? route.tracerOffset
        : (clock.getElapsedTime() * route.speed + route.tracerOffset) % 1;
      const point = route.curve.getPointAt(progress);
      tracer.position.copy(point);
    });
  });

  return (
    <>
      {routes.map((route, index) => (
        <mesh
          key={route.key}
          ref={(node) => {
            tracerRefs.current[index] = node;
          }}
        >
          <sphereGeometry args={[route.size, 18, 18]} />
          <meshStandardMaterial color={route.color} emissive={route.color} emissiveIntensity={0.68} />
        </mesh>
      ))}
    </>
  );
}

function ControlPlaneScene({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const flowRoutes = useMemo<FlowRoute[]>(
    () => [
      {
        color: COLORS.cyan,
        curve: createCurve([
          [-1.92, 1.1, -0.02],
          [-1.35, 1.28, 0.1],
          [-0.92, 0.82, 0.14],
          [-0.64, 0.38, 0.12],
        ]),
        key: 'org-board',
        size: 0.08,
        speed: 0.08,
        tracerOffset: 0.12,
      },
      {
        color: COLORS.accentSoft,
        curve: createCurve([
          [-1.86, -1.06, 0.14],
          [-1.22, -1.1, 0.18],
          [-0.82, -0.62, 0.16],
          [-0.56, -0.14, 0.13],
        ]),
        key: 'repo-board',
        size: 0.07,
        speed: 0.07,
        tracerOffset: 0.44,
      },
      {
        color: COLORS.accent,
        curve: createCurve([
          [0.84, 0.24, 0.12],
          [1.18, 0.36, 0.16],
          [1.62, 0.52, 0.22],
          [1.96, 0.58, 0.26],
        ]),
        key: 'board-agent',
        size: 0.082,
        speed: 0.12,
        tracerOffset: 0.18,
      },
      {
        color: COLORS.success,
        curve: createCurve([
          [2.28, 0.08, 0.28],
          [2.44, -0.28, 0.34],
          [2.38, -0.76, 0.4],
          [2.18, -1.02, 0.44],
        ]),
        key: 'agent-review',
        size: 0.076,
        speed: 0.11,
        tracerOffset: 0.62,
      },
      {
        color: COLORS.review,
        curve: createCurve([
          [1.72, -1.12, 0.4],
          [1.04, -1.02, 0.28],
          [0.32, -0.72, 0.16],
          [-0.12, -0.22, 0.12],
        ]),
        key: 'review-board',
        size: 0.068,
        speed: 0.07,
        tracerOffset: 0.86,
      },
    ],
    []
  );

  useEffect(() => {
    if (reducedMotion) return;

    const handlePointerMove = (event: PointerEvent) => {
      pointer.current.targetX = (event.clientX / window.innerWidth - 0.5) * 0.42;
      pointer.current.targetY = (event.clientY / window.innerHeight - 0.5) * 0.28;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [reducedMotion]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;

    if (!reducedMotion) {
      pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, pointer.current.targetX, 0.06);
      pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, pointer.current.targetY, 0.06);
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -0.12 - pointer.current.y, 0.08);
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, -0.18 + pointer.current.x, 0.08);
    } else {
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -0.12, 0.08);
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, -0.18, 0.08);
    }

    group.position.y = THREE.MathUtils.lerp(
      group.position.y,
      reducedMotion ? -0.05 : Math.sin(clock.getElapsedTime() * 0.48) * 0.08 - 0.05,
      0.05
    );
  });

  return (
    <group ref={groupRef} position={[0, -0.08, -0.42]}>
      <mesh position={[0, -1.88, -1.65]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.8, 3.42, 72]} />
        <meshBasicMaterial color={COLORS.accent} transparent opacity={0.12} />
      </mesh>
      <mesh position={[-2.68, 1.08, -1.8]}>
        <sphereGeometry args={[0.72, 28, 28]} />
        <meshBasicMaterial color={COLORS.accent} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[2.58, -0.28, -1.6]}>
        <sphereGeometry args={[0.84, 28, 28]} />
        <meshBasicMaterial color={COLORS.cyan} transparent opacity={0.08} depthWrite={false} />
      </mesh>

      <ConnectionPaths routes={flowRoutes} />
      <FlowTracers reducedMotion={reducedMotion} routes={flowRoutes} />

      <ControlPlaneBoard reducedMotion={reducedMotion} />
      <OrganizationModule reducedMotion={reducedMotion} />
      <RepositoryModule reducedMotion={reducedMotion} />
      <AgentModule reducedMotion={reducedMotion} />
      <ReviewModule reducedMotion={reducedMotion} />

      <mesh position={[0.02, 1.26, -0.48]}>
        <sphereGeometry args={[0.09, 18, 18]} />
        <meshStandardMaterial
          color={COLORS.glow}
          emissive={COLORS.glow}
          emissiveIntensity={0.68}
        />
      </mesh>
      <mesh position={[0.02, 1.26, -0.5]}>
        <ringGeometry args={[0.15, 0.22, 32]} />
        <meshBasicMaterial color={COLORS.glow} transparent opacity={0.38} />
      </mesh>
    </group>
  );
}

export default function HeroScene() {
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <div className="pointer-events-none h-full w-full" aria-hidden>
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 0.04, 6.7], fov: 37 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <fog attach="fog" args={['#0f172a', 7.4, 12.2]} />
          <ambientLight intensity={0.92} />
          <directionalLight position={[4.8, 4.4, 5.2]} intensity={1.35} color="#eff6ff" />
          <pointLight position={[-3.8, 1.8, 2.8]} intensity={1.35} color={COLORS.accentSoft} />
          <pointLight position={[3.2, -0.4, 2.9]} intensity={1.2} color={COLORS.cyan} />
          <pointLight position={[0, 2.4, 1.8]} intensity={0.9} color="#cbd5ff" />

          <Sparkles
            count={shouldReduceMotion ? 10 : 18}
            scale={[8.4, 5.2, 4.6]}
            size={2.1}
            speed={shouldReduceMotion ? 0 : 0.22}
            color="#dbeafe"
            opacity={0.45}
          />

          <ControlPlaneScene reducedMotion={shouldReduceMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
