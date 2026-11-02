import { useEffect, useRef } from "react"
import * as THREE from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"

function clay(color, emissive, intensity) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    sheen: 0.18,
    sheenColor: new THREE.Color(0xd7ffe4),
    emissive: new THREE.Color(emissive),
    emissiveIntensity: intensity,
  })
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const ab2 = abx * abx + aby * aby || 1e-8
  const t = Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / ab2))
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
}

function pointInPoly(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y
    const yj = poly[j].y
    if ((yi > y) === (yj > y)) continue
    const xi = poly[i].x
    const xj = poly[j].x
    if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function halfHeight(sd, radius, peak) {
  if (sd <= 0 || peak <= 0) return 0
  const t = Math.min(1, sd / peak)
  return radius * Math.sin(Math.pow(t, 0.5) * Math.PI / 2)
}

function inflate(shape, radius, cols, rows) {
  const outline = shape.getPoints(200)
  if (outline.length > 1 && outline[0].distanceTo(outline[outline.length - 1]) < 1e-5) outline.pop()

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const point of outline) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const signed = new Float32Array(cols * rows)
  let peak = 0.0001
  for (let j = 0; j < rows; j += 1) {
    const y = minY + (j / (rows - 1)) * spanY
    for (let i = 0; i < cols; i += 1) {
      const x = minX + (i / (cols - 1)) * spanX
      let edge = Infinity
      for (let p = 0, q = outline.length - 1; p < outline.length; q = p++) {
        edge = Math.min(edge, distanceToSegment(x, y, outline[q].x, outline[q].y, outline[p].x, outline[p].y))
      }
      const dist = pointInPoly(x, y, outline) ? edge : -edge
      signed[j * cols + i] = dist
      if (dist > peak) peak = dist
    }
  }

  const positions = []
  const indices = []
  const interior = new Map()
  const rim = new Map()
  const point = (i, j) => ({
    x: minX + (i / (cols - 1)) * spanX,
    y: minY + (j / (rows - 1)) * spanY,
    s: signed[j * cols + i],
  })
  const add = (x, y, z) => {
    const id = positions.length / 3
    positions.push(x, y, z)
    return id
  }
  const interiorVertex = (i, j, side) => {
    const key = `${i},${j},${side}`
    const cached = interior.get(key)
    if (cached !== undefined) return cached
    const sample = point(i, j)
    const id = add(sample.x, sample.y, side * halfHeight(sample.s, radius, peak))
    interior.set(key, id)
    return id
  }
  const rimVertex = (i0, j0, i1, j1) => {
    const key = i0 < i1 || (i0 === i1 && j0 < j1) ? `${i0},${j0},${i1},${j1}` : `${i1},${j1},${i0},${j0}`
    const cached = rim.get(key)
    if (cached !== undefined) return cached
    const a = point(i0, j0)
    const b = point(i1, j1)
    const t = a.s / (a.s - b.s || 1e-8)
    const id = add(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0)
    rim.set(key, id)
    return id
  }
  const push = (a, b, c) => {
    if (a === b || b === c || a === c) return
    indices.push(a, b, c)
  }
  const resolve = (item, side) => (
    item[0] === "in"
      ? interiorVertex(item[1][0], item[1][1], side)
      : rimVertex(item[1][0], item[1][1], item[2][0], item[2][1])
  )
  const fill = (ring) => {
    const front = ring.map((item) => resolve(item, 1))
    const back = ring.map((item) => resolve(item, -1))
    for (let k = 1; k < front.length - 1; k += 1) {
      push(front[0], front[k], front[k + 1])
      push(back[0], back[k + 1], back[k])
    }
  }

  for (let j = 0; j < rows - 1; j += 1) {
    for (let i = 0; i < cols - 1; i += 1) {
      const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]
      const inside = corners.map(([ci, cj]) => signed[cj * cols + ci] > 0)
      const count = inside.reduce((sum, on) => sum + (on ? 1 : 0), 0)
      if (!count) continue
      const rings = []
      if (count === 2 && inside[0] === inside[2]) {
        ;[0, 2].forEach((corner) => {
          if (!inside[corner]) return
          const current = corners[corner]
          const next = corners[(corner + 1) % 4]
          const prev = corners[(corner + 3) % 4]
          rings.push([
            ["in", current],
            ["rim", current, next],
            ["rim", prev, current],
          ])
        })
        if (!inside[0]) {
          ;[1, 3].forEach((corner) => {
            const current = corners[corner]
            const next = corners[(corner + 1) % 4]
            const prev = corners[(corner + 3) % 4]
            rings.push([
              ["in", current],
              ["rim", current, next],
              ["rim", prev, current],
            ])
          })
        }
      } else {
        const ring = []
        for (let k = 0; k < 4; k += 1) {
          const current = corners[k]
          const next = corners[(k + 1) % 4]
          if (inside[k]) ring.push(["in", current])
          if (inside[k] !== inside[(k + 1) % 4]) ring.push(["rim", current, next])
        }
        rings.push(ring)
      }
      rings.forEach(fill)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1))
  geometry.computeVertexNormals()
  return geometry
}

function bodyShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0.06, 1.55)
  shape.bezierCurveTo(0.48, 1.18, 0.86, 0.68, 1.06, 0.12)
  shape.bezierCurveTo(1.18, -0.28, 1.08, -0.85, 0.64, -1.18)
  shape.bezierCurveTo(0.22, -1.42, -0.32, -1.36, -0.7, -1.02)
  shape.bezierCurveTo(-0.98, -0.72, -1.12, -0.22, -0.92, 0.22)
  shape.bezierCurveTo(-0.8, 0.5, -0.52, 0.74, -0.38, 0.58)
  shape.bezierCurveTo(-0.28, 0.42, -0.34, 0.12, -0.42, -0.02)
  shape.bezierCurveTo(-0.28, 0.22, -0.08, 0.78, 0.06, 1.55)
  return shape
}

function tongueShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0.24, 0.66)
  shape.bezierCurveTo(0.58, 0.24, 0.64, -0.34, 0.28, -0.84)
  shape.bezierCurveTo(0.02, -1.18, -0.42, -1.14, -0.66, -0.64)
  shape.bezierCurveTo(-0.74, -0.32, -0.4, 0.02, -0.08, 0.2)
  shape.bezierCurveTo(0.08, 0.36, 0.14, 0.52, 0.24, 0.66)
  return shape
}

function coreShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0.04, -0.05)
  shape.bezierCurveTo(0.2, -0.2, 0.22, -0.58, 0.02, -0.9)
  shape.bezierCurveTo(-0.1, -1.06, -0.26, -0.92, -0.22, -0.55)
  shape.bezierCurveTo(-0.16, -0.24, -0.04, -0.12, 0.04, -0.05)
  return shape
}

function lickShape() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.46, 0.66)
  shape.bezierCurveTo(-0.24, 0.4, -0.3, 0.02, -0.55, -0.2)
  shape.bezierCurveTo(-0.8, -0.36, -1.1, 0.02, -0.9, 0.36)
  shape.bezierCurveTo(-0.78, 0.56, -0.6, 0.68, -0.46, 0.66)
  return shape
}

function emberShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.22)
  shape.bezierCurveTo(0.1, 0.1, 0.11, -0.02, 0.05, -0.14)
  shape.bezierCurveTo(0.01, -0.2, -0.05, -0.16, -0.09, -0.04)
  shape.bezierCurveTo(-0.11, 0.08, -0.05, 0.16, 0, 0.22)
  return shape
}

export function FlameStage() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const narrow = window.innerWidth < 800

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.04
    mount.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const scene = new THREE.Scene()
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.4

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40)
    camera.position.set(0.08, 0.7, narrow ? 11.2 : 8.4)
    camera.lookAt(0.05, 0.72, 0)

    const root = new THREE.Group()
    root.position.set(narrow ? 0.08 : 0.32, 0.62, 0)
    root.scale.setScalar(narrow ? 0.58 : 0.86)
    scene.add(root)

    const geometries = []
    const materials = []
    const keep = (geometry) => {
      geometries.push(geometry)
      return geometry
    }
    const paint = (material) => {
      materials.push(material)
      return material
    }

    const body = new THREE.Mesh(keep(inflate(bodyShape(), 0.3, 110, 150)), paint(clay(0x1fad5a, 0x063818, 0.05)))
    root.add(body)

    const lick = new THREE.Mesh(keep(inflate(lickShape(), 0.12, 64, 72)), paint(clay(0x4ade80, 0x0c5830, 0.08)))
    lick.position.z = 0.3
    root.add(lick)

    const tongue = new THREE.Mesh(keep(inflate(tongueShape(), 0.16, 80, 100)), paint(clay(0xdfffe8, 0x86efac, 0.2)))
    tongue.position.z = 0.34
    root.add(tongue)

    const core = new THREE.Mesh(keep(inflate(coreShape(), 0.08, 48, 60)), paint(clay(0xf4fff6, 0xb6f5c8, 0.28)))
    core.position.z = 0.48
    root.add(core)

    const emberGeometry = keep(inflate(emberShape(), 0.04, 36, 44))
    const emberMaterial = paint(clay(0x86efac, 0x1a7a40, 0.08))
    const embers = [
      [0.5, 1.4, 0.42, -0.55, 0.9],
      [0.12, 1.68, 0.36, 0.15, 0.4],
      [-0.55, 1.18, 0.34, 0.85, 0.48],
      [-0.4, 1.1, 0.36, 0.7, 0.72],
      [0.98, 0.66, 0.4, -0.35, 0.55],
      [1.16, 0.14, 0.28, -0.15, 0.48],
    ].map(([x, y, z, rot, scale], index) => {
      const mesh = new THREE.Mesh(emberGeometry, emberMaterial)
      mesh.position.set(x, y, z)
      mesh.rotation.z = rot
      mesh.scale.setScalar(scale)
      mesh.userData.index = index
      root.add(mesh)
      return mesh
    })

    const shadowCanvas = document.createElement("canvas")
    shadowCanvas.width = 256
    shadowCanvas.height = 256
    const shadowCtx = shadowCanvas.getContext("2d")
    const shadowGradient = shadowCtx.createRadialGradient(128, 128, 12, 128, 128, 122)
    shadowGradient.addColorStop(0, "rgba(1, 6, 10, 0.82)")
    shadowGradient.addColorStop(0.38, "rgba(1, 6, 10, 0.48)")
    shadowGradient.addColorStop(1, "rgba(1, 6, 10, 0)")
    shadowCtx.fillStyle = shadowGradient
    shadowCtx.fillRect(0, 0, 256, 256)
    const shadowMap = new THREE.CanvasTexture(shadowCanvas)
    const shadow = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(1, 1)),
      paint(new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false })),
    )
    shadow.renderOrder = -1
    scene.add(shadow)

    scene.add(new THREE.HemisphereLight(0xf7fff8, 0x123020, 0.72))
    const key = new THREE.DirectionalLight(0xffffff, 1.7)
    key.position.set(-3.2, 4.4, 3.4)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xd7ffe4, 0.45)
    fill.position.set(2.4, 1.2, 2.8)
    scene.add(fill)

    const fit = () => {
      const width = mount.clientWidth || 1
      const height = mount.clientHeight || 1
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(mount)

    const hitList = [body, lick, tongue, core, ...embers]
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const aim = { hover: false, dragging: false, nx: 0, ny: 0, spin: 0, lastX: 0 }

    const project = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObjects(hitList, false).length > 0
    }
    const onPointerMove = (event) => {
      if (aim.dragging) {
        aim.spin += (event.clientX - aim.lastX) * 0.01
        aim.lastX = event.clientX
        aim.ny = -((event.clientY - renderer.domElement.getBoundingClientRect().top) / renderer.domElement.clientHeight) * 2 + 1
        return
      }
      const hit = project(event)
      aim.hover = hit
      aim.nx = pointer.x
      aim.ny = pointer.y
      renderer.domElement.style.cursor = hit ? "grab" : ""
    }
    const onPointerDown = (event) => {
      if (!project(event)) return
      aim.dragging = true
      aim.hover = true
      aim.lastX = event.clientX
      renderer.domElement.style.cursor = "grabbing"
      renderer.domElement.setPointerCapture(event.pointerId)
    }
    const onPointerUp = () => {
      aim.dragging = false
      renderer.domElement.style.cursor = aim.hover ? "grab" : ""
    }
    renderer.domElement.addEventListener("pointermove", onPointerMove)
    renderer.domElement.addEventListener("pointerdown", onPointerDown)
    renderer.domElement.addEventListener("pointerup", onPointerUp)
    renderer.domElement.addEventListener("pointercancel", onPointerUp)

    let frame = 0
    let visible = true
    const started = performance.now()
    const draw = (now) => {
      if (!visible) {
        frame = 0
        return
      }
      frame = requestAnimationFrame(draw)
      const time = (now - started) / 1000
      if (!aim.dragging) aim.spin *= 0.96
      const idleY = reduced ? -0.06 : Math.sin(time * 0.32) * 0.08
      const targetY = aim.spin + (aim.hover || aim.dragging ? (aim.nx - 0.15) * 0.75 : idleY)
      const targetX = aim.hover || aim.dragging ? aim.ny * 0.22 : 0
      root.rotation.y += (targetY - root.rotation.y) * 0.12
      root.rotation.x += (targetX - root.rotation.x) * 0.12
      const scale = root.scale.x
      shadow.position.set(
        root.position.x + root.rotation.y * 0.16 * scale,
        root.position.y - 1.5 * scale,
        -0.4,
      )
      shadow.scale.set(2.05 * scale, 0.48 * scale, 1)
      body.scale.y = reduced ? 1 : 1 + Math.sin(time * 3) * 0.01
      tongue.scale.y = reduced ? 1 : 1 + Math.sin(time * 4.1) * 0.016
      core.scale.y = reduced ? 1 : 1 + Math.sin(time * 5.2) * 0.02
      lick.scale.y = reduced ? 1 : 1 + Math.sin(time * 2.6) * 0.012
      embers.forEach((ember, index) => {
        ember.position.y = ember.userData.baseY + (reduced ? 0 : Math.sin(time * 1.5 + index) * 0.012)
      })
      renderer.render(scene, camera)
      if (reduced) frame = 0
    }
    embers.forEach((ember) => {
      ember.userData.baseY = ember.position.y
    })
    draw(started)

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !frame && !reduced) frame = requestAnimationFrame(draw)
    }, { rootMargin: "12% 0px" })
    seen.observe(mount)

    return () => {
      visible = false
      cancelAnimationFrame(frame)
      seen.disconnect()
      observer.disconnect()
      renderer.domElement.removeEventListener("pointermove", onPointerMove)
      renderer.domElement.removeEventListener("pointerdown", onPointerDown)
      renderer.domElement.removeEventListener("pointerup", onPointerUp)
      renderer.domElement.removeEventListener("pointercancel", onPointerUp)
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      shadowMap.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={mountRef} className="flame-stage" role="img" aria-label="sFlame logo. Drag to turn it." />
}
