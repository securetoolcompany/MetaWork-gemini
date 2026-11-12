'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default function ModelViewer({
  geometry,
  color = '#60a5fa',
  wireframe = false,
  autoRotate = false,
  showGrid = true,
  resetKey = 0,
}) {
  const hostRef = useRef(null);
  const runtimeRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !geometry) return undefined;

    setError('');
    let renderer;
    let controls;
    let displayGeometry;
    let material;
    let grid;
    let resizeObserver;
    let intersectionObserver;
    let frame = 0;
    let disposed = false;
    let visible = true;
    let contextLost = false;
    let previousTime = 0;
    let runtime;

    const canRender = () =>
      !disposed && !contextLost && visible && !document.hidden;

    function requestRender() {
      if (frame || !canRender()) return;
      frame = requestAnimationFrame(render);
    }

    function render(time) {
      frame = 0;
      if (!canRender() || !runtime) return;
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
      previousTime = time;
      controls.update(delta);
      renderer.render(runtime.scene, runtime.camera);
      if (controls.autoRotate) requestRender();
    }

    function pauseOrResume() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      requestRender();
    }

    function onContextLost(event) {
      event.preventDefault();
      contextLost = true;
      pauseOrResume();
      setError('The graphics context was interrupted. Reload this page to retry.');
    }

    function cleanup() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', pauseOrResume);
      controls?.removeEventListener('change', requestRender);
      controls?.dispose();
      renderer?.domElement.removeEventListener('webglcontextlost', onContextLost);
      displayGeometry?.dispose();
      material?.dispose();
      grid?.geometry.dispose();
      if (grid) {
        const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
        materials.forEach(item => item.dispose());
      }
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor('#090d16');
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.setAttribute('aria-label', 'Interactive 3D model. Drag to orbit, scroll or pinch to zoom, right-drag or use two fingers to pan.');
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false;
      controls.minDistance = 0.15;
      controls.maxDistance = 30;
      controls.autoRotateSpeed = 1.5;
      controls.addEventListener('change', requestRender);

      displayGeometry = geometry.clone();
      displayGeometry.computeBoundingBox();
      const box = displayGeometry.boundingBox;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const scale = 2 / Math.max(size.x, size.y, size.z);
      const position = displayGeometry.getAttribute('position');

      for (let index = 0; index < position.count; index++) {
        position.setXYZ(
          index,
          (position.getX(index) - center.x) * scale,
          (position.getY(index) - center.y) * scale,
          (position.getZ(index) - center.z) * scale,
        );
      }
      position.needsUpdate = true;
      displayGeometry.computeVertexNormals();
      displayGeometry.computeBoundingBox();
      displayGeometry.computeBoundingSphere();

      material = new THREE.MeshStandardMaterial({
        color: '#60a5fa',
        metalness: 0.3,
        roughness: 0.4,
        flatShading: true,
        side: THREE.DoubleSide,
      });
      scene.add(new THREE.Mesh(displayGeometry, material));
      scene.add(new THREE.HemisphereLight('#dbeafe', '#172033', 2.3));
      const keyLight = new THREE.DirectionalLight('#ffffff', 3.5);
      keyLight.position.set(4, 6, 5);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight('#38bdf8', 2);
      rimLight.position.set(-4, 2, -3);
      scene.add(rimLight);

      grid = new THREE.GridHelper(8, 32, '#334155', '#182436');
      grid.position.y = displayGeometry.boundingBox.min.y - 0.025;
      scene.add(grid);

      function fit() {
        const vertical = THREE.MathUtils.degToRad(camera.fov);
        const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
        const radius = displayGeometry.boundingSphere.radius;
        const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.18;
        controls.maxDistance = Math.max(30, distance * 3);
        camera.far = Math.max(100, distance * 6);
        camera.position.copy(new THREE.Vector3(1.3, 0.9, 1.7).normalize().multiplyScalar(distance));
        controls.target.set(0, 0, 0);
        camera.updateProjectionMatrix();
        controls.update();
        requestRender();
      }

      function resize() {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        fit();
      }

      runtime = { scene, camera, controls, material, grid, fit, requestRender };
      runtimeRef.current = runtime;
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      intersectionObserver = new IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting ?? true;
        pauseOrResume();
      });
      intersectionObserver.observe(host);
      document.addEventListener('visibilitychange', pauseOrResume);
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      resize();
    } catch {
      cleanup();
      setError('3D rendering is unavailable. Try a browser with WebGL 2 and hardware acceleration enabled.');
    }

    return cleanup;
  }, [geometry]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.material.color.set(color);
    runtime.material.wireframe = wireframe;
    runtime.controls.autoRotate = autoRotate;
    runtime.grid.visible = showGrid;
    runtime.requestRender();
  }, [geometry, color, wireframe, autoRotate, showGrid]);

  useEffect(() => {
    runtimeRef.current?.fit();
  }, [geometry, resetKey]);

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden rounded-xl bg-[#090d16]">
      <div ref={hostRef} className="absolute inset-0" data-testid="model-viewer-canvas" />
      {error && (
        <div role="alert" className="absolute inset-0 flex items-center justify-center bg-zinc-950/95 p-8">
          <div className="max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
            <h2 className="text-lg font-semibold text-zinc-100">3D preview unavailable</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
