const sharp = require('sharp');

async function renderFormInputsComparison() {
  const width = 1100;
  const height = 550;

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .bg { fill: #2b2622; }
      .title { font-family: Inter, system-ui, sans-serif; font-size: 16px; font-weight: 600; fill: #ffffff; }
      .label { font-family: Inter, system-ui, sans-serif; font-size: 12px; font-weight: 500; fill: #ffffff; }
      .help { font-family: Inter, system-ui, sans-serif; font-size: 11px; fill: rgba(255, 255, 255, 0.75); }
      .btn-primary { fill: #1e2b48; rx: 8px; }
      .btn-cancel { fill: rgba(255, 255, 255, 0.15); rx: 8px; stroke: rgba(255, 255, 255, 0.3); }
    </style>

    <rect width="${width}" height="${height}" class="bg" />

    <!-- Style 1: Deep slate inputs on #7185b1 card (Sleek Dark Accent) -->
    <g transform="translate(50, 30)">
      <text x="0" y="0" font-family="Inter" font-size="14" font-weight="600" fill="#dad2c1">Style 1: Integrated Slate Inputs (Modern Glass / Slate Style)</text>
      
      <rect x="0" y="15" width="480" height="460" rx="14" fill="#697797" stroke="#8ba0cc" stroke-width="1" filter="drop-shadow(0 15px 25px rgba(0,0,0,0.4))" />

      <!-- Header -->
      <rect x="0" y="15" width="480" height="60" rx="14" fill="#586c94" />
      <text x="24" y="52" class="title">Nouvelle étagère</text>

      <!-- Input 1 -->
      <text x="24" y="115" class="label">Nom de l'étagère *</text>
      <rect x="24" y="125" width="432" height="42" rx="8" fill="#52658c" stroke="#8ba0cc" stroke-width="1" />
      <text x="38" y="151" font-family="Inter" font-size="13" fill="#ffffff">Étagère Principale Nord</text>
      <text x="24" y="182" class="help">Identifiant descriptif ou code zone</text>

      <!-- Input 2 -->
      <text x="24" y="220" class="label">Capacité maximale *</text>
      <rect x="24" y="230" width="432" height="42" rx="8" fill="#52658c" stroke="#8ba0cc" stroke-width="1" />
      <text x="38" y="256" font-family="Inter" font-size="13" fill="#ffffff">50</text>
      <text x="24" y="287" class="help">Nombre maximum de matériels</text>

      <!-- Buttons -->
      <rect x="24" y="410" width="100" height="40" class="btn-cancel" />
      <text x="74" y="435" font-family="Inter" font-size="13" fill="#ffffff" text-anchor="middle">Annuler</text>

      <rect x="306" y="410" width="150" height="40" class="btn-primary" />
      <text x="381" y="435" font-family="Inter" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">Créer l'étagère</text>
    </g>

    <!-- Style 2: Crisp white/light inputs on #697797 card (High Contrast Form) -->
    <g transform="translate(570, 30)">
      <text x="0" y="0" font-family="Inter" font-size="14" font-weight="600" fill="#dad2c1">Style 2: Crisp White Inputs on #7185b1 Card (Clean Data Entry)</text>
      
      <rect x="0" y="15" width="480" height="460" rx="14" fill="#697797" stroke="#8ba0cc" stroke-width="1" filter="drop-shadow(0 15px 25px rgba(0,0,0,0.4))" />

      <!-- Header -->
      <rect x="0" y="15" width="480" height="60" rx="14" fill="#586c94" />
      <text x="24" y="52" class="title">Nouvelle étagère</text>

      <!-- Input 1 -->
      <text x="24" y="115" class="label">Nom de l'étagère *</text>
      <rect x="24" y="125" width="432" height="42" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
      <text x="38" y="151" font-family="Inter" font-size="13" fill="#0f172a">Étagère Principale Nord</text>
      <text x="24" y="182" class="help">Identifiant descriptif ou code zone</text>

      <!-- Input 2 -->
      <text x="24" y="220" class="label">Capacité maximale *</text>
      <rect x="24" y="230" width="432" height="42" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
      <text x="38" y="256" font-family="Inter" font-size="13" fill="#0f172a">50</text>
      <text x="24" y="287" class="help">Nombre maximum de matériels</text>

      <!-- Buttons -->
      <rect x="24" y="410" width="100" height="40" class="btn-cancel" />
      <text x="74" y="435" font-family="Inter" font-size="13" fill="#ffffff" text-anchor="middle">Annuler</text>

      <rect x="306" y="410" width="150" height="40" class="btn-primary" />
      <text x="381" y="435" font-family="Inter" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">Créer l'étagère</text>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile('public/inputs-comparison.png');
  console.log('Saved inputs-comparison.png');
}

renderFormInputsComparison().catch(console.error);
