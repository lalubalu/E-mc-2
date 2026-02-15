(() => {
  const canvas = document.getElementById("viz");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    return;
  }

  const zoomBtn = document.getElementById("zoomBtn");

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const config = {
    fov: 560,
    cameraZ: 520,
    timeScale: prefersReduced ? 0.35 : 1,
    starCount: 260,
    maxTrail: 90
  };

  const trailPalette = [
    { color: "#fbbf24", glow: "rgba(251,191,36,0.7)" },
    { color: "#0b0b10", glow: "rgba(59,130,246,0.25)" },
    { color: "#3b82f6", glow: "rgba(59,130,246,0.65)" }
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let orbitScale = 1;
  let sizeScale = 1;

  let stars = [];
  let trail = [];
  let lastTime = performance.now();
  let isZooming = false;
  let zoomTimer = null;

  const pointer = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, px: 0.5, py: 0.5 };

  const planets = [
    { name: "Mercury", r: 70, size: 1.0, speed: 1.6, color: "#b7b7b7", tiltX: 0.4, tiltY: 0.2 },
    { name: "Venus", r: 110, size: 1.4, speed: 1.25, color: "#f6c453", tiltX: -0.3, tiltY: 0.15 },
    { name: "Earth", r: 150, size: 1.5, speed: 1.05, color: "#7dd3fc", tiltX: 0.2, tiltY: -0.35 },
    { name: "Mars", r: 190, size: 1.3, speed: 0.9, color: "#f97316", tiltX: 0.5, tiltY: 0.25 },
    { name: "Jupiter", r: 250, size: 2.8, speed: 0.62, color: "#fde68a", tiltX: -0.2, tiltY: 0.5 },
    { name: "Saturn", r: 310, size: 2.6, speed: 0.52, color: "#fcd34d", tiltX: 0.15, tiltY: -0.55, ring: true, ringTilt: -0.5 },
    { name: "Uranus", r: 370, size: 2.0, speed: 0.42, color: "#67e8f9", tiltX: -0.4, tiltY: 0.2 },
    { name: "Neptune", r: 430, size: 2.0, speed: 0.35, color: "#60a5fa", tiltX: 0.3, tiltY: -0.2 }
  ];

  for (let i = 0; i < planets.length; i++) {
    planets[i].phase = Math.random() * Math.PI * 2;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function rgba(hex, a) {
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function mix(hex, mixValue, a) {
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);
    r = Math.round(r + (255 - r) * mixValue);
    g = Math.round(g + (255 - g) * mixValue);
    b = Math.round(b + (255 - b) * mixValue);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cx = width * 0.5;
    cy = height * 0.53;

    let base = Math.min(width, height);
    orbitScale = (base * 0.85) / 460;
    sizeScale = orbitScale * 7.0;

    makeStars();
  }

  function makeStars() {
    stars = [];
    for (let i = 0; i < config.starCount; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        size: rand(0.5, 1.6),
        tw: rand(0, Math.PI * 2),
        sp: rand(0.4, 1.4)
      });
    }
  }

  function rotateX(p, ang) {
    let cos = Math.cos(ang);
    let sin = Math.sin(ang);
    return {
      x: p.x,
      y: p.y * cos - p.z * sin,
      z: p.y * sin + p.z * cos
    };
  }

  function rotateY(p, ang) {
    let cos = Math.cos(ang);
    let sin = Math.sin(ang);
    return {
      x: p.x * cos + p.z * sin,
      y: p.y,
      z: -p.x * sin + p.z * cos
    };
  }

  function project(p) {
    let depth = p.z + config.cameraZ;
    let scale = config.fov / (config.fov + depth);
    return {
      x: cx + p.x * scale,
      y: cy + p.y * scale,
      scale: scale,
      z: p.z
    };
  }

  function orbitPoint(planet, t, tiltX, tiltY) {
    let r = planet.r * orbitScale;
    let ang = t * planet.speed + planet.phase;
    let p = {
      x: Math.cos(ang) * r,
      y: 0,
      z: Math.sin(ang) * r
    };
    p = rotateX(p, planet.tiltX);
    p = rotateY(p, planet.tiltY);
    p = rotateX(p, tiltX);
    p = rotateY(p, tiltY);
    return p;
  }

  function drawOrbit(planet, tiltX, tiltY) {
    let r = planet.r * orbitScale;
    let steps = 120;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      let a = (i / steps) * Math.PI * 2;
      let p = { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r };
      p = rotateX(p, planet.tiltX);
      p = rotateY(p, planet.tiltY);
      p = rotateX(p, tiltX);
      p = rotateY(p, tiltY);
      let proj = project(p);
      if (i === 0) {
        ctx.moveTo(proj.x, proj.y);
      } else {
        ctx.lineTo(proj.x, proj.y);
      }
    }
    ctx.strokeStyle = rgba(planet.color, 0.18);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawSun(t) {
    let pulse = 0.85 + 0.15 * Math.sin(t * 2.6);
    let sunR = sizeScale * 4.6 * pulse;

    let glow = ctx.createRadialGradient(cx, cy, sunR * 0.2, cx, cy, sunR * 3.2);
    glow.addColorStop(0, "rgba(255,244,214,0.9)");
    glow.addColorStop(0.45, "rgba(255,205,120,0.45)");
    glow.addColorStop(1, "rgba(255,170,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR * 3.2, 0, Math.PI * 2);
    ctx.fill();

    let core = ctx.createRadialGradient(cx - sunR * 0.2, cy - sunR * 0.2, sunR * 0.2, cx, cy, sunR);
    core.addColorStop(0, "rgba(255,255,245,0.98)");
    core.addColorStop(0.7, "rgba(255,214,140,0.92)");
    core.addColorStop(1, "rgba(255,190,90,0.88)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlanet(planet, pos, proj) {
    let size = planet.size * sizeScale * proj.scale;
    if (size < 0.6) {
      return;
    }

    let lightX = -pos.x;
    let lightY = -pos.y;
    let len = Math.sqrt(lightX * lightX + lightY * lightY) || 1;
    lightX /= len;
    lightY /= len;

    let hx = proj.x + lightX * size * 0.6;
    let hy = proj.y + lightY * size * 0.6;

    let grad = ctx.createRadialGradient(hx, hy, size * 0.2, proj.x, proj.y, size * 1.4);
    grad.addColorStop(0, mix(planet.color, 0.6, 0.95));
    grad.addColorStop(0.55, rgba(planet.color, 0.9));
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgba(planet.color, 0.35);
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, size * 1.25, 0, Math.PI * 2);
    ctx.stroke();

    if (planet.ring) {
      let ringR = size * 2.4;
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(planet.ringTilt || -0.5);
      ctx.scale(1, 0.36);
      ctx.beginPath();
      ctx.ellipse(0, 0, ringR, ringR * 0.6, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 220, 150, 0.35)";
      ctx.lineWidth = Math.max(1, ringR * 0.08);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawStars(time) {
    for (let i = 0; i < stars.length; i++) {
      let s = stars[i];
      let tw = 0.55 + 0.45 * Math.sin(time * 0.001 * s.sp + s.tw);
      let size = s.size + tw * 0.8;
      let px = (pointer.sx - 0.5) * 40 * s.z;
      let py = (pointer.sy - 0.5) * 30 * s.z;
      let x = s.x * width + px;
      let y = s.y * height + py;
      let a = (0.2 + 0.6 * tw) * (0.3 + 0.7 * s.z);
      ctx.fillStyle = "rgba(255,255,255," + a + ")";
      ctx.fillRect(x, y, size, size);
    }
  }

  function drawDistantGalaxy(time) {
    let base = Math.min(width, height);
    let gx = width * 0.82 + Math.sin(time * 0.00012) * 6;
    let gy = height * 0.18 + Math.cos(time * 0.0001) * 4;
    let scale = base * 0.07;

    let px = (pointer.sx - 0.5) * 30;
    let py = (pointer.sy - 0.5) * 24;
    gx += px;
    gy += py;
    scale = scale * (0.95 + 0.18 * (1 - Math.abs(pointer.sx - 0.5)));

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(-0.35 + (pointer.sx - 0.5) * 0.12);
    ctx.scale(1, 0.6);

    let glow = ctx.createRadialGradient(0, 0, 0, 0, 0, scale * 1.2);
    glow.addColorStop(0, "rgba(255,240,200,0.6)");
    glow.addColorStop(0.4, "rgba(160,210,255,0.35)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, scale * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    for (let arm = 0; arm < 3; arm++) {
      for (let i = 0; i < 90; i++) {
        let t = i / 90;
        let angle = t * Math.PI * 3.8 + arm * (Math.PI * 2 / 3) + time * 0.00015;
        let r = t * scale;
        let x = Math.cos(angle) * r;
        let y = Math.sin(angle) * r * 0.7;
        let a = 0.55 * (1 - t);
        ctx.fillStyle = "rgba(180,220,255," + a + ")";
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }

  function addTrailBurst(x, y, vx, vy) {
    let count = 6;
    for (let i = 0; i < count; i++) {
      let palette = trailPalette[Math.floor(Math.random() * trailPalette.length)];
      trail.push({
        x: x + rand(-6, 6),
        y: y + rand(-6, 6),
        vx: vx * 0.12 + rand(-16, 16),
        vy: vy * 0.12 + rand(-12, 12),
        life: 1,
        size: rand(1.6, 3.2),
        color: palette.color,
        glow: palette.glow
      });
    }
    while (trail.length > config.maxTrail) {
      trail.shift();
    }
  }

  function updateTrail(dt) {
    for (let i = trail.length - 1; i >= 0; i--) {
      let p = trail[i];
      p.life -= dt * 1.35;
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 + 18 * dt;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      if (p.life <= 0) {
        trail.splice(i, 1);
      }
    }
  }

  function drawTrail() {
    if (trail.length === 0) {
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < trail.length; i++) {
      let p = trail[i];
      let alpha = Math.max(0, p.life) * 0.7;
      ctx.shadowBlur = p.size * 6;
      ctx.shadowColor = p.glow;
      ctx.fillStyle = rgba(p.color, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function draw(time) {
    let dt = (time - lastTime) / 1000;
    if (dt > 0.05) {
      dt = 0.05;
    }
    lastTime = time;

    let t = time * 0.00025 * config.timeScale;

    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;

    cx = width * 0.5 + (pointer.sx - 0.5) * 40;
    cy = height * 0.53 + (pointer.sy - 0.5) * 30;

    let tiltX = (pointer.sy - 0.5) * 0.7;
    let tiltY = (pointer.sx - 0.5) * 0.7;

    ctx.clearRect(0, 0, width, height);

    drawStars(time);
    drawDistantGalaxy(time);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    let nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.6);
    nebula.addColorStop(0, "rgba(125,211,252,0.07)");
    nebula.addColorStop(0.5, "rgba(251,191,36,0.05)");
    nebula.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    for (let i = 0; i < planets.length; i++) {
      drawOrbit(planets[i], tiltX, tiltY);
    }

    let bodies = [];
    for (let i = 0; i < planets.length; i++) {
      let pos = orbitPoint(planets[i], t, tiltX, tiltY);
      let proj = project(pos);
      bodies.push({ type: "planet", planet: planets[i], pos: pos, proj: proj });
    }
    bodies.push({ type: "sun", pos: { x: 0, y: 0, z: 0 }, proj: project({ x: 0, y: 0, z: 0 }) });
    bodies.sort(function(a, b) {
      return a.pos.z - b.pos.z;
    });

    for (let i = 0; i < bodies.length; i++) {
      let body = bodies[i];
      if (body.type === "sun") {
        drawSun(t);
      } else {
        drawPlanet(body.planet, body.pos, body.proj);
      }
    }

    updateTrail(dt);
    drawTrail();

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);

  window.addEventListener(
    "pointermove",
    function(e) {
      let px = e.clientX / Math.max(1, width);
      let py = e.clientY / Math.max(1, height);
      let dx = (px - pointer.px) * width;
      let dy = (py - pointer.py) * height;
      pointer.x = px;
      pointer.y = py;
      pointer.px = px;
      pointer.py = py;
      addTrailBurst(e.clientX, e.clientY, dx, dy);
    },
    { passive: true }
  );

  if (zoomBtn) {
    zoomBtn.addEventListener("click", function() {
      if (isZooming) {
        return;
      }
      isZooming = true;
      document.body.classList.add("is-zooming");
      window.setTimeout(function() {
        document.body.classList.add("is-world");
      }, prefersReduced ? 0 : 650);
      zoomTimer = window.setTimeout(function() {
        window.location.href = "./world.html";
      }, prefersReduced ? 120 : 1100);
    });
  }

  resize();
  requestAnimationFrame(draw);
})();
