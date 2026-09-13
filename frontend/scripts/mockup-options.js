const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function renderNavbarMockups() {
  // We will create an SVG mockup of the navbar header with the logo embedded as base64 png
  const logoDarkBuf = await sharp('public/somepharm-logo-dark.png').resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const logoOrigBuf = await sharp('public/somepharm-logo.png').resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  const b64Dark = logoDarkBuf.toString('base64');
  const b64Orig = logoOrigBuf.toString('base64');

  // Let's create an SVG that renders 4 options in the exact navbar layout
  const svg = `
  <svg width="1000" height="420" viewBox="0 0 1000 420" xmlns="http://www.w3.org/2000/svg">
    <style>
      .bg { fill: #1e1b18; }
      .bar { fill: #2b2622; stroke: #3f3a36; stroke-width: 1; }
      .title { font-family: Inter, system-ui, sans-serif; font-size: 13px; font-weight: 500; fill: #f7f5f0; }
      .badge { font-family: ui-monospace, monospace; font-size: 10px; fill: #dad2c1; }
      .badge-bg { fill: #383330; stroke: #3f3a36; stroke-width: 1; rx: 2px; }
      .nav-link { font-family: Inter, system-ui, sans-serif; font-size: 12px; font-weight: 500; fill: #c9c0ad; }
      .opt-label { font-family: Inter, system-ui, sans-serif; font-size: 13px; font-weight: 600; fill: #aea69c; }
      .divider { stroke: #3f3a36; stroke-width: 1; }
    </style>

    <rect width="1000" height="420" class="bg" />

    <!-- OPTION 1: Pure Transparent Logo (Vibrant Navy + Cyan, height 30px) -->
    <text x="40" y="32" class="opt-label">Option 1: Pure Transparent Logo (Optimized Navy &amp; Cyan, Seamless Integration)</text>
    <g transform="translate(40, 45)">
      <rect width="920" height="56" rx="4" class="bar" />
      <!-- Logo -->
      <image href="data:image/png;base64,${b64Dark}" x="16" y="13" width="30" height="30" />
      <text x="56" y="33" class="title">SomePharm</text>
      <rect x="135" y="20" width="56" height="18" class="badge-bg" />
      <text x="141" y="33" class="badge">DEV-ENV</text>
      <line x1="210" y1="20" x2="210" y2="36" class="divider" />
      <text x="230" y="33" class="nav-link">Stocks</text>
      <text x="300" y="33" class="nav-link">Étagères</text>
      <text x="380" y="33" class="nav-link">Équipements</text>
      <text x="490" y="33" class="nav-link">Rôles &amp; Accès</text>
    </g>

    <!-- OPTION 2: Pure Transparent with subtle ambient soft glow -->
    <text x="40" y="140" class="opt-label">Option 2: Transparent Logo with Subtle Luminous Back-glow</text>
    <g transform="translate(40, 150)">
      <rect width="920" height="56" rx="4" class="bar" />
      <!-- Glow circle -->
      <circle cx="31" cy="28" r="16" fill="#38bdf8" opacity="0.12" filter="blur(6px)" />
      <!-- Logo -->
      <image href="data:image/png;base64,${b64Dark}" x="16" y="13" width="30" height="30" />
      <text x="56" y="33" class="title">SomePharm</text>
      <rect x="135" y="20" width="56" height="18" class="badge-bg" />
      <text x="141" y="33" class="badge">DEV-ENV</text>
      <line x1="210" y1="20" x2="210" y2="36" class="divider" />
      <text x="230" y="33" class="nav-link">Stocks</text>
      <text x="300" y="33" class="nav-link">Étagères</text>
      <text x="380" y="33" class="nav-link">Équipements</text>
      <text x="490" y="33" class="nav-link">Rôles &amp; Accès</text>
    </g>

    <!-- OPTION 3: Elegant Dark Glass Tile Container (30x30, rounded-[5px], hairline border) -->
    <text x="40" y="245" class="opt-label">Option 3: Modern Sleek Glass Tile Container (Dark slate plate with subtle hairline)</text>
    <g transform="translate(40, 255)">
      <rect width="920" height="56" rx="4" class="bar" />
      <!-- Tile container -->
      <rect x="14" y="12" width="32" height="32" rx="6" fill="#342e2a" stroke="#48423c" stroke-width="1" />
      <!-- Logo -->
      <image href="data:image/png;base64,${b64Dark}" x="18" y="16" width="24" height="24" />
      <text x="56" y="33" class="title">SomePharm</text>
      <rect x="135" y="20" width="56" height="18" class="badge-bg" />
      <text x="141" y="33" class="badge">DEV-ENV</text>
      <line x1="210" y1="20" x2="210" y2="36" class="divider" />
      <text x="230" y="33" class="nav-link">Stocks</text>
      <text x="300" y="33" class="nav-link">Étagères</text>
      <text x="380" y="33" class="nav-link">Équipements</text>
      <text x="490" y="33" class="nav-link">Rôles &amp; Accès</text>
    </g>

    <!-- OPTION 4: Original Unadjusted Navy on Pure Transparent -->
    <text x="40" y="350" class="opt-label">Option 4: Original Raw Colors (Navy is darker, lower contrast)</text>
    <g transform="translate(40, 360)">
      <rect width="920" height="56" rx="4" class="bar" />
      <image href="data:image/png;base64,${b64Orig}" x="16" y="13" width="30" height="30" />
      <text x="56" y="33" class="title">SomePharm</text>
      <rect x="135" y="20" width="56" height="18" class="badge-bg" />
      <text x="141" y="33" class="badge">DEV-ENV</text>
      <line x1="210" y1="20" x2="210" y2="36" class="divider" />
      <text x="230" y="33" class="nav-link">Stocks</text>
      <text x="300" y="33" class="nav-link">Étagères</text>
      <text x="380" y="33" class="nav-link">Équipements</text>
      <text x="490" y="33" class="nav-link">Rôles &amp; Accès</text>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile('public/mockup-options.png');
  console.log('Saved mockup-options.png');
}

renderNavbarMockups().catch(console.error);
