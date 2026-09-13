'use client';

import Link from 'next/link';
import {
  Warehouse,
  Layers,
  Cpu,
  Users,
  Terminal,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Command,
} from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

export default function HomePage() {
  const { isSignedIn } = useAuth();

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">

    </main>
  );
}
