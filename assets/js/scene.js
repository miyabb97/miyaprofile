/* ==========================================================================
   Hero scene — "Systems, mapped & moving"
   A faceted core held inside two orbit rings, with satellites tracking it.
   Pastel, matte, softly lit: personality without noise.
   ========================================================================== */

(function () {
  'use strict';

  var canvas = document.getElementById('scene');
  var stage  = document.getElementById('stage');
  if (!canvas || !stage) return;

  // No WebGL, or the CDN never arrived — leave a calm static mark instead.
  if (typeof THREE === 'undefined') { fallback(); return; }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PALETTE = {
    lime:   0xdcf0a2,
    lav:    0xcfc7f2,
    blue:   0xbedcf2,
    peach:  0xf7cdab,
    chalk:  0xfdfcf9,
    ink:    0x2a2a30
  };

  var renderer, scene, camera, system, core, rings = [], sats = [];
  var running = false, t0 = performance.now();

  /* ── pointer state: where it wants to be, and where it currently is ── */
  var aim = { x: 0, y: 0 }, now = { x: 0, y: 0 };
  var drag = { active: false, startX: 0, startY: 0, spin: 0, spinAim: 0 };
  var scrollTilt = 0;

  try { init(); } catch (err) { fallback(); return; }

  function init() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
    });
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(0, 0.75, 8.0);
    camera.lookAt(0, -0.1, 0);

    buildLights();
    buildSystem();
    buildShadowCatcher();

    resize();

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener('resize', resize);

    bindPointer();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Only burn frames while the hero is actually on screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0.02 }).observe(stage);
    } else { start(); }

    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    if (reduced) { render(0); stop(); }
    else start();

    stage.classList.add('is-live');
  }

  /* ─────────────────────────── lighting ─────────────────────────── */

  function buildLights() {
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe6e1d6, 1.05));

    var key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3.4, 5.6, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    // VSM blurs the map itself, which is what turns the contact shadow from a
    // flat grey pancake into something with a real falloff.
    key.shadow.radius = 7;
    key.shadow.blurSamples = 16;
    key.shadow.bias = -0.0008;
    // Frustum hugs the core. Anything outside it would sample garbage and
    // smear stray blocks across the floor, so keep it tight and deliberate.
    var c = key.shadow.camera;
    c.near = 1; c.far = 18; c.left = -3; c.right = 3; c.top = 3; c.bottom = -3;
    scene.add(key);

    // warm bounce from the lower left, keeps the shadow side from going grey
    var fill = new THREE.DirectionalLight(0xffe9d6, 0.55);
    fill.position.set(-4.5, -1.2, 2.6);
    scene.add(fill);

    // cool rim so silhouettes read against the warm white page
    var rim = new THREE.DirectionalLight(0xdfe8ff, 0.7);
    rim.position.set(-1.6, 2.4, -5);
    scene.add(rim);
  }

  /* ─────────────────────────── geometry ─────────────────────────── */

  function matte(color, rough, flat) {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: rough === undefined ? 0.55 : rough,
      metalness: 0,
      flatShading: !!flat
    });
  }

  function buildSystem() {
    system = new THREE.Group();
    scene.add(system);

    /* the core — faceted, so it catches light in planes rather than a blur */
    core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.06, 1),
      matte(PALETTE.lime, 0.5, true)
    );
    core.castShadow = true;
    core.receiveShadow = true;
    system.add(core);

    /* a second, slightly larger wireframe shell — reads as "structure around data" */
    var shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.46, 1),
      new THREE.MeshBasicMaterial({
        color: 0x9aa08a, wireframe: true, transparent: true, opacity: 0.18
      })
    );
    system.add(shell);
    rings.push({ mesh: shell, sx: 0.055, sy: 0.09, sz: 0 });

    /* Orbits. Each is a group holding the visible ring plus everything that
       travels on it, so a satellite can never drift off its own track. */
    var orbits = [
      { r: 2.20, tube: 0.026, color: PALETTE.lav,  rot: [1.15,  0.15,  0.35], spin:  0.16 },
      { r: 2.76, tube: 0.020, color: PALETTE.blue, rot: [1.28, -0.50, -0.20], spin: -0.11 },
      { r: 1.82, tube: 0,     color: null,         rot: [0.55,  0.80,  0.00], spin:  0.07 }
    ].map(function (o) {
      var g = new THREE.Group();
      g.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
      if (o.tube) {
        var ring = new THREE.Mesh(
          new THREE.TorusGeometry(o.r, o.tube, 14, 180),
          matte(o.color, 0.35)
        );
        // rings deliberately cast no shadow — otherwise the contact shadow
        // becomes an unreadable smear instead of a soft anchor under the core
        g.add(ring);
      }
      system.add(g);
      rings.push({ mesh: g, sx: 0, sy: 0, sz: o.spin });
      return { group: g, r: o.r };
    });

    /* satellites — each pinned to an orbit, each with its own tempo */
    var satSpecs = [
      { geo: new THREE.SphereGeometry(0.30, 32, 24),       color: PALETTE.peach, orbit: 0, phase: 0.0, speed:  0.30 },
      { geo: new THREE.OctahedronGeometry(0.30, 0),        color: PALETTE.blue,  orbit: 0, phase: 3.6, speed:  0.30 },
      { geo: new THREE.BoxGeometry(0.38, 0.38, 0.38),      color: PALETTE.chalk, orbit: 1, phase: 2.1, speed: -0.22 },
      { geo: new THREE.CapsuleGeometry(0.13, 0.30, 6, 16), color: PALETTE.lav,   orbit: 1, phase: 5.0, speed: -0.22 },
      { geo: new THREE.SphereGeometry(0.15, 24, 18),       color: PALETTE.ink,   orbit: 2, phase: 1.2, speed:  0.44 }
    ];
    satSpecs.forEach(function (s) {
      var o = orbits[s.orbit];
      // Satellites don't cast: five scattered shadows read as dirt, one reads as weight.
      var m = new THREE.Mesh(s.geo, matte(s.color, s.color === PALETTE.ink ? 0.32 : 0.5));
      o.group.add(m);
      sats.push({ mesh: m, r: o.r, phase: s.phase, speed: s.speed });
    });

    system.scale.setScalar(0.94);
  }

  function buildShadowCatcher() {
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.15;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  /* ─────────────────────────── interaction ─────────────────────────── */

  function bindPointer() {
    // Parallax follows the whole hero area, not just the canvas — feels less twitchy.
    var zone = stage.closest('.hero') || stage;

    zone.addEventListener('pointermove', function (e) {
      var r = zone.getBoundingClientRect();
      aim.x = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      aim.y = ((e.clientY - r.top)  / r.height - 0.5) * 2;
    });
    zone.addEventListener('pointerleave', function () { aim.x = 0; aim.y = 0; });

    canvas.addEventListener('pointerdown', function (e) {
      drag.active = true; drag.startX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag.active) return;
      drag.spinAim += (e.clientX - drag.startX) * 0.006;
      drag.startX = e.clientX;
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      canvas.addEventListener(ev, function () { drag.active = false; });
    });
  }

  function onScroll() {
    var r = stage.getBoundingClientRect();
    scrollTilt = Math.max(-1, Math.min(1, -r.top / (window.innerHeight || 800)));
  }

  /* ─────────────────────────── loop ─────────────────────────── */

  function start() {
    if (running || reduced) return;
    running = true;
    requestAnimationFrame(tick);
  }
  function stop() { running = false; }

  function tick(now_) {
    if (!running) return;
    render((now_ - t0) / 1000);
    requestAnimationFrame(tick);
  }

  function render(t) {
    // ease toward the pointer rather than snapping to it
    now.x += (aim.x - now.x) * 0.055;
    now.y += (aim.y - now.y) * 0.055;
    drag.spin += (drag.spinAim - drag.spin) * 0.08;

    system.rotation.y = t * 0.11 + now.x * 0.38 + drag.spin + scrollTilt * 0.5;
    system.rotation.x = now.y * 0.24 + Math.sin(t * 0.35) * 0.045 - scrollTilt * 0.12;
    system.position.y = Math.sin(t * 0.55) * 0.11 - 0.05;

    core.rotation.x = t * 0.16;
    core.rotation.z = t * 0.09;

    rings.forEach(function (r) {
      r.mesh.rotation.x += r.sx * 0.016;
      r.mesh.rotation.y += r.sy * 0.016;
      r.mesh.rotation.z += r.sz * 0.016;
    });

    sats.forEach(function (s) {
      var a = t * s.speed + s.phase;
      s.mesh.position.set(Math.cos(a) * s.r, Math.sin(a) * s.r, 0);
      s.mesh.rotation.x = a * 0.9;
      s.mesh.rotation.y = a * 0.6;
    });

    renderer.render(scene, camera);
  }

  /* ─────────────────────────── sizing ─────────────────────────── */

  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // When the stage is taller than it is wide, width becomes the limiting
    // dimension, so back off by exactly that much and no more.
    camera.position.z = 8.0 / Math.min(1, camera.aspect);
    camera.updateProjectionMatrix();
    if (!running) render((performance.now() - t0) / 1000);
  }

  /* ─────────────────────────── fallback ─────────────────────────── */

  function fallback() {
    if (canvas) canvas.remove();
    stage.classList.add('is-fallback');
  }
})();
