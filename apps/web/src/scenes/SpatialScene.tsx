import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Object3D, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import gsap from 'gsap'
import type { Analysis } from '../data/analysis.generated'
import { useLab } from '../store/lab'

gsap.config({ autoSleep: 20 })

function CameraRig({ home }: { home: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, invalidate } = useThree()
  const component = useLab((s) => s.component),
    layer = useLab((s) => s.layer),
    revision = useLab((s) => s.cameraRevision)
  const layers = useLab((s) => s.analysis?.model.layers ?? 12)
  useEffect(() => {
    if (!controls.current) return
    const isBlock = component?.startsWith('block-') && !home
    const isComponent = isBlock && component?.includes('.')
    const target = new Vector3(
      0,
      isBlock ? (layer - (layers - 1) / 2) * 0.46 : 0,
      isComponent && component?.endsWith('mlp') ? 0.6 : 0,
    )
    const position = isComponent
      ? new Vector3(4.5, target.y + 1.8, 5.2)
      : isBlock
        ? new Vector3(5.8, target.y + 2.4, 6.8)
        : new Vector3(9, 5.2, 10.3)
    const tween = gsap.timeline({
      onUpdate: invalidate,
      defaults: { duration: 0.8, ease: 'power2.inOut' },
    })
    tween.to(camera.position, { x: position.x, y: position.y, z: position.z }, 0)
    tween.to(controls.current.target, { x: target.x, y: target.y, z: target.z }, 0)
    return () => {
      tween.kill()
    }
  }, [component, layer, revision, home, camera, invalidate, layers])
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      minDistance={4.6}
      maxDistance={19}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI * 0.82}
      enablePan={false}
      onStart={() => {
        gsap.killTweensOf(camera.position)
        if (controls.current) gsap.killTweensOf(controls.current.target)
      }}
    />
  )
}

function Blocks({ data }: { data: Analysis }) {
  const n = data.model.layers,
    heads = data.model.heads
  const slabRef = useRef<InstancedMesh>(null),
    headRef = useRef<InstancedMesh>(null)
  const layer = useLab((s) => s.layer),
    setLayer = useLab((s) => s.setLayer),
    focus = useLab((s) => s.focus)
  const selectedHead = useLab((s) => s.head)
  const invalidate = useThree((s) => s.invalidate)
  const dummy = useMemo(() => new Object3D(), [])
  useLayoutEffect(() => {
    if (!slabRef.current || !headRef.current) return
    for (let i = 0; i < n; i++) {
      const y = (i - (n - 1) / 2) * 0.46
      dummy.position.set(0, y, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      slabRef.current.setMatrixAt(i, dummy.matrix)
      slabRef.current.setColorAt(
        i,
        new Color(i === layer ? '#a0bac2' : i % 2 ? '#354b57' : '#435d68'),
      )
      for (let h = 0; h < heads; h++) {
        dummy.position.set(-1.42 + (h * 2.85) / Math.max(1, heads - 1), y + 0.115, -0.19)
        dummy.updateMatrix()
        const index = i * heads + h
        headRef.current.setMatrixAt(index, dummy.matrix)
        headRef.current.setColorAt(
          index,
          new Color(
            i === layer && h === selectedHead ? '#e7ddd0' : i === layer ? '#779aa5' : '#4c6c79',
          ),
        )
      }
    }
    slabRef.current.instanceMatrix.needsUpdate = true
    headRef.current.instanceMatrix.needsUpdate = true
    if (slabRef.current.instanceColor) slabRef.current.instanceColor.needsUpdate = true
    if (headRef.current.instanceColor) headRef.current.instanceColor.needsUpdate = true
    invalidate()
  }, [n, heads, layer, selectedHead, dummy, invalidate])
  const choose = (i: number | undefined) => {
    if (i !== undefined) {
      setLayer(i)
      focus(`block-${i}`)
    }
  }
  return (
    <group rotation={[0, -0.18, 0]}>
      <instancedMesh
        ref={slabRef}
        args={[undefined, undefined, n]}
        onClick={(e) => {
          e.stopPropagation()
          choose(e.instanceId)
        }}
      >
        <boxGeometry args={[3.6, 0.14, 1.8]} />
        <meshStandardMaterial metalness={0.48} roughness={0.52} />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, n * heads]}
        onClick={(e) => {
          e.stopPropagation()
          if (e.instanceId !== undefined) {
            choose(Math.floor(e.instanceId / heads))
            useLab.getState().setHead(e.instanceId % heads)
          }
        }}
      >
        <boxGeometry args={[0.15, 0.065, 0.7]} />
        <meshStandardMaterial metalness={0.18} roughness={0.6} />
      </instancedMesh>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[0, (i - (n - 1) / 2) * 0.46, 0]}>
          <mesh position={[0, 0.11, 0.6]}>
            <boxGeometry args={[2.95, 0.04, 0.15]} />
            <meshStandardMaterial
              color={i === layer ? '#c4a98c' : '#68736c'}
              metalness={0.3}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[-1.91, 0, 0.75]}>
        <boxGeometry args={[0.035, n * 0.46, 0.035]} />
        <meshStandardMaterial color="#b0977c" />
      </mesh>
      <mesh position={[1.91, 0, -0.75]}>
        <boxGeometry args={[0.035, n * 0.46, 0.035]} />
        <meshStandardMaterial color="#67838f" />
      </mesh>
      <group position={[0, -(n - 1) * 0.23 - 0.58, 0]}>
        <mesh
          position={[-0.92, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            focus('embedding')
          }}
        >
          <boxGeometry args={[1.7, 0.15, 1.8]} />
          <meshStandardMaterial color="#718c91" metalness={0.3} roughness={0.55} />
        </mesh>
        <mesh
          position={[0.92, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            focus('position')
          }}
        >
          <boxGeometry args={[1.7, 0.15, 1.8]} />
          <meshStandardMaterial color="#8f806e" metalness={0.3} roughness={0.55} />
        </mesh>
      </group>
      <mesh
        position={[0, (n - 1) * 0.23 + 0.4, 0]}
        onClick={(e) => {
          e.stopPropagation()
          focus('final-norm')
        }}
      >
        <boxGeometry args={[3.6, 0.07, 1.8]} />
        <meshStandardMaterial color="#627d8a" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh
        position={[0, (n - 1) * 0.23 + 0.67, 0]}
        onClick={(e) => {
          e.stopPropagation()
          focus('projection')
        }}
      >
        <boxGeometry args={[3.6, 0.09, 1.8]} />
        <meshStandardMaterial color="#b6c7cb" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  )
}

function ContextLifecycle({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => {
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
  return null
}

export default function SpatialScene({
  data,
  home,
  onContextLost,
}: {
  data: Analysis
  home: boolean
  onContextLost: () => void
}) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [9, 5.2, 10.3], fov: 37 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={1.3} />
      <directionalLight position={[5, 9, 5]} intensity={3} color="#d9e7ea" />
      <directionalLight position={[-5, -3, -5]} intensity={1.2} color="#c4a98c" />
      <Blocks data={data} />
      <CameraRig home={home} />
      <ContextLifecycle onLost={onContextLost} />
    </Canvas>
  )
}
