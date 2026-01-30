// Metallic Gradient Squares - p5.js + WebGL Port
// Full animation with drop shadows and spline motion

let metallicShader;
let logo;
let logoLoaded = false;

// Animation
let totalFrames = 1200;  // 40 seconds at 30fps
let frameCounter = 0;
let playing = true;
let recording = false;

// Logo scales (matching Processing version)
let scales = [1.0, 0.82, 0.65, 0.5, 0.37, 0.26, 0.17, 0.12, 0.08, 0.05];
let baseLogoSize = 403;
let numLogos = 7;  // Skip smallest 3

function preload() {
  metallicShader = loadShader('metallic.vert', 'metallic.frag');

  // Try to load actual logo, fall back to generated
  logo = loadImage('logo.png',
    () => {
      console.log('Logo loaded!');
      logoLoaded = true;
    },
    () => {
      console.log('No logo.png found, using placeholder');
      logo = null;
    }
  );
}

function setup() {
  // Enable anti-aliasing BEFORE creating canvas
  setAttributes('antialias', true);
  setAttributes('alpha', true);

  // Responsive canvas - fills container, maintains 16:9 aspect ratio
  let w = windowWidth;
  let h = windowHeight;
  createCanvas(w, h, WEBGL);
  // 2x pixel density for smooth sub-pixel rendering
  pixelDensity(2);
  frameRate(30);
  noStroke();
  smooth();  // Enable smoothing
  textureMode(NORMAL);
  textureWrap(CLAMP);

  // Enable blending for semi-transparent shadows
  blendMode(BLEND);

  if (!logo) {
    logo = createSquareLogo();
  }

  console.log('Controls: SPACE=play/pause, R=record, LEFT/RIGHT=scrub, 1/2/3=jump to phase');
}

let glContext;  // Store GL context globally

function draw() {
  background(0);

  // Get WebGL context (cache it on first frame)
  if (!glContext) {
    glContext = document.querySelector('canvas').getContext('webgl') ||
                document.querySelector('canvas').getContext('webgl2');
  }

  let t = frameCounter / totalFrames;

  // Enable blending
  if (glContext) {
    glContext.enable(glContext.BLEND);
    glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);
  }

  // Draw interleaved: each logo's shadows, then the logo itself
  // This way shadows appear on TOP of logos behind, but UNDER the logo casting them
  drawAllInterleavedWithShadows(t);

  // UI
  resetShader();
  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);
  text('Frame: ' + frameCounter + '/' + totalFrames + ' | Phase: ' + nf(t, 1, 3), -width/2 + 10, -height/2 + 10);
  text('FPS: ' + nf(frameRate(), 0, 1) + (recording ? ' [RECORDING]' : ''), -width/2 + 10, -height/2 + 30);

  // Advance animation
  if (playing && !recording) {
    frameCounter = (frameCounter + 1) % totalFrames;
  }

  if (recording) {
    saveCanvas('frames/morph_' + nf(frameCounter, 4), 'png');
    frameCounter++;
    if (frameCounter >= totalFrames) {
      recording = false;
      console.log('Recording complete!');
    }
  }
}

// ============ DRAWING FUNCTIONS ============

// Shadow settings - multiple layers for soft appearance (like Processing)
let shadowOffsets = [
  { x: 10, y: 14, alpha: 0.15 },  // Far
  { x: 8, y: 11, alpha: 0.15 },
  { x: 6, y: 8, alpha: 0.15 },
  { x: 4, y: 5, alpha: 0.15 },    // Mid
  { x: 2, y: 3, alpha: 0.15 }     // Near
];

function drawAllInterleavedWithShadows(t) {
  let zIndex = 0;
  let zStep = 0.1;

  // Collect all elements (both chains) with their depth info
  let elements = [];

  // Top chain - largest (i=0) should be in back
  for (let i = 0; i < numLogos; i++) {
    let pos = getTopChainPosition(i, t);
    let angle = getTopChainAngle(t);
    elements.push({
      pos: pos,
      angle: angle,
      sizeIndex: i,
      depth: i  // Larger index = smaller logo = more in front
    });
  }

  // Bottom chain
  for (let i = 0; i < numLogos; i++) {
    let pos = getBottomChainPosition(i, t);
    let angle = getBottomChainAngle(t);
    elements.push({
      pos: pos,
      angle: angle,
      sizeIndex: i,
      depth: i
    });
  }

  // Sort by depth (draw back to front: lowest depth first)
  elements.sort((a, b) => a.depth - b.depth);

  // Draw each element with its shadows
  for (let elem of elements) {
    // First draw this element's shadows (they go ON TOP of things behind)
    for (let shadow of shadowOffsets) {
      drawLogoShadow(
        elem.pos.x + shadow.x,
        elem.pos.y + shadow.y,
        elem.sizeIndex,
        shadow.alpha,
        zIndex
      );
      zIndex += zStep;
    }

    // Then draw the logo itself (on top of its own shadows)
    drawLogo(elem.pos.x, elem.pos.y, elem.sizeIndex, elem.angle, zIndex);
    zIndex += zStep;
  }
}

function drawLogo(x, y, sizeIndex, angleDeg, zPos) {
  let logoSize = baseLogoSize * scales[sizeIndex];

  push();
  // Convert from Processing coordinates (0,0 = top-left) to p5 WEBGL (0,0 = center)
  translate(x - width/2 + logoSize/2, y - height/2 + logoSize/2, zPos);

  shader(metallicShader);
  metallicShader.setUniform('uTexture', logo);
  metallicShader.setUniform('uResolution', [width, height]);
  metallicShader.setUniform('uTime', millis() / 1000.0);
  metallicShader.setUniform('uAngle', radians(angleDeg));
  metallicShader.setUniform('uShadowMode', 0.0);  // Normal metallic mode
  metallicShader.setUniform('uShadowAlpha', 0.0);
  metallicShader.setUniform('uShadowPadding', 0.0);

  plane(logoSize, logoSize);
  pop();
}

function drawLogoShadow(x, y, sizeIndex, alpha, zPos) {
  let logoSize = baseLogoSize * scales[sizeIndex];

  push();
  translate(x - width/2 + logoSize/2, y - height/2 + logoSize/2, zPos);

  // Use metallic shader in shadow mode
  shader(metallicShader);
  metallicShader.setUniform('uTexture', logo);
  metallicShader.setUniform('uResolution', [width, height]);
  metallicShader.setUniform('uTime', millis() / 1000.0);
  metallicShader.setUniform('uAngle', 0);
  metallicShader.setUniform('uShadowMode', 1.0);
  metallicShader.setUniform('uShadowAlpha', alpha);
  metallicShader.setUniform('uShadowPadding', 1.0);

  plane(logoSize, logoSize);
  pop();
}

// ============ POSITION CALCULATIONS ============

function getTopChainPosition(i, t) {
  let waypoints = [
    getPosA_Top(i),
    getPosB_Left(i),
    getPosC_Top(i)
  ];
  return catmullRom(waypoints, t);
}

function getBottomChainPosition(i, t) {
  let waypoints = [
    getPosA_Bot(i),
    getPosB_Right(i),
    getPosC_Bot(i)
  ];
  return catmullRom(waypoints, t);
}

function getTopChainAngle(t) {
  if (t < 0.333) {
    return lerp(90, 180, t / 0.333);
  } else if (t < 0.666) {
    return lerp(180, 360, (t - 0.333) / 0.333);
  } else {
    return lerp(360, 450, (t - 0.666) / 0.334);
  }
}

function getBottomChainAngle(t) {
  if (t < 0.333) {
    return lerp(270, 360, t / 0.333);
  } else if (t < 0.666) {
    return lerp(360, 540, (t - 0.333) / 0.333);
  } else {
    return lerp(540, 630, (t - 0.666) / 0.334);
  }
}

// Position A: Vertical stack
function getPosA_Top(i) {
  let logoSize = baseLogoSize * scales[i];
  let x = width/2 - logoSize/2;
  let y = height/2 - logoSize;
  for (let j = 0; j < i; j++) {
    y -= (baseLogoSize * scales[j]) * 0.2;
  }
  return { x, y };
}

function getPosA_Bot(i) {
  let logoSize = baseLogoSize * scales[i];
  let x = width/2 - logoSize/2;
  let y = height/2;
  for (let j = 0; j < i; j++) {
    y += (baseLogoSize * scales[j]) * 0.2;
  }
  return { x, y };
}

// Position B: Horizontal curves
function getPosB_Left(i) {
  let logoSize = baseLogoSize * scales[i];
  let centerX = width/2, centerY = height/2;

  let startX = 0, startY = centerY;
  let endX = centerX - 40, endY = centerY - 80;
  let ctrlX = centerX - 80, ctrlY = centerY;

  let t = 0;
  for (let j = 0; j < i; j++) {
    t += 0.08 + (j * 0.015);
  }
  t = min(t, 1.0);

  let x = (1-t)*(1-t)*startX + 2*(1-t)*t*ctrlX + t*t*endX;
  let y = (1-t)*(1-t)*startY + 2*(1-t)*t*ctrlY + t*t*endY;

  return { x, y: y - logoSize/2 };
}

function getPosB_Right(i) {
  let logoSize = baseLogoSize * scales[i];
  let centerX = width/2, centerY = height/2;

  let startX = width, startY = centerY;
  let endX = centerX + 40, endY = centerY - 80;
  let ctrlX = centerX + 80, ctrlY = centerY;

  let t = 0;
  for (let j = 0; j < i; j++) {
    t += 0.08 + (j * 0.015);
  }
  t = min(t, 1.0);

  let x = (1-t)*(1-t)*startX + 2*(1-t)*t*ctrlX + t*t*endX;
  let y = (1-t)*(1-t)*startY + 2*(1-t)*t*ctrlY + t*t*endY;

  return { x: x - logoSize, y: y - logoSize/2 };
}

// Position C: Mirror split
function getPosC_Top(i) {
  let logoSize = baseLogoSize * scales[i];
  let centerY = height/2;
  let xOffset = 20;
  let yPos = centerY - 60;

  let tPositions = [];
  let t = 0;
  for (let j = scales.length - 1; j >= 0; j--) {
    tPositions[j] = t;
    t += 0.04 + ((scales.length - 1 - j) * 0.008);
    t = min(t, 1.0);
  }
  let maxT = tPositions[0];

  let tVal = tPositions[i];
  let x = tVal * width + xOffset;
  let y = yPos;

  let vertOffset = -scales[i] * 80;
  let screenPos = tVal / maxT;
  let curlOffset = -pow(1.0 - screenPos, 4) * 120;

  return { x, y: y - logoSize/2 + vertOffset + curlOffset };
}

function getPosC_Bot(i) {
  let logoSize = baseLogoSize * scales[i];
  let centerY = height/2;
  let xOffset = 20;
  let yPos = centerY + 60;

  let tPositions = [];
  let t = 0;
  for (let j = 0; j < scales.length; j++) {
    tPositions[j] = t;
    t += 0.04 + ((scales.length - 1 - j) * 0.008);
    t = min(t, 1.0);
  }

  let tVal = tPositions[i];
  let x = tVal * width + xOffset;
  let y = yPos;

  let vertOffset = scales[i] * 80;
  let normalizedPos = i / (scales.length - 1);
  let curlOffset = pow(normalizedPos, 4) * 120;

  return { x, y: y - logoSize/2 + vertOffset + curlOffset };
}

// ============ CATMULL-ROM SPLINE ============

function catmullRom(points, t) {
  let n = points.length;
  let scaledT = t * n;
  let segment = floor(scaledT) % n;
  let localT = scaledT - floor(scaledT);

  let p0 = points[(segment - 1 + n) % n];
  let p1 = points[segment];
  let p2 = points[(segment + 1) % n];
  let p3 = points[(segment + 2) % n];

  let t2 = localT * localT;
  let t3 = t2 * localT;

  let x = 0.5 * ((2 * p1.x) +
    (-p0.x + p2.x) * localT +
    (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 +
    (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3);

  let y = 0.5 * ((2 * p1.y) +
    (-p0.y + p2.y) * localT +
    (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 +
    (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3);

  return { x, y };
}

// ============ PLACEHOLDER LOGO ============

function createSquareLogo() {
  let pg = createGraphics(512, 512);
  pg.pixelDensity(1);
  pg.clear();
  pg.fill(255);
  pg.noStroke();
  pg.rectMode(CENTER);

  // Single square outline
  let cx = 256, cy = 256;
  let size = 400;
  let thickness = 40;

  pg.rect(cx, cy - size/2, size, thickness);
  pg.rect(cx, cy + size/2, size, thickness);
  pg.rect(cx - size/2, cy, thickness, size);
  pg.rect(cx + size/2, cy, thickness, size);

  return pg;
}

// ============ CONTROLS ============

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  if (key === ' ') playing = !playing;
  if (key === 'r' || key === 'R') {
    recording = true;
    frameCounter = 0;
    console.log('Recording started...');
  }
  if (keyCode === LEFT_ARROW) frameCounter = max(0, frameCounter - 1);
  if (keyCode === RIGHT_ARROW) frameCounter = min(totalFrames - 1, frameCounter + 1);
  if (key === '1') frameCounter = 0;
  if (key === '2') frameCounter = floor(0.333 * totalFrames);
  if (key === '3') frameCounter = floor(0.666 * totalFrames);
  if (key === 's' || key === 'S') saveCanvas('metallic_' + nf(frameCounter, 4), 'png');
}
