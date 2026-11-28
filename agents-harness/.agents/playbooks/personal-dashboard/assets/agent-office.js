const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const KNOWN_RUNTIMES = {
  "claude-code": { color: "#d97757", shape: "sphere" },
  codex: { color: "#10a37f", shape: "box" },
  pi: { color: "#6366f1", shape: "cone" },
  "command-code": { color: "#d4a017", shape: "octahedron" },
};
const EXTRA_COLORS = ["#0ea5e9", "#db2777", "#65a30d", "#9333ea", "#ea580c", "#0d9488"];
const EXTRA_SHAPES = ["dodecahedron", "torus", "sphere", "box", "cone", "octahedron"];

const THEMES = {
  light: {
    background: 0xeef1f5,
    floor: 0xdfe4ea,
    floorLine: 0xc9d0d9,
    wall: 0xf7f8fa,
    desk: 0xc8a27a,
    deskLeg: 0x6b7280,
    chair: 0x475569,
    monitor: 0x1f2937,
    label: "#1f2937",
    labelBg: "rgba(255,255,255,0.92)",
    ambient: 0.75,
    sun: 1.6,
  },
  dark: {
    background: 0x151a22,
    floor: 0x2a3240,
    floorLine: 0x3a4454,
    wall: 0x3b4558,
    desk: 0x7a5f45,
    deskLeg: 0x9ca3af,
    chair: 0x64748b,
    monitor: 0x0b0f14,
    label: "#e5e7eb",
    labelBg: "rgba(17,24,39,0.92)",
    ambient: 0.55,
    sun: 1.25,
  },
};

const STYLE = `
:host { display: block; color: inherit; font: inherit; }
* { box-sizing: border-box; }
.ao { container-type: inline-size; --ao-fg: #1f2937; --ao-muted: #6b7280; --ao-surface: #ffffff; --ao-border: #d1d5db; --ao-accent: #2563eb;
  color: var(--ao-fg); display: grid; gap: 12px; font-size: 14px; line-height: 1.5; }
@media (prefers-color-scheme: dark) {
  .ao { container-type: inline-size; --ao-fg: #e5e7eb; --ao-muted: #9ca3af; --ao-surface: #1c222c; --ao-border: #374151; --ao-accent: #60a5fa; }
}
.stage { position: relative; width: 100%; aspect-ratio: 16 / 10; min-height: 300px; max-height: 560px;
  border: 1px solid var(--ao-border); border-radius: 12px; overflow: hidden; background: var(--ao-surface); }
@container (max-width: 560px) { .stage { aspect-ratio: 1 / 1; } }
.stage canvas { display: block; width: 100%; height: 100%; touch-action: manipulation; outline: none; }
.stage:has(canvas:focus-visible) { outline: 2px solid var(--ao-accent); outline-offset: 2px; }
.empty { position: absolute; inset: auto 0 16px 0; margin: 0 auto; width: max-content; max-width: calc(100% - 32px);
  padding: 6px 14px; border-radius: 999px; background: var(--ao-surface); border: 1px solid var(--ao-border);
  color: var(--ao-muted); text-align: center; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; color: var(--ao-muted); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend b { color: var(--ao-fg); font-weight: 600; }
.swatch { width: 12px; height: 12px; flex: none; background: var(--c); }
.swatch.sphere { border-radius: 50%; }
.swatch.box { border-radius: 2px; }
.swatch.cone { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.swatch.octahedron { clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.swatch.dodecahedron { clip-path: polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%); }
.swatch.torus { border-radius: 50%; background: none; border: 3px solid var(--c); }
.detail { border: 1px solid var(--ao-border); border-radius: 12px; padding: 12px 14px; background: var(--ao-surface); }
.detail[hidden] { display: none; }
.detail-head { display: flex; align-items: flex-start; gap: 8px; }
.detail-title { margin: 0; font-size: 15px; font-weight: 600; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.detail-title .num { color: var(--ao-muted); margin-right: 6px; font-weight: 500; }
.close { flex: none; border: 1px solid var(--ao-border); background: transparent; color: var(--ao-fg); border-radius: 8px;
  min-width: 36px; min-height: 36px; font: inherit; cursor: pointer; }
.close:focus-visible, .picker button:focus-visible { outline: 2px solid var(--ao-accent); outline-offset: 2px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; margin: 8px 0 0; }
dt { color: var(--ao-muted); }
dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
dd code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
.runtime { display: inline-flex; align-items: center; gap: 6px; }
.picker { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; margin: 0; padding: 0; list-style: none; }
.list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.list > li { border: 1px solid var(--ao-border); border-radius: 12px; padding: 10px 14px; background: var(--ao-surface); }
.list h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.list h3 .num { color: var(--ao-muted); margin-right: 6px; font-weight: 500; }
.list ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.list ul li + li { border-top: 1px solid var(--ao-border); padding-top: 8px; }
.list dl { margin: 0; }
.list .empty-text { color: var(--ao-muted); }
`;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else if (key === "style") node.style.cssText = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function normalize(agents) {
  if (!Array.isArray(agents)) return [];
  const seen = new Map();
  const result = [];
  for (const agent of agents) {
    if (!agent || typeof agent !== "object" || agent.status !== "In Progress") continue;
    const item = {
      cardId: String(agent.cardId ?? ""),
      cardNumber: Number.isFinite(agent.cardNumber) ? agent.cardNumber : 0,
      cardTitle: String(agent.cardTitle ?? ""),
      role: String(agent.role ?? ""),
      runtime: String(agent.runtime ?? ""),
      model: String(agent.model ?? ""),
      session: String(agent.session ?? ""),
    };
    const base = [item.cardId, item.role, item.runtime, item.model, item.session].join("\u0000");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    item.key = `${base}\u0000${count}`;
    result.push(item);
  }
  return result;
}

function groupByCard(agents) {
  const cards = new Map();
  for (const agent of agents) {
    const id = agent.cardId || `#${agent.cardNumber}`;
    if (!cards.has(id)) cards.set(id, { cardId: id, cardNumber: agent.cardNumber, cardTitle: agent.cardTitle, agents: [] });
    cards.get(id).agents.push(agent);
  }
  return [...cards.values()].sort((a, b) => a.cardNumber - b.cardNumber || a.cardId.localeCompare(b.cardId));
}

function createRuntimeStyles() {
  const assigned = new Map();
  let extra = 0;
  return (runtime) => {
    if (assigned.has(runtime)) return assigned.get(runtime);
    const known = KNOWN_RUNTIMES[runtime.toLowerCase()];
    const style = known ?? {
      color: EXTRA_COLORS[extra % EXTRA_COLORS.length],
      shape: EXTRA_SHAPES[extra % EXTRA_SHAPES.length],
    };
    if (!known) extra += 1;
    assigned.set(runtime, style);
    return style;
  };
}

function swatch(style) {
  return el("span", { class: `swatch ${style.shape}`, style: `--c: ${style.color}`, "aria-hidden": "true" });
}

function detailList(agent, style) {
  return el("dl", {}, [
    el("dt", { text: "役割" }),
    el("dd", { text: agent.role || "—" }),
    el("dt", { text: "runtime" }),
    el("dd", {}, [el("span", { class: "runtime" }, [swatch(style), el("span", { text: agent.runtime || "—" })])]),
    el("dt", { text: "モデル" }),
    el("dd", { text: agent.model || "—" }),
    el("dt", { text: "セッション" }),
    el("dd", {}, [el("code", { text: agent.session || "—" })]),
  ]);
}

function cardHeading(agent, className) {
  return el("h3", { class: className }, [
    el("span", { class: "num", text: `#${agent.cardNumber}` }),
    el("span", { text: agent.cardTitle || "(無題)" }),
  ]);
}

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGL2RenderingContext && canvas.getContext("webgl2")) || Boolean(canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function mountAgentOffice(container, agents) {
  const host = el("div");
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { text: STYLE }));
  const shell = el("div", { class: "ao" });
  root.append(shell);
  container.append(host);

  let current = normalize(agents);
  let destroyed = false;
  let view = null;

  const fallback = () => {
    if (destroyed) return;
    view?.destroy();
    view = createListView(shell);
    view.update(current);
  };

  if (webglAvailable()) {
    import(THREE_URL)
      .then((THREE) => {
        if (destroyed) return;
        try {
          view = createSceneView(THREE, shell);
          view.update(current);
        } catch {
          fallback();
        }
      })
      .catch(fallback);
  } else {
    fallback();
  }

  return {
    update(next) {
      current = normalize(next);
      view?.update(current);
    },
    destroy() {
      destroyed = true;
      view?.destroy();
      view = null;
      host.remove();
    },
  };
}

function createListView(shell) {
  const list = el("ul", { class: "list", "aria-label": "稼働中の Agent" });
  shell.replaceChildren(list);
  return {
    update(agents) {
      const styleOf = createRuntimeStyles();
      const cards = groupByCard(agents);
      if (cards.length === 0) {
        list.replaceChildren(el("li", {}, [el("span", { class: "empty-text", text: "稼働中の Agent はいない" })]));
        return;
      }
      list.replaceChildren(
        ...cards.map((card) =>
          el("li", {}, [
            cardHeading(card.agents[0]),
            el("ul", {}, card.agents.map((agent) => el("li", {}, [detailList(agent, styleOf(agent.runtime))]))),
          ]),
        ),
      );
    },
    destroy() {
      shell.replaceChildren();
    },
  };
}

function createSceneView(THREE, shell) {
  const stage = el("div", { class: "stage" });
  const empty = el("p", { class: "empty", text: "稼働中の Agent はいない", hidden: true });
  const picker = el("ul", { class: "picker", "aria-label": "稼働中の Agent" });
  const legend = el("ul", { class: "legend", "aria-label": "runtime の凡例" });
  const detail = el("section", { class: "detail", hidden: true, "aria-live": "polite" });
  shell.replaceChildren(stage, legend, detail);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Agent Office");
  stage.append(canvas, empty, picker);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 600);
  const ambient = new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.7);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  scene.add(ambient, sun, sun.target);

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let office = null;
  let figures = [];
  let agents = [];
  let selectedKey = null;
  let bounds = { w: 11, d: 9, h: 2.6 };
  let frame = 0;
  let renderQueued = 0;
  let width = 0;
  let height = 0;
  let pointerStart = null;
  let narrow = false;
  const clock = new THREE.Clock();

  const theme = () => THEMES[darkQuery.matches ? "dark" : "light"];

  function disposeTree(object) {
    object.traverse((node) => {
      node.geometry?.dispose();
      const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
    });
  }

  function mat(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
  }

  function mesh(geometry, material, { cast = true, receive = false } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }

  function headGeometry(shape) {
    switch (shape) {
      case "box":
        return new THREE.BoxGeometry(0.36, 0.36, 0.36);
      case "cone":
        return new THREE.ConeGeometry(0.24, 0.44, 24);
      case "octahedron":
        return new THREE.OctahedronGeometry(0.25);
      case "dodecahedron":
        return new THREE.DodecahedronGeometry(0.23);
      case "torus":
        return new THREE.TorusGeometry(0.17, 0.07, 12, 28);
      default:
        return new THREE.SphereGeometry(0.21, 28, 20);
    }
  }

  function labelSprite(text, t) {
    const scale = 4;
    const font = `600 ${16 * scale}px system-ui, sans-serif`;
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = font;
    const w = Math.ceil(measure.measureText(text).width + 24 * scale);
    const h = 28 * scale;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = t.labelBg;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = t.label;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + scale);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    const worldH = 0.42;
    sprite.scale.set((worldH * w) / h, worldH, 1);
    return sprite;
  }

  function buildFigure(agent, style, t) {
    const group = new THREE.Group();
    const color = new THREE.Color(style.color);
    const chair = new THREE.Group();
    const chairMat = mat(t.chair);
    const seat = mesh(new THREE.BoxGeometry(0.62, 0.08, 0.58), chairMat);
    seat.position.y = 0.48;
    const back = mesh(new THREE.BoxGeometry(0.62, 0.62, 0.08), chairMat);
    back.position.set(0, 0.82, 0.3);
    const post = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 10), chairMat);
    post.position.y = 0.24;
    const base = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 20), chairMat);
    base.position.y = 0.02;
    chair.add(seat, back, post, base);

    const avatar = new THREE.Group();
    const bodyMat = mat(color, { roughness: 0.55 });
    const body = mesh(new THREE.CapsuleGeometry(0.22, 0.34, 6, 20), bodyMat);
    body.position.y = 0.42;
    const head = mesh(headGeometry(style.shape), mat(color.clone().offsetHSL(0, -0.05, 0.12), { roughness: 0.45 }));
    head.position.y = 0.98;
    if (style.shape === "torus") head.rotation.y = Math.PI / 2;
    avatar.add(body, head);
    avatar.position.y = 0.52;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.58, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    ring.visible = false;

    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), new THREE.MeshBasicMaterial({ color }));
    marker.rotation.x = Math.PI;
    marker.position.y = 2.05;
    marker.visible = false;

    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.9, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.95;
    hit.userData.key = agent.key;

    group.add(chair, avatar, ring, marker, hit);
    return { group, avatar, head, ring, marker, hit, glow: [body.material, head.material], key: agent.key, phase: Math.random() * Math.PI * 2 };
  }

  function buildDesk(card, styleOf, t) {
    const desk = new THREE.Group();
    const count = card.agents.length;
    const spacing = 1.2;
    const deskWidth = Math.max(2, count * spacing + 0.3);
    const deskMat = mat(t.desk, { roughness: 0.6 });
    const top = mesh(new THREE.BoxGeometry(deskWidth, 0.08, 1.1), deskMat, { cast: true, receive: true });
    top.position.y = 0.9;
    desk.add(top);
    const legMat = mat(t.deskLeg, { metalness: 0.3 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = mesh(new THREE.BoxGeometry(0.06, 0.86, 0.06), legMat);
        leg.position.set(sx * (deskWidth / 2 - 0.1), 0.43, sz * 0.46);
        desk.add(leg);
      }
    }

    const placed = [];
    card.agents.forEach((agent, index) => {
      const style = styleOf(agent.runtime);
      const x = (index - (count - 1) / 2) * spacing;

      const monitor = new THREE.Group();
      const frameMesh = mesh(new THREE.BoxGeometry(0.7, 0.44, 0.04), mat(t.monitor, { roughness: 0.4 }));
      frameMesh.position.y = 0.32;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.36),
        new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(style.color), emissiveIntensity: 0.55 }),
      );
      screen.position.set(0, 0.32, 0.021);
      const stand = mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), mat(t.monitor));
      stand.position.y = 0.06;
      monitor.add(frameMesh, screen, stand);
      monitor.position.set(x, 0.94, -0.2);
      desk.add(monitor);

      const figure = buildFigure(agent, style, t);
      figure.group.position.set(x, 0, 0.95);
      figure.screen = screen;
      desk.add(figure.group);
      placed.push(figure);
    });

    const label = labelSprite(`#${card.cardNumber}`, t);
    label.position.set(0, 1.85, -0.45);
    label.renderOrder = 10;
    desk.add(label);

    return { desk, width: deskWidth, figures: placed };
  }

  function buildOffice() {
    if (office) {
      scene.remove(office);
      disposeTree(office);
    }
    const t = theme();
    scene.background = new THREE.Color(t.background);
    ambient.intensity = t.ambient;
    sun.intensity = t.sun;

    office = new THREE.Group();
    figures = [];
    const styleOf = createRuntimeStyles();
    const cards = groupByCard(agents);

    const built = cards.map((card) => buildDesk(card, styleOf, t));
    const n = built.length;
    const cols = Math.max(1, narrow ? Math.min(2, Math.ceil(Math.sqrt(n))) : n <= 3 ? n : Math.ceil(Math.sqrt(n * 1.4)));
    const rows = Math.max(1, Math.ceil(built.length / cols));
    const cellW = Math.max(3.6, ...built.map((b) => b.width + 1.6));
    const cellD = 3.4;
    built.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, built.length - row * cols);
      b.desk.position.set((col - (inRow - 1) / 2) * cellW, 0, (row - (rows - 1) / 2) * cellD - 0.35);
      office.add(b.desk);
      figures.push(...b.figures);
    });

    const floorW = Math.max(cols * cellW, narrow ? 6 : 8) + 2;
    const floorD = Math.max(rows * cellD, 4.5) + 1.2;
    const floor = mesh(new THREE.PlaneGeometry(floorW, floorD), mat(t.floor, { roughness: 0.95 }), { cast: false, receive: true });
    floor.rotation.x = -Math.PI / 2;
    office.add(floor);
    const grid = new THREE.GridHelper(Math.max(floorW, floorD), Math.round(Math.max(floorW, floorD) / 1.5), t.floorLine, t.floorLine);
    grid.position.y = 0.005;
    grid.scale.set(floorW / Math.max(floorW, floorD), 1, floorD / Math.max(floorW, floorD));
    office.add(grid);

    const wallMat = mat(t.wall, { roughness: 0.9 });
    const wallH = 2.6;
    const backWall = mesh(new THREE.BoxGeometry(floorW, wallH, 0.15), wallMat, { cast: false, receive: true });
    backWall.position.set(0, wallH / 2, -floorD / 2);
    const sideWall = mesh(new THREE.BoxGeometry(0.15, wallH, floorD), wallMat, { cast: false, receive: true });
    sideWall.position.set(-floorW / 2, wallH / 2, 0);
    office.add(backWall, sideWall);

    const windowMat = new THREE.MeshStandardMaterial({ color: 0x9cc4e4, emissive: 0x9cc4e4, emissiveIntensity: darkQuery.matches ? 0.25 : 0.5 });
    const windows = Math.max(1, Math.floor(floorW / 3.5));
    for (let i = 0; i < windows; i += 1) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), windowMat);
      pane.position.set((i - (windows - 1) / 2) * (floorW / windows), 1.6, -floorD / 2 + 0.08);
      office.add(pane);
    }

    const plant = new THREE.Group();
    const pot = mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 20), mat(0xb45f3c));
    pot.position.y = 0.25;
    const leaves = mesh(new THREE.IcosahedronGeometry(0.5, 1), mat(0x3f8f4f, { flatShading: true }));
    leaves.position.y = 0.85;
    plant.add(pot, leaves);
    plant.position.set(-floorW / 2 + 0.7, 0, -floorD / 2 + 0.7);
    office.add(plant);

    scene.add(office);

    bounds = { w: floorW, d: floorD, h: wallH };
    sun.position.set(floorW * 0.3, 12, floorD * 0.6);
    sun.target.position.set(0, 0, 0);
    const span = Math.max(floorW, floorD) / 2 + 2;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 40 });
    sun.shadow.camera.updateProjectionMatrix();

    fitCamera();
    applySelection();
  }

  function fitCamera() {
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.zoom = 1;
    camera.clearViewOffset();
    const dir = new THREE.Vector3(0.32, 1.05, 1).normalize();
    const hw = bounds.w / 2;
    const hd = bounds.d / 2;
    const corners = [
      [-hw, 0, -hd], [hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd],
      [-hw, bounds.h, -hd], [hw, bounds.h, -hd], [-hw, bounds.h, hd],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const probe = new THREE.Vector3();
    const place = (distance) => {
      camera.position.copy(dir).multiplyScalar(distance);
      camera.lookAt(0, 0.5, 0);
      camera.updateMatrixWorld();
    };
    const fits = () => corners.every((corner) => {
      probe.copy(corner).project(camera);
      return Math.abs(probe.x) <= 0.96 && Math.abs(probe.y) <= 0.94;
    });
    let near = 2;
    let far = 300;
    for (let i = 0; i < 24; i += 1) {
      const mid = (near + far) / 2;
      place(mid);
      if (fits()) far = mid;
      else near = mid;
    }
    place(far);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const corner of corners) {
      probe.copy(corner).project(camera);
      minX = Math.min(minX, probe.x);
      maxX = Math.max(maxX, probe.x);
      minY = Math.min(minY, probe.y);
      maxY = Math.max(maxY, probe.y);
    }
    const zoom = Math.min(1.92 / (maxX - minX), 1.88 / (maxY - minY));
    camera.zoom = zoom;
    camera.setViewOffset(width, height, (((minX + maxX) / 2) * zoom * width) / 2, (-((minY + maxY) / 2) * zoom * height) / 2, width, height);
  }

  function animating() {
    return !motionQuery.matches && figures.length > 0;
  }

  function render() {
    renderQueued = 0;
    const time = clock.getElapsedTime();
    const moving = animating();
    for (const figure of figures) {
      const selected = figure.key === selectedKey;
      const bob = moving ? Math.sin(time * 2 + figure.phase) * 0.03 : 0;
      figure.avatar.position.y = 0.52 + bob + (selected ? 0.08 : 0);
      figure.head.rotation.y = moving ? Math.sin(time * 0.8 + figure.phase) * 0.35 : 0;
      figure.ring.visible = selected;
      figure.marker.visible = selected;
      figure.marker.position.y = 2.05 + (moving ? Math.sin(time * 3) * 0.08 : 0);
      for (const material of figure.glow) material.emissive.set(selected ? 0x333333 : 0x000000);
      if (selected && moving) figure.ring.material.opacity = 0.55 + Math.sin(time * 4) * 0.35;
      else figure.ring.material.opacity = 0.9;
      figure.screen.material.emissiveIntensity = moving ? 0.5 + Math.sin(time * 3.1 + figure.phase) * 0.08 : 0.55;
    }
    renderer.render(scene, camera);
  }

  function loop() {
    frame = 0;
    render();
    if (animating()) frame = requestAnimationFrame(loop);
  }

  function requestRender() {
    if (animating()) {
      if (!frame) frame = requestAnimationFrame(loop);
    } else if (!renderQueued) {
      renderQueued = requestAnimationFrame(render);
    }
  }

  function selected() {
    return agents.find((agent) => agent.key === selectedKey) ?? null;
  }

  function select(key) {
    selectedKey = key;
    applySelection();
  }

  function applySelection() {
    if (selectedKey && !agents.some((agent) => agent.key === selectedKey)) selectedKey = null;
    const agent = selected();
    for (const button of picker.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.key === selectedKey));
    }
    if (!agent) {
      detail.hidden = true;
      detail.replaceChildren();
    } else {
      const styleOf = createRuntimeStyles();
      for (const a of agents) styleOf(a.runtime);
      const close = el("button", { class: "close", type: "button", "aria-label": "選択を解除", text: "×" });
      close.addEventListener("click", () => {
        select(null);
        canvas.focus({ preventScroll: true });
      });
      detail.replaceChildren(el("div", { class: "detail-head" }, [cardHeading(agent, "detail-title"), close]), detailList(agent, styleOf(agent.runtime)));
      detail.hidden = false;
    }
    canvas.setAttribute("aria-label", agent ? `Agent Office: #${agent.cardNumber} ${agent.role} を選択中` : "Agent Office");
    canvas.style.cursor = "";
    requestRender();
  }

  function renderLegend() {
    const styleOf = createRuntimeStyles();
    const counts = new Map();
    for (const agent of agents) {
      styleOf(agent.runtime);
      counts.set(agent.runtime, (counts.get(agent.runtime) ?? 0) + 1);
    }
    legend.replaceChildren(
      ...[...counts].map(([runtime, count]) =>
        el("li", {}, [swatch(styleOf(runtime)), el("b", { text: runtime || "—" }), el("span", { text: `${count} 体` })]),
      ),
    );
    legend.hidden = counts.size === 0;
  }

  function renderPicker() {
    picker.replaceChildren(
      ...agents.map((agent) => {
        const button = el("button", {
          type: "button",
          "data-key": agent.key,
          "aria-pressed": "false",
          text: `#${agent.cardNumber} ${agent.cardTitle} ${agent.role} ${agent.runtime} ${agent.model}`,
        });
        button.addEventListener("click", () => select(agent.key === selectedKey ? null : agent.key));
        return el("li", {}, [button]);
      }),
    );
  }

  function orderedKeys() {
    return groupByCard(agents).flatMap((card) => card.agents.map((agent) => agent.key));
  }

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(figures.map((figure) => figure.hit), false);
    return hits[0]?.object.userData.key ?? null;
  }

  function onPointerDown(event) {
    pointerStart = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    if (!pointerStart) return;
    const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    pointerStart = null;
    if (moved > 8) return;
    const key = pick(event);
    select(key === selectedKey ? null : key);
  }

  function onPointerMove(event) {
    if (event.pointerType !== "mouse") return;
    canvas.style.cursor = pick(event) ? "pointer" : "";
  }

  function onKeyDown(event) {
    const keys = orderedKeys();
    if (event.key === "Escape") {
      if (selectedKey) {
        select(null);
        event.preventDefault();
      }
      return;
    }
    if (keys.length === 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (event.key === "Home" || event.key === "End") {
      select(event.key === "Home" ? keys[0] : keys[keys.length - 1]);
      event.preventDefault();
      return;
    }
    if (!step && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const index = keys.indexOf(selectedKey);
    if (!step) {
      if (index === -1) select(keys[0]);
      return;
    }
    const next = index === -1 ? (step > 0 ? 0 : keys.length - 1) : (index + step + keys.length) % keys.length;
    select(keys[next]);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    const nextNarrow = w / h < 1.3;
    if (nextNarrow !== narrow) {
      narrow = nextNarrow;
      buildOffice();
    }
    fitCamera();
    requestRender();
  }

  const onTheme = () => buildOffice();
  const onMotion = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    requestRender();
  };
  const onContextLost = (event) => event.preventDefault();
  const onContextRestored = () => buildOffice();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  darkQuery.addEventListener("change", onTheme);
  motionQuery.addEventListener("change", onMotion);
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  return {
    update(next) {
      agents = next;
      empty.hidden = agents.length > 0;
      renderLegend();
      renderPicker();
      buildOffice();
    },
    destroy() {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(renderQueued);
      observer.disconnect();
      darkQuery.removeEventListener("change", onTheme);
      motionQuery.removeEventListener("change", onMotion);
      if (office) disposeTree(office);
      renderer.dispose();
      renderer.forceContextLoss();
      shell.replaceChildren();
    },
  };
}
