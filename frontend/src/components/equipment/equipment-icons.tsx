import {
  Cpu,
  HardDrive,
  Monitor,
  Server,
  Radio,
  Wrench,
  CircuitBoard,
  LucideIcon,
} from 'lucide-react';

export interface EquipmentVisualTheme {
  icon: LucideIcon;
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  label: string;
}

const EQUIPMENT_THEMES: EquipmentVisualTheme[] = [
  {
    icon: Cpu,
    bg: 'bg-[#251f33]',
    text: 'text-[#c084fc]',
    border: 'border-[#3d3254]',
    badgeBg: 'bg-[#251f33]',
    badgeText: 'text-[#c084fc]',
    label: 'Électronique & Calcul',
  },
  {
    icon: Monitor,
    bg: 'bg-[#17253b]',
    text: 'text-[#60a5fa]',
    border: 'border-[#203a5e]',
    badgeBg: 'bg-[#17253b]',
    badgeText: 'text-[#60a5fa]',
    label: 'Affichage & Terminaux',
  },
  {
    icon: HardDrive,
    bg: 'bg-[#162b22]',
    text: 'text-[#10b981]',
    border: 'border-[#1e3d30]',
    badgeBg: 'bg-[#162b22]',
    badgeText: 'text-[#10b981]',
    label: 'Stockage & Données',
  },
  {
    icon: Server,
    bg: 'bg-[#2d2212]',
    text: 'text-[#f59e0b]',
    border: 'border-[#453316]',
    badgeBg: 'bg-[#2d2212]',
    badgeText: 'text-[#f59e0b]',
    label: 'Infrastructure Réseau',
  },
  {
    icon: Radio,
    bg: 'bg-[#2d1624]',
    text: 'text-[#f472b6]',
    border: 'border-[#4a2039]',
    badgeBg: 'bg-[#2d1624]',
    badgeText: 'text-[#f472b6]',
    label: 'Télécoms & Sans-fil',
  },
  {
    icon: CircuitBoard,
    bg: 'bg-[#2d2212]',
    text: 'text-[#fbbf24]',
    border: 'border-[#453316]',
    badgeBg: 'bg-[#2d2212]',
    badgeText: 'text-[#fbbf24]',
    label: 'Composants Intégrés',
  },
  {
    icon: Wrench,
    bg: 'bg-[#18181b]',
    text: 'text-[#f4f4f5]',
    border: 'border-[#3f3f46]',
    badgeBg: 'bg-[#18181b]',
    badgeText: 'text-[#f4f4f5]',
    label: 'Outillage & Maintenance',
  },
];

export function getEquipmentVisualTheme(
  equipmentName?: string | null,
  index = 0,
): EquipmentVisualTheme {
  if (!equipmentName) {
    return EQUIPMENT_THEMES[index % EQUIPMENT_THEMES.length];
  }

  const name = equipmentName.toLowerCase();

  if (name.includes('serveur') || name.includes('rack') || name.includes('server')) {
    return EQUIPMENT_THEMES[3]; // Server
  }
  if (name.includes('ecran') || name.includes('moniteur') || name.includes('screen') || name.includes('display')) {
    return EQUIPMENT_THEMES[1]; // Monitor
  }
  if (name.includes('disque') || name.includes('disk') || name.includes('ssd') || name.includes('hdd')) {
    return EQUIPMENT_THEMES[2]; // HardDrive
  }
  if (name.includes('radio') || name.includes('wifi') || name.includes('antenne')) {
    return EQUIPMENT_THEMES[4]; // Radio
  }
  if (name.includes('carte') || name.includes('module') || name.includes('chip')) {
    return EQUIPMENT_THEMES[5]; // CircuitBoard
  }
  if (name.includes('outil') || name.includes('kit') || name.includes('test')) {
    return EQUIPMENT_THEMES[6]; // Wrench
  }

  // Consistent hash for stable theme by name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const themeIndex = Math.abs(hash + index) % EQUIPMENT_THEMES.length;
  return EQUIPMENT_THEMES[themeIndex];
}
