import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D, { type ForceGraphMethods as FG3DMethods } from 'react-force-graph-3d';
import ForceGraph2D, { type ForceGraphMethods as FG2DMethods } from 'react-force-graph-2d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import type { BrainLink, BrainNode } from '@/types';
import { useBrainStore } from '@/stores/brain';
import { useSettingsStore } from '@/stores/settings';
import { searchNodes, subgraphIds } from '@/lib/graph';
import { CATEGORY_META } from '@/lib/utils';

/**
 * Graph engine choice: react-force-graph (3d-force-graph / d3-force-3d under the hood)
 * over hand-rolled react-three-fiber physics. Rationale: it ships a WebGL renderer with
 * a battle-tested force simulation, level-headed defaults, built-in link particles and
 * camera tweening — an order of magnitude less custom code on the hot path, which is
 * exactly where 60fps lives. R3F remains open for future custom shader work.
 */

interface RenderNode {
  id: string;
  name: string;
  val: number;
  category: BrainNode['category'];
  importance: number;
  x?: number;
  y?: number;
  z?: number;
}
interface RenderLink {
  source: string | RenderNode;
  target: string | RenderNode;
  kind: 'wiki' | 'manual';
}

/** Coarse pointer ≈ phone/tablet: smaller GPU, fewer pixels, lighter geometry. */
const IS_COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const DIM = 'rgba(94,87,74,0.18)';
const DIM_LINK = 'rgba(94,87,74,0.06)';
const LINK_BASE = 'rgba(230,195,124,0.13)';
const LINK_HOT = 'rgba(245,223,172,0.85)';

function idOf(end: string | RenderNode): string {
  return typeof end === 'string' ? end : end.id;
}

/** Soft radial glow texture, generated once — gives every node a halo without postprocessing. */
let haloTexture: THREE.Texture | null = null;
function getHaloTexture(): THREE.Texture {
  if (haloTexture) return haloTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.07)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  haloTexture = new THREE.CanvasTexture(c);
  return haloTexture;
}

export const GraphCanvas = memo(function GraphCanvas({
  nodes,
  links,
  paused = false,
}: {
  nodes: BrainNode[];
  links: BrainLink[];
  paused?: boolean;
}) {
  const fg3dRef = useRef<FG3DMethods | undefined>(undefined);
  const fg2dRef = useRef<FG2DMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const viewMode = useBrainStore((s) => s.viewMode);
  const selectedId = useBrainStore((s) => s.selectedId);
  const searchQuery = useBrainStore((s) => s.searchQuery);
  const activeCategories = useBrainStore((s) => s.activeCategories);
  const activeTypes = useBrainStore((s) => s.activeTypes);
  const focusQuery = useBrainStore((s) => s.focusQuery);
  const select = useBrainStore((s) => s.select);
  const physics = useSettingsStore((s) => s.physics);

  // Track container size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pause the render loop when the view is hidden — the WebGL context stays warm.
  useEffect(() => {
    const fg = viewMode === '3d' ? fg3dRef.current : fg2dRef.current;
    if (!fg) return;
    if (paused) fg.pauseAnimation();
    else fg.resumeAnimation();
  });

  // Surface WebGL context loss instead of silently going black.
  useEffect(() => {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas || viewMode !== '3d') return;
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [viewMode]);

  // Cap the render resolution — full devicePixelRatio on a phone melts the frame budget.
  useEffect(() => {
    const renderer = fg3dRef.current?.renderer();
    if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_COARSE ? 1.5 : 2));
  }, [viewMode]);

  // The galaxy: a static starfield + exponential fog turn the void into the Milky Way.
  // Distant stars are cheap (one Points draw call) and sell the "god's eye" scale.
  useEffect(() => {
    if (viewMode !== '3d') return;
    const fg = fg3dRef.current;
    if (!fg) return;
    const scene = fg.scene();
    if (!scene || scene.getObjectByName('galaxy-stars')) return;

    scene.fog = new THREE.FogExp2(0x0b0a08, 0.0011);

    const N = IS_COARSE ? 1400 : 2600;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const palette = [
      new THREE.Color('#efe8d8'), // warm white — most stars
      new THREE.Color('#efe8d8'),
      new THREE.Color('#efe8d8'),
      new THREE.Color('#e6c37c'), // gold
      new THREE.Color('#9fb8d8'), // pale blue giants
    ];
    for (let i = 0; i < N; i++) {
      // Flattened spheroid — a galactic disc with a bright band, not a uniform cloud.
      const r = 380 + Math.random() * 1100;
      const theta = Math.random() * Math.PI * 2;
      const band = Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? 1 : -1);
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = band * r * 0.35;
      pos[i * 3 + 2] = Math.sin(theta) * r;
      const c = palette[Math.floor(Math.random() * palette.length)];
      const dim = 0.35 + Math.random() * 0.65;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.2,
      map: getHaloTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(geo, mat);
    stars.name = 'galaxy-stars';
    scene.add(stars);
  }, [viewMode]);

  // Cinematic idle drift: slow auto-rotate while nothing is selected or hovered.
  useEffect(() => {
    const controls = fg3dRef.current?.controls() as
      | { autoRotate?: boolean; autoRotateSpeed?: number }
      | undefined;
    if (!controls) return;
    controls.autoRotate = viewMode === '3d' && !selectedId && !hoverId && !paused;
    controls.autoRotateSpeed = 0.45;
  }, [viewMode, selectedId, hoverId, paused]);

  /* Focus mode: cut the rendered graph down to the subgraph around the query. */
  const focusedIds = useMemo(() => {
    if (!focusQuery) return null;
    const seeds = new Set(searchNodes(nodes, focusQuery).map((n) => n.id));
    if (seeds.size === 0) return null;
    return subgraphIds(seeds, links, 1);
  }, [focusQuery, nodes, links]);

  /* Category/type filters and search produce a highlight set (dim the rest). */
  const highlightIds = useMemo(() => {
    let pool = nodes;
    if (activeCategories.length) pool = pool.filter((n) => activeCategories.includes(n.category));
    if (activeTypes.length) pool = pool.filter((n) => activeTypes.includes(n.type));
    if (searchQuery.trim()) pool = searchNodes(pool, searchQuery);
    const filtered = activeCategories.length || activeTypes.length || searchQuery.trim();
    return filtered ? new Set(pool.map((n) => n.id)) : null;
  }, [nodes, activeCategories, activeTypes, searchQuery]);

  /* Selection neighborhood for link particles + emphasis. */
  const neighborIds = useMemo(() => {
    const anchor = selectedId ?? hoverId;
    if (!anchor) return null;
    const set = new Set<string>([anchor]);
    for (const l of links) {
      if (l.source === anchor) set.add(l.target);
      if (l.target === anchor) set.add(l.source);
    }
    return set;
  }, [selectedId, hoverId, links]);

  /* Mutable copies for the force engine — rebuilt only when the graph itself changes. */
  const graphData = useMemo(() => {
    const keep = (n: BrainNode) => !focusedIds || focusedIds.has(n.id);
    const rNodes: RenderNode[] = nodes.filter(keep).map((n) => ({
      id: n.id,
      name: n.title,
      val: n.importance * 2.2 + (n.pinned ? 2 : 0),
      category: n.category,
      importance: n.importance,
    }));
    const ids = new Set(rNodes.map((n) => n.id));
    const rLinks: RenderLink[] = links
      .filter((l) => ids.has(l.source) && ids.has(l.target))
      .map((l) => ({ ...l }));
    return { nodes: rNodes, links: rLinks };
  }, [nodes, links, focusedIds]);

  /* Apply physics settings to the active engine. */
  useEffect(() => {
    const fg = viewMode === '3d' ? fg3dRef.current : fg2dRef.current;
    if (!fg) return;
    const charge = fg.d3Force('charge') as { strength?: (v: number) => void } | undefined;
    charge?.strength?.(physics.chargeStrength);
    const link = fg.d3Force('link') as { distance?: (v: number) => void } | undefined;
    link?.distance?.(physics.linkDistance);
    fg.d3ReheatSimulation();
  }, [physics, viewMode, graphData]);

  const isLit = useCallback(
    (id: string) => {
      if (highlightIds && !highlightIds.has(id)) return false;
      return true;
    },
    [highlightIds]
  );

  const nodeColor = useCallback(
    (node: RenderNode) => {
      if (!isLit(node.id)) return DIM;
      if (node.id === selectedId) return '#ffffff';
      return CATEGORY_META[node.category].color;
    },
    [isLit, selectedId]
  );

  const linkColor = useCallback(
    (link: RenderLink) => {
      const s = idOf(link.source);
      const t = idOf(link.target);
      if (highlightIds && (!highlightIds.has(s) || !highlightIds.has(t))) return DIM_LINK;
      if (neighborIds && (neighborIds.has(s) || neighborIds.has(t)) && (s === (selectedId ?? hoverId) || t === (selectedId ?? hoverId)))
        return LINK_HOT;
      return LINK_BASE;
    },
    [highlightIds, neighborIds, selectedId, hoverId]
  );

  const linkParticles = useCallback(
    (link: RenderLink) => {
      const anchor = selectedId ?? hoverId;
      if (!anchor) return 0;
      return idOf(link.source) === anchor || idOf(link.target) === anchor ? (IS_COARSE ? 2 : 3) : 0;
    },
    [selectedId, hoverId]
  );

  const handleClick = useCallback(
    (node: RenderNode) => {
      select(node.id);
      if (viewMode === '3d' && fg3dRef.current && node.x !== undefined) {
        const dist = 130;
        const ratio = 1 + dist / (Math.hypot(node.x, node.y ?? 0, node.z ?? 0) || 1);
        fg3dRef.current.cameraPosition(
          { x: node.x * ratio, y: (node.y ?? 0) * ratio, z: (node.z ?? 0) * ratio },
          { x: node.x, y: node.y ?? 0, z: node.z ?? 0 },
          900
        );
      }
      if (viewMode === '2d' && fg2dRef.current && node.x !== undefined) {
        fg2dRef.current.centerAt(node.x, node.y, 700);
        fg2dRef.current.zoom(3, 700);
      }
    },
    [select, viewMode]
  );

  /* 3D: additive glow halo on every node + serif label sprites on important / active ones. */
  const nodeThreeObject = useCallback(
    (node: RenderNode) => {
      const group = new THREE.Group();
      const active = node.id === selectedId || node.id === hoverId;
      const lit = isLit(node.id);
      const color = new THREE.Color(lit ? CATEGORY_META[node.category].color : '#5e574a');

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getHaloTexture(),
          color,
          transparent: true,
          opacity: lit ? (active ? 0.85 : 0.4) : 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const r = (4 + node.val * 1.6) * (active ? 3.4 : 2.5);
      halo.scale.set(r, r, 1);
      group.add(halo);

      if (node.importance >= 2 || active) {
        const label = new SpriteText(node.name);
        label.color = lit ? (active ? '#F5DFAC' : 'rgba(239,232,216,0.8)') : 'rgba(154,143,120,0.3)';
        label.textHeight = active ? 4.4 : 3;
        label.fontFace = 'Marcellus, Georgia, serif';
        label.backgroundColor = 'rgba(11,10,8,0.45)';
        label.padding = 1.6;
        label.borderRadius = 2;
        label.position.y = -(8 + node.val);
        group.add(label as unknown as THREE.Object3D);
      }
      return group;
    },
    [selectedId, hoverId, isLit]
  );

  /* 2D fallback: crisp canvas glow discs + labels when zoomed in. */
  const node2D = useCallback(
    (node: RenderNode, ctx: CanvasRenderingContext2D, scale: number) => {
      // First simulation ticks can hand us nodes without finite positions — skip them
      // or canvas gradient calls throw and take the whole tree down.
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
      const lit = isLit(node.id);
      const color = lit ? CATEGORY_META[node.category].color : DIM;
      const r = 2 + node.importance * 1.6;
      if (lit) {
        const grad = ctx.createRadialGradient(node.x!, node.y!, 0, node.x!, node.y!, r * 3);
        grad.addColorStop(0, `${color}55`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = node.id === selectedId ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, r, 0, Math.PI * 2);
      ctx.fill();
      if ((scale > 1.8 || node.importance >= 3 || node.id === selectedId) && lit) {
        ctx.font = `${Math.max(3.2, 10 / scale)}px Marcellus, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(239,232,216,0.85)';
        ctx.fillText(node.name, node.x!, node.y! + r + Math.max(4, 12 / scale));
      }
    },
    [isLit, selectedId]
  );

  const common = {
    graphData,
    nodeId: 'id' as const,
    backgroundColor: 'rgba(0,0,0,0)',
    width: size.w,
    height: size.h,
    onNodeClick: handleClick as (node: object) => void,
    onNodeHover: ((n: RenderNode | null) => setHoverId(n?.id ?? null)) as (node: object | null) => void,
    onBackgroundClick: () => select(null),
    linkDirectionalParticles: linkParticles as (l: object) => number,
    linkDirectionalParticleWidth: 1.6,
    linkDirectionalParticleColor: () => '#F5DFAC',
    linkDirectionalParticleSpeed: physics.particleSpeed,
    cooldownTicks: 200,
    warmupTicks: 40,
  };

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {contextLost && (
        <div className="absolute inset-0 z-10 grid place-items-center">
          <div className="glass border-alert/30 p-5 text-center">
            <p className="font-mono text-xs tracking-widest text-alert">RENDER CONTEXT LOST</p>
            <button onClick={() => window.location.reload()} className="btn-holo mt-3">
              Reinitialize
            </button>
          </div>
        </div>
      )}
      {viewMode === '3d' ? (
        <ForceGraph3D
          ref={fg3dRef}
          {...common}
          nodeColor={nodeColor as (n: object) => string}
          nodeOpacity={0.95}
          nodeRelSize={3.2}
          nodeResolution={IS_COARSE ? 8 : 12}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodeThreeObject={nodeThreeObject as any}
          nodeThreeObjectExtend={true}
          linkColor={linkColor as (l: object) => string}
          linkOpacity={0.35}
          linkWidth={(l: object) => ((l as RenderLink).kind === 'manual' ? 1.2 : 0.6)}
          showNavInfo={false}
          d3VelocityDecay={physics.velocityDecay}
        />
      ) : (
        <ForceGraph2D
          ref={fg2dRef}
          {...common}
          nodeCanvasObject={node2D as unknown as (n: object, ctx: CanvasRenderingContext2D, s: number) => void}
          linkColor={linkColor as (l: object) => string}
          linkWidth={(l: object) => ((l as RenderLink).kind === 'manual' ? 1.4 : 0.7)}
          d3VelocityDecay={physics.velocityDecay}
        />
      )}
    </div>
  );
});
