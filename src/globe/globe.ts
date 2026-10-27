// three.js globe: ocean sphere, reconstructed land (one draw call per layer, rotated per plate
// on the GPU), palaeo-latitude guides, and the Singapore pin with its full 750 Myr track.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Geometry, Manifest, Quat, Rotations, Vec3 } from "../data/model";
import { rotate, toXyz } from "../data/model";

export interface Palette {
  ocean: string;
  oceanRim: string;
  crust: string;
  land: string;
  coast: string;
  guide: string;
  pin: string;
  track: string;
}

export const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    ocean: "#173f52",
    oceanRim: "#4fe0a0",
    crust: "#2f6a47",
    land: "#79c488",
    coast: "#a9e6b4",
    guide: "#a996e0",
    pin: "#e9a07f",
    track: "#e9a07f",
  },
  light: {
    ocean: "#a9d8e6",
    oceanRim: "#14673a",
    crust: "#9ccfa6",
    land: "#4c9a62",
    coast: "#2f7448",
    guide: "#6a55b8",
    pin: "#b2502a",
    track: "#b2502a",
  },
};

const VERT = /* glsl */ `
  uniform sampler2D uRot;
  uniform float uMa;
  uniform float uNoBegin;
  uniform float uRadius;
  attribute vec3 aAttr; // plate index, begin Ma, end Ma
  varying float vShade;
  vec3 qrot(vec4 q, vec3 v) {
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w * t + cross(q.xyz, t);
  }
  void main() {
    bool before = aAttr.y < uNoBegin - 0.5 && uMa > aAttr.y + 0.001;
    bool after = uMa < aAttr.z - 0.001;
    if (before || after) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vec4 q = texelFetch(uRot, ivec2(int(aAttr.x + 0.5), 0), 0);
    vec3 p = qrot(q, normalize(position));
    vec4 world = modelMatrix * vec4(p * uRadius, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * p);
    vShade = 0.72 + 0.28 * max(dot(n, normalize(vec3(0.4, 0.7, 0.6))), 0.0);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLit;
  varying float vShade;
  void main() {
    gl_FragColor = vec4(uColor * mix(1.0, vShade, uLit), 1.0);
    #include <colorspace_fragment>
  }
`;

const OCEAN_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const OCEAN_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform vec3 uRim;
  varying vec3 vN; varying vec3 vV;
  void main() {
    float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
    float l = 0.75 + 0.25 * max(dot(vN, normalize(vec3(0.3, 0.5, 0.8))), 0.0);
    gl_FragColor = vec4(mix(uColor * l, uRim, f * 0.55), 1.0);
    #include <colorspace_fragment>
  }
`;
const GLOW_FRAG = /* glsl */ `
  uniform vec3 uRim;
  varying vec3 vN; varying vec3 vV;
  void main() {
    float f = pow(max(dot(vN, vV), 0.0), 2.5);
    gl_FragColor = vec4(uRim, f * 0.35);
    #include <colorspace_fragment>
  }
`;

/** Earth-centred (z = north) to three.js (y = up). */
function toWorld(v: Vec3, r = 1): THREE.Vector3 {
  return new THREE.Vector3(v[0] * r, v[2] * r, -v[1] * r);
}

export interface GlobeOptions {
  canvas: HTMLCanvasElement;
  manifest: Manifest;
  geometry: Geometry;
  rotations: Rotations;
  reducedMotion: boolean;
}

export class Globe {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private controls: OrbitControls;
  private rotTex: THREE.DataTexture;
  private rotData: Float32Array;
  private land: THREE.ShaderMaterial[] = [];
  private oceanMat: THREE.ShaderMaterial;
  private glowMat: THREE.ShaderMaterial;
  private guideMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45 });
  private trackMat = new THREE.LineDashedMaterial({ dashSize: 0.012, gapSize: 0.008, transparent: true, opacity: 0.8 });
  private pin: THREE.Group;
  private pinRing: THREE.Mesh;
  private ma = 0;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private readonly sgHome: Vec3;
  private onFrame?: () => void;

  constructor(private readonly o: GlobeOptions) {
    const { canvas, manifest, geometry, rotations } = o;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.position.set(0, 0.5, 3.6);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = !o.reducedMotion;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 7;
    this.controls.rotateSpeed = 0.6;

    this.rotData = new Float32Array(rotations.plates * 4);
    this.rotTex = new THREE.DataTexture(this.rotData, rotations.plates, 1, THREE.RGBAFormat, THREE.FloatType);
    this.rotTex.needsUpdate = true;

    const earth = new THREE.Group();
    earth.rotation.x = -Math.PI / 2; // Earth-centred z-up -> three.js y-up
    this.scene.add(earth);

    // ocean + atmosphere
    this.oceanMat = new THREE.ShaderMaterial({
      vertexShader: OCEAN_VERT,
      fragmentShader: OCEAN_FRAG,
      uniforms: { uColor: { value: new THREE.Color() }, uRim: { value: new THREE.Color() } },
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.oceanMat));
    this.glowMat = new THREE.ShaderMaterial({
      vertexShader: OCEAN_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uRim: { value: new THREE.Color() } },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.12, 64, 48), this.glowMat));

    // land: continental crust, then present-day coastline shapes, then outlines
    const fill = new THREE.BufferGeometry();
    fill.setAttribute("position", new THREE.BufferAttribute(geometry.fillPosition, 3, true));
    fill.setAttribute("aAttr", new THREE.Uint16BufferAttribute(geometry.fillAttr, 3));
    fill.setIndex(new THREE.BufferAttribute(geometry.fillIndex, 1));
    const radii = [1.003, 1.005];
    manifest.layers.forEach((layer, i) => {
      const mat = this.landMaterial(radii[i], true);
      this.land.push(mat);
      const g = fill.clone();
      g.setDrawRange(layer.fill[0], layer.fill[1]);
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = i + 1;
      earth.add(mesh);
    });
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.BufferAttribute(geometry.linePosition, 3, true));
    lines.setAttribute("aAttr", new THREE.Uint16BufferAttribute(geometry.lineAttr, 3));
    lines.setIndex(new THREE.BufferAttribute(geometry.lineIndex, 1));
    const lineMat = this.landMaterial(1.0058, false);
    this.land.push(lineMat);
    const outline = new THREE.LineSegments(lines, lineMat);
    outline.frustumCulled = false;
    outline.renderOrder = 3;
    earth.add(outline);

    // palaeo-latitude guides: equator, tropics, polar circles (the model frame is palaeomagnetic)
    for (const lat of [0, 23.44, -23.44, 66.56, -66.56]) {
      const pts: THREE.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 3) pts.push(toWorld(toXyz(lat, lon), 1.002));
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      this.scene.add(new THREE.Line(g, lat === 0 ? this.guideMat : this.guideMat.clone()));
    }

    // Singapore: the track its crust takes from 750 Ma to today, and the pin itself
    const s = manifest.singapore;
    this.sgHome = toXyz(s.lat, s.lon);
    const trackPts = s.path.map(([la, lo]) => toWorld(toXyz(la, lo), 1.007));
    const track = new THREE.Line(new THREE.BufferGeometry().setFromPoints(trackPts), this.trackMat);
    track.computeLineDistances();
    this.scene.add(track);

    this.pin = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial());
    this.pinRing = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.038, 32),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true }),
    );
    this.pin.add(dot, this.pinRing);
    this.scene.add(this.pin);

    this.applyPalette(PALETTES.dark);
    this.setTime(0);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.controls.addEventListener("start", () => (this.flight = null));
    this.renderer.setAnimationLoop((t) => this.tick(t));
  }

  private landMaterial(radius: number, lit: boolean): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uRot: { value: this.rotTex },
        uMa: { value: 0 },
        uNoBegin: { value: this.o.manifest.noBegin },
        uRadius: { value: radius },
        uColor: { value: new THREE.Color() },
        uLit: { value: lit ? 1 : 0 },
      },
    });
  }

  applyPalette(p: Palette): void {
    this.oceanMat.uniforms.uColor.value.set(p.ocean);
    this.oceanMat.uniforms.uRim.value.set(p.oceanRim);
    this.glowMat.uniforms.uRim.value.set(p.oceanRim);
    const colors = [p.crust, p.land, p.coast];
    this.land.forEach((m, i) => m.uniforms.uColor.value.set(colors[i]));
    this.guideMat.color.set(p.guide);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Line && o.material !== this.trackMat && o.material instanceof THREE.LineBasicMaterial && o.material !== this.guideMat) {
        o.material.color.set(p.guide);
        o.material.opacity = 0.22;
      }
    });
    this.trackMat.color.set(p.track);
    for (const c of this.pin.children) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(p.pin);
  }

  /** Where Singapore's crust sits at `ma`, as a unit vector in the Earth-centred frame. */
  singaporeAt(ma: number): Vec3 {
    const q: Quat = this.o.rotations.at(this.o.manifest.singapore.plateIndex, ma);
    return rotate(q, this.sgHome);
  }

  setTime(ma: number): void {
    this.ma = ma;
    this.o.rotations.fill(this.rotData, ma);
    this.rotTex.needsUpdate = true;
    for (const m of this.land) m.uniforms.uMa.value = ma;
    const p = toWorld(this.singaporeAt(ma), 1.008);
    this.pin.position.copy(p);
    this.pin.lookAt(p.clone().multiplyScalar(2));
  }

  get time(): number {
    return this.ma;
  }

  /** Turn the camera to look straight at the pin. */
  focusPin(): void {
    const dir = this.pin.position.clone().normalize();
    const to = dir.multiplyScalar(this.camera.position.length());
    if (this.o.reducedMotion) {
      this.camera.position.copy(to);
      this.controls.update();
    } else {
      this.flight = { from: this.camera.position.clone(), to, t: 0 };
    }
  }

  /** Screen position of the pin, or null when it faces away. */
  pinScreen(): { x: number; y: number } | null {
    const p = this.pin.position.clone();
    const facing = p.clone().normalize().dot(this.camera.position.clone().sub(p).normalize());
    if (facing < 0.1) return null;
    p.project(this.camera);
    const c = this.renderer.domElement;
    return { x: ((p.x + 1) / 2) * c.clientWidth, y: ((1 - p.y) / 2) * c.clientHeight };
  }

  onRender(cb: () => void): void {
    this.onFrame = cb;
  }

  private resize(): void {
    const c = this.renderer.domElement;
    const w = c.clientWidth || 1;
    const h = c.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the whole globe in view on narrow screens
    this.camera.fov = w < h ? 35 * Math.min(1.6, h / w) : 35;
    this.camera.updateProjectionMatrix();
  }

  private tick(ms: number): void {
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + 0.035);
      const e = 1 - Math.pow(1 - f.t, 3);
      const len = f.from.length();
      this.camera.position.copy(f.from.clone().normalize().lerp(f.to.clone().normalize(), e).normalize().multiplyScalar(len));
      if (f.t >= 1) this.flight = null;
    }
    if (!this.o.reducedMotion) {
      const s = 1 + 0.35 * Math.sin(ms / 350);
      this.pinRing.scale.setScalar(s);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  }
}
