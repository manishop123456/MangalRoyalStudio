'use client';

import React, { useEffect, useRef, useState } from 'react';
import { friendlyThrown } from '../lib/customer-messages';

export interface Product3DViewerProps {
  modelUrl: string;
  format: 'GLB' | 'GLTF';
  posterImageUrl?: string;
  productTitle: string;
  metalTintHex?: string;
  onFallbackToGallery?: () => void;
}

interface ParsedMeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uModelViewProjection;
uniform mat3 uNormalMatrix;
out vec3 vNormal;
out vec3 vViewPos;
void main() {
  gl_Position = uModelViewProjection * vec4(aPosition, 1.0);
  vNormal = normalize(uNormalMatrix * aNormal);
  vViewPos = (uModelViewProjection * vec4(aPosition, 1.0)).xyz;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vViewPos;
uniform vec3 uBaseColor;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vec3(0.0, 0.0, 1.0) - vViewPos * 0.15);
  vec3 L1 = normalize(vec3(0.7, 0.9, 0.8));
  vec3 L2 = normalize(vec3(-0.8, -0.4, 0.6));
  vec3 H1 = normalize(L1 + V);
  vec3 H2 = normalize(L2 + V);

  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0) * 0.45;
  float spec1 = pow(max(dot(N, H1), 0.0), 48.0) * 0.85;
  float spec2 = pow(max(dot(N, H2), 0.0), 32.0) * 0.35;
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.25;

  vec3 ambient = uBaseColor * 0.32;
  vec3 color = ambient + uBaseColor * (diff1 + diff2) + vec3(1.0, 0.97, 0.90) * (spec1 + spec2 + fresnel);
  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

function hexToRgbNormalized(hex?: string): [number, number, number] {
  if (!hex) return [0.83, 0.69, 0.22];
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0.83, 0.69, 0.22];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [0.83, 0.69, 0.22];
  return [r, g, b];
}

function readAccessorFloats(
  gltf: any,
  binBuffer: ArrayBuffer,
  accessorIndex: number,
  components: number
): Float32Array {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) return new Float32Array(0);
  const view = gltf.bufferViews?.[accessor.bufferView];
  if (!view) return new Float32Array(0);
  const byteOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = view.byteStride || components * 4;
  const count = accessor.count || 0;
  const out = new Float32Array(count * components);
  const dv = new DataView(binBuffer);
  for (let i = 0; i < count; i += 1) {
    const base = byteOffset + i * stride;
    for (let c = 0; c < components; c += 1) {
      out[i * components + c] = dv.getFloat32(base + c * 4, true);
    }
  }
  return out;
}

function readIndices(gltf: any, binBuffer: ArrayBuffer, accessorIndex: number | undefined, vertexCount: number): Uint32Array {
  if (accessorIndex === undefined) {
    const seq = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i += 1) seq[i] = i;
    return seq;
  }
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) return new Uint32Array(0);
  const view = gltf.bufferViews?.[accessor.bufferView];
  if (!view) return new Uint32Array(0);
  const byteOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const count = accessor.count || 0;
  const out = new Uint32Array(count);
  const dv = new DataView(binBuffer);
  if (accessor.componentType === 5123) {
    for (let i = 0; i < count; i += 1) out[i] = dv.getUint16(byteOffset + i * 2, true);
  } else if (accessor.componentType === 5125) {
    for (let i = 0; i < count; i += 1) out[i] = dv.getUint32(byteOffset + i * 4, true);
  } else {
    for (let i = 0; i < count; i += 1) out[i] = dv.getUint8(byteOffset + i);
  }
  return out;
}

function computeFlatNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;
    const ax = positions[i1] - positions[i0];
    const ay = positions[i1 + 1] - positions[i0 + 1];
    const az = positions[i1 + 2] - positions[i0 + 2];
    const bx = positions[i2] - positions[i0];
    const by = positions[i2 + 1] - positions[i0 + 1];
    const bz = positions[i2 + 2] - positions[i0 + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    for (const idx of [i0, i1, i2]) {
      normals[idx] += nx;
      normals[idx + 1] += ny;
      normals[idx + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len;
    normals[i + 1] /= len;
    normals[i + 2] /= len;
  }
  return normals;
}

function parseGlbBuffer(buffer: ArrayBuffer): ParsedMeshData {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) {
    throw new Error('Invalid GLB header.');
  }
  let offset = 12;
  let gltfJson: any = null;
  let binBuffer: ArrayBuffer | null = null;

  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkType === 0x4e4f534a) {
      const jsonText = new TextDecoder().decode(buffer.slice(chunkStart, chunkEnd));
      gltfJson = JSON.parse(jsonText);
    } else if (chunkType === 0x004e4942) {
      binBuffer = buffer.slice(chunkStart, chunkEnd);
    }
    offset = chunkEnd;
  }

  if (!gltfJson || !binBuffer) {
    throw new Error('GLB file is missing JSON or binary geometry chunk.');
  }

  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  for (const mesh of gltfJson.meshes || []) {
    for (const prim of mesh.primitives || []) {
      const posIdx = prim.attributes?.POSITION;
      if (posIdx === undefined) continue;
      const pos = readAccessorFloats(gltfJson, binBuffer, posIdx, 3);
      const count = pos.length / 3;
      const idx = readIndices(gltfJson, binBuffer, prim.indices, count);
      const normIdx = prim.attributes?.NORMAL;
      const norm =
        normIdx !== undefined
          ? readAccessorFloats(gltfJson, binBuffer, normIdx, 3)
          : computeFlatNormals(pos, idx);

      for (let i = 0; i < pos.length; i += 1) {
        allPositions.push(pos[i]);
        allNormals.push(norm[i] ?? 0);
      }
      for (let i = 0; i < idx.length; i += 1) {
        allIndices.push(idx[i] + vertexOffset);
      }
      vertexOffset += count;
    }
  }

  if (allPositions.length === 0) {
    throw new Error('No 3D mesh geometry found in model asset.');
  }

  // Center and normalize geometry to unit radius
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < allPositions.length; i += 3) {
    minX = Math.min(minX, allPositions[i]);
    maxX = Math.max(maxX, allPositions[i]);
    minY = Math.min(minY, allPositions[i + 1]);
    maxY = Math.max(maxY, allPositions[i + 1]);
    minZ = Math.min(minZ, allPositions[i + 2]);
    maxZ = Math.max(maxZ, allPositions[i + 2]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const scale = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const normPos = new Float32Array(allPositions.length);
  for (let i = 0; i < allPositions.length; i += 3) {
    normPos[i] = ((allPositions[i] - cx) / scale) * 1.45;
    normPos[i + 1] = ((allPositions[i + 1] - cy) / scale) * 1.45;
    normPos[i + 2] = ((allPositions[i + 2] - cz) / scale) * 1.45;
  }

  return {
    positions: normPos,
    normals: new Float32Array(allNormals),
    indices: new Uint32Array(allIndices),
  };
}

export default function Product3DViewer({
  modelUrl,
  format,
  posterImageUrl,
  productTitle,
  metalTintHex,
  onFallbackToGallery,
}: Product3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef({ yaw: 0.45, pitch: 0.3, zoom: 1.0, autoSpin: true });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const tintRef = useRef<[number, number, number]>(hexToRgbNormalized(metalTintHex));

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [autoSpin, setAutoSpin] = useState(true);

  useEffect(() => {
    tintRef.current = hexToRgbNormalized(metalTintHex);
  }, [metalTintHex]);

  useEffect(() => {
    rotationRef.current.autoSpin = autoSpin;
  }, [autoSpin]);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    async function init() {
      setStatus('loading');
      setErrorMsg('');
      try {
        if (format !== 'GLB') {
          throw new Error('Only binary .glb assets are supported in the interactive WebGL2 viewer.');
        }
        const res = await fetch(modelUrl);
        if (!res.ok) throw new Error(`Failed to fetch 3D model (${res.status}).`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        const mesh = parseGlbBuffer(buffer);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
        if (!gl) throw new Error('WebGL2 is not supported by this browser.');

        const compile = (type: number, src: string) => {
          const sh = gl.createShader(type)!;
          gl.shaderSource(sh, src);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(sh) || 'Shader compilation failed');
          }
          return sh;
        };

        const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.useProgram(prog);

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
        const posLoc = gl.getAttribLocation(prog, 'aPosition');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

        const normBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
        const normLoc = gl.getAttribLocation(prog, 'aNormal');
        gl.enableVertexAttribArray(normLoc);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

        const idxBuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

        const mvpLoc = gl.getUniformLocation(prog, 'uModelViewProjection');
        const nMatLoc = gl.getUniformLocation(prog, 'uNormalMatrix');
        const colorLoc = gl.getUniformLocation(prog, 'uBaseColor');

        gl.enable(gl.DEPTH_TEST);
        setStatus('ready');

        const render = () => {
          if (cancelled) return;
          const dpr = window.devicePixelRatio || 1;
          const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
          const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          gl.viewport(0, 0, w, h);
          gl.clearColor(0.98, 0.965, 0.95, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

          if (rotationRef.current.autoSpin && !dragRef.current.active) {
            rotationRef.current.yaw += 0.008;
          }

          const { yaw, pitch, zoom } = rotationRef.current;
          const cy = Math.cos(yaw), sy = Math.sin(yaw);
          const cp = Math.cos(pitch), sp = Math.sin(pitch);
          const aspect = w / h;
          const s = zoom;

          const rot = [
            cy, sy * sp, -sy * cp,
            0, cp, sp,
            sy, -cy * sp, cy * cp,
          ];
          const mvp = new Float32Array([
            (rot[0] * s) / aspect, rot[3] * s, rot[6] * s * 0.4, 0,
            (rot[1] * s) / aspect, rot[4] * s, rot[7] * s * 0.4, 0,
            (rot[2] * s) / aspect, rot[5] * s, rot[8] * s * 0.4, 0,
            0, 0, 0, 1,
          ]);

          gl.uniformMatrix4fv(mvpLoc, false, mvp);
          gl.uniformMatrix3fv(nMatLoc, false, new Float32Array(rot));
          gl.uniform3fv(colorLoc, new Float32Array(tintRef.current));

          gl.bindVertexArray(vao);
          gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_INT, 0);
          rafId = requestAnimationFrame(render);
        };
        rafId = requestAnimationFrame(render);
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(friendlyThrown(err, 'Unable to initialize 3D view.'));
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [modelUrl, format]);

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-[var(--mrs-border)] bg-[#FAF7F5] p-6 text-center">
        {posterImageUrl ? (
          <img
            src={posterImageUrl}
            alt={productTitle}
            className="mx-auto mb-4 max-h-72 rounded object-contain"
          />
        ) : null}
        <p className="text-sm font-medium text-[#7D132A]">Interactive 3D view unavailable</p>
        <p className="mt-1 text-xs text-neutral-600">{errorMsg}</p>
        {onFallbackToGallery ? (
          <button
            type="button"
            onClick={onFallbackToGallery}
            className="mt-4 rounded border border-[#7D132A] px-4 py-1.5 text-xs font-medium text-[#7D132A] hover:bg-[#7D132A] hover:text-white"
          >
            Return to Photo Gallery
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--mrs-border)] bg-[#FAF7F5]">
      <canvas
        ref={canvasRef}
        aria-label={`Interactive 3D model of ${productTitle}`}
        className="h-[380px] w-full cursor-grab active:cursor-grabbing sm:h-[460px]"
        onPointerDown={(e) => {
          dragRef.current = { active: true, x: e.clientX, y: e.clientY };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          dragRef.current = { active: true, x: e.clientX, y: e.clientY };
          rotationRef.current.yaw += dx * 0.012;
          rotationRef.current.pitch = Math.max(-1.2, Math.min(1.2, rotationRef.current.pitch + dy * 0.012));
        }}
        onPointerUp={() => {
          dragRef.current.active = false;
        }}
        onWheel={(e) => {
          e.preventDefault();
          rotationRef.current.zoom = Math.max(0.55, Math.min(2.2, rotationRef.current.zoom - e.deltaY * 0.001));
        }}
      />

      {status === 'loading' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAF7F5]/90">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7D132A] border-t-transparent" />
          <p className="mt-3 text-xs tracking-wider text-neutral-600 uppercase">Loading 3D Studio Asset...</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--mrs-border)] bg-white/90 px-3 py-2 text-xs">
        <span className="text-neutral-600">Drag to orbit · Scroll to zoom</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSpin((s) => !s)}
            className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-700 hover:border-[#7D132A] hover:text-[#7D132A]"
          >
            {autoSpin ? 'Pause Spin' : 'Auto Spin'}
          </button>
          <button
            type="button"
            onClick={() => {
              rotationRef.current = { yaw: 0.45, pitch: 0.3, zoom: 1.0, autoSpin };
            }}
            className="rounded border border-neutral-300 px-2.5 py-1 text-neutral-700 hover:border-[#7D132A] hover:text-[#7D132A]"
          >
            Reset View
          </button>
        </div>
      </div>
    </div>
  );
}
