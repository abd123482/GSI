const sharp = require('sharp');
const path = require('path');

async function renderModalVariants() {
  const width = 1200;
  const height = 800;

  // Let's create an SVG preview comparing:
  // Left: Modal with direct #7185b1 background + styled inner elements
  // Right: Modal with #7185b1 deep theme
  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .page-bg { fill: #2b2622; }
      .title { font-family: Inter, system-ui, sans-serif; font-size: 20px; font-weight: 600; fill: #ffffff; }
      .subtitle { font-family: Inter, system-ui, sans-serif; font-size: 12px; fill: rgba(255, 255, 255, 0.8); }
      .prop-label { font-family: Inter, system-ui, sans-serif; font-size: 12px; font-weight: 500; fill: rgba(255, 255, 255, 0.85); }
      .prop-val { font-family: Inter, system-ui, sans-serif; font-size: 13px; font-weight: 600; fill: #ffffff; }
      .mono-val { font-family: monospace; font-size: 11px; fill: #ffffff; }
      .card-v1 { fill: #7185b1; stroke: #8ba0cc; stroke-width: 1; }
      .inner-v1 { fill: #5c7099; stroke: #4f6187; stroke-width: 1; }
      .inner-row-v1 { fill: rgba(255, 255, 255, 0.08); }
      .btn-primary { fill: #1e2b48; }
      .btn-text { font-family: Inter, system-ui, sans-serif; font-size: 12px; font-weight: 500; fill: #ffffff; text-anchor: middle; }
    </style>

    <rect width="${width}" height="${height}" class="page-bg" />

    <!-- Variant 1: Pure #7185b1 modal surface -->
    <g transform="translate(60, 40)">
      <text x="0" y="0" font-family="Inter" font-size="16" font-weight="600" fill="#dad2c1">Option A: Modal Card background = #7185b1</text>
      
      <!-- Modal window -->
      <rect x="0" y="20" width="500" height="660" rx="14" class="card-v1" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.5))" />

      <!-- Banner -->
      <rect x="0" y="20" width="500" height="80" rx="14" fill="#586c94" />
      <rect x="0" y="80" width="500" height="20" fill="#586c94" />

      <!-- Floating Icon -->
      <rect x="24" y="60" width="56" height="56" rx="12" fill="#1e2b48" stroke="#ffffff" stroke-width="2" />
      <text x="52" y="95" font-family="Inter" font-size="22" fill="#38bdf8" text-anchor="middle">◫</text>

      <!-- Title & Subtitle -->
      <text x="24" y="155" class="title">Shelf-00001</text>
      <!-- Badge -->
      <rect x="160" y="138" width="90" height="22" rx="11" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="1" />
      <text x="205" y="153" font-family="Inter" font-size="11" font-weight="600" fill="#a7f3d0" text-anchor="middle">Tuple Actif</text>
      <text x="24" y="180" class="subtitle">Pièces Détachées • dbo.Shelf</text>

      <!-- Property box -->
      <rect x="24" y="205" width="452" height="230" rx="10" class="inner-v1" />
      <!-- Row 1 -->
      <text x="44" y="240" class="prop-label">shelfId (GUID)</text>
      <text x="220" y="240" class="mono-val">70b23bc1-11a4-420f-8399...</text>
      <line x1="24" y1="260" x2="476" y2="260" stroke="#4f6187" stroke-width="1" />

      <!-- Row 2 -->
      <text x="44" y="295" class="prop-label">Nom de l'étagère</text>
      <text x="360" y="295" class="prop-val">Shelf-00001</text>
      <line x1="24" y1="315" x2="476" y2="315" stroke="#4f6187" stroke-width="1" />

      <!-- Row 3 -->
      <text x="44" y="350" class="prop-label">Capacité / Stock</text>
      <rect x="300" y="332" width="156" height="26" rx="13" fill="rgba(16, 185, 129, 0.3)" stroke="#34d399" stroke-width="1" />
      <text x="378" y="349" font-family="Inter" font-size="11" font-weight="600" fill="#ecfdf5" text-anchor="middle">23 unités enregistrées</text>
      <line x1="24" y1="375" x2="476" y2="375" stroke="#4f6187" stroke-width="1" />

      <!-- Row 4 -->
      <text x="44" y="410" class="prop-label">Emplacement dépôt</text>
      <text x="240" y="410" class="prop-val" font-size="12">Zone Principale • SomePharm</text>

      <!-- JSON toggle -->
      <text x="24" y="465" font-family="Inter" font-size="12" font-weight="600" fill="#ffffff">› Afficher le tuple SQL Server en JSON</text>

      <!-- Footer divider -->
      <line x1="24" y1="600" x2="476" y2="600" stroke="#8ba0cc" stroke-width="1" />

      <!-- Footer buttons -->
      <rect x="24" y="618" width="100" height="36" rx="8" fill="rgba(255, 255, 255, 0.15)" stroke="rgba(255, 255, 255, 0.3)" stroke-width="1" />
      <text x="74" y="640" class="btn-text">Copier GUID</text>

      <rect x="230" y="618" width="80" height="36" rx="8" fill="rgba(255, 255, 255, 0.2)" stroke="rgba(255, 255, 255, 0.4)" stroke-width="1" />
      <text x="270" y="640" class="btn-text">Modifier</text>

      <rect x="320" y="618" width="85" height="36" rx="8" fill="#ef4444" opacity="0.9" />
      <text x="362" y="640" class="btn-text">Supprimer</text>

      <rect x="415" y="618" width="60" height="36" rx="8" fill="#1e2b48" />
      <text x="445" y="640" class="btn-text">Fermer</text>
    </g>

    <!-- Variant 2: Harmonious Slate-Navy modal with #7185b1 branding & header -->
    <g transform="translate(630, 40)">
      <text x="0" y="0" font-family="Inter" font-size="16" font-weight="600" fill="#dad2c1">Option B: Harmonious Deep Slate with #7185b1 Primary Surface</text>

      <rect x="0" y="20" width="500" height="660" rx="14" fill="#20293d" stroke="#7185b1" stroke-width="2" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.5))" />

      <!-- Banner using #7185b1 -->
      <rect x="0" y="20" width="500" height="80" rx="14" fill="#7185b1" />
      <rect x="0" y="80" width="500" height="20" fill="#7185b1" />

      <!-- Floating Icon -->
      <rect x="24" y="60" width="56" height="56" rx="12" fill="#151b2a" stroke="#ffffff" stroke-width="2" />
      <text x="52" y="95" font-family="Inter" font-size="22" fill="#38bdf8" text-anchor="middle">◫</text>

      <!-- Title & Subtitle -->
      <text x="24" y="155" class="title">Shelf-00001</text>
      <rect x="160" y="138" width="90" height="22" rx="11" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="1" />
      <text x="205" y="153" font-family="Inter" font-size="11" font-weight="600" fill="#6ee7b7" text-anchor="middle">Tuple Actif</text>
      <text x="24" y="180" class="subtitle" fill="#94a3b8">Pièces Détachées • dbo.Shelf</text>

      <!-- Property box -->
      <rect x="24" y="205" width="452" height="230" rx="10" fill="#182032" stroke="#2e3a54" stroke-width="1" />
      <!-- Row 1 -->
      <text x="44" y="240" class="prop-label" fill="#94a3b8">shelfId (GUID)</text>
      <text x="220" y="240" class="mono-val" fill="#e2e8f0">70b23bc1-11a4-420f-8399...</text>
      <line x1="24" y1="260" x2="476" y2="260" stroke="#2e3a54" stroke-width="1" />

      <!-- Row 2 -->
      <text x="44" y="295" class="prop-label" fill="#94a3b8">Nom de l'étagère</text>
      <text x="360" y="295" class="prop-val" fill="#f8fafc">Shelf-00001</text>
      <line x1="24" y1="315" x2="476" y2="315" stroke="#2e3a54" stroke-width="1" />

      <!-- Row 3 -->
      <text x="44" y="350" class="prop-label" fill="#94a3b8">Capacité / Stock</text>
      <rect x="300" y="332" width="156" height="26" rx="13" fill="rgba(16, 185, 129, 0.2)" stroke="#34d399" stroke-width="1" />
      <text x="378" y="349" font-family="Inter" font-size="11" font-weight="600" fill="#a7f3d0" text-anchor="middle">23 unités enregistrées</text>
      <line x1="24" y1="375" x2="476" y2="375" stroke="#2e3a54" stroke-width="1" />

      <!-- Row 4 -->
      <text x="44" y="410" class="prop-label" fill="#94a3b8">Emplacement dépôt</text>
      <text x="240" y="410" class="prop-val" font-size="12" fill="#cbd5e1">Zone Principale • SomePharm</text>

      <!-- JSON toggle -->
      <text x="24" y="465" font-family="Inter" font-size="12" font-weight="600" fill="#7185b1">› Afficher le tuple SQL Server en JSON</text>

      <!-- Footer divider -->
      <line x1="24" y1="600" x2="476" y2="600" stroke="#2e3a54" stroke-width="1" />

      <!-- Footer buttons -->
      <rect x="24" y="618" width="100" height="36" rx="8" fill="#182032" stroke="#2e3a54" stroke-width="1" />
      <text x="74" y="640" class="btn-text" fill="#cbd5e1">Copier GUID</text>

      <rect x="230" y="618" width="80" height="36" rx="8" fill="rgba(113, 133, 177, 0.2)" stroke="#7185b1" stroke-width="1" />
      <text x="270" y="640" class="btn-text" fill="#cbd5e1">Modifier</text>

      <rect x="320" y="618" width="85" height="36" rx="8" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" stroke-width="1" />
      <text x="362" y="640" class="btn-text" fill="#fca5a5">Supprimer</text>

      <rect x="415" y="618" width="60" height="36" rx="8" fill="#7185b1" />
      <text x="445" y="640" class="btn-text" fill="#ffffff">Fermer</text>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile('public/modal-variants.png');
  console.log('Saved modal-variants.png');
}

renderModalVariants().catch(console.error);
