'use client';

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useApi } from '@/hooks/use-api';
import { CheckCircle2, ShieldCheck, Database, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface AuthMeResponse {
  userId: string;
  clerkUserId: string;
  userName: string | null;
  userEmail: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
  status: string | null;
}

export function AuthStatusCard() {
  const { isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const api = useApi();

  const [data, setData] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuthMe = async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<AuthMeResponse>('/auth/me');
      setData(response.data);
    } catch (err: any) {
      console.error('Failed to fetch /auth/me:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Impossible de joindre le serveur NestJS';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      fetchAuthMe();
    }
  }, [isSignedIn]);

  const handleCopyToken = async () => {
    try {
      const token = await getToken();
      if (token) {
        await navigator.clipboard.writeText(token);
        setCopiedToken(true);
        toast.success('Token de session Clerk copié dans le presse-papier !');
        setTimeout(() => setCopiedToken(false), 2500);
      } else {
        toast.error('Aucun token de session actif trouvé.');
      }
    } catch (err) {
      toast.error('Impossible de récupérer le token Clerk.');
    }
  };

  if (!isSignedIn) return null;

  return (
    <div className="w-full bg-[#faf9f8] border border-[#e5e3df] rounded-xl p-5 text-left space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#eceae6] pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#eef6ec] border border-[#cbe4c6] flex items-center justify-center text-[#2b7824]">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1a1a1a]">
              Synchronisation SQL Server
            </h3>
            <p className="text-[11px] text-[#787670]">
              Statut de la session Clerk & identité locale NestJS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyToken}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-[#f0eeec] border border-[#d3d0ca] text-[#37352f] transition-colors cursor-pointer"
            title="Copier le Bearer Token Clerk pour tester dans PowerShell / Postman"
          >
            {copiedToken ? (
              <Check className="w-3.5 h-3.5 text-[#1aae39]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#5645d4]" />
            )}
            <span>{copiedToken ? 'Copié !' : 'Copier Token'}</span>
          </button>

          <button
            type="button"
            onClick={fetchAuthMe}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white hover:bg-[#f0eeec] border border-[#d3d0ca] text-[#37352f] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Vérifier</span>
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="py-4 text-center text-xs text-[#787670] flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Validation du token Clerk auprès de NestJS...</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-[#fdf3f2] border border-[#f5c6cb] rounded-lg text-xs text-[#b82a2a] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Erreur d'authentification API:</span> {error}
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-2.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-2.5 bg-white rounded-lg border border-[#e5e3df]">
              <span className="text-[10px] uppercase font-bold text-[#787670] tracking-wider block">
                Statut Compte SQL
              </span>
              <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eef6ec] text-[#2b7824]">
                <CheckCircle2 className="w-3 h-3" />
                {data.status ?? 'ACTIVE'}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-[#e5e3df]">
              <span className="text-[10px] uppercase font-bold text-[#787670] tracking-wider block">
                Rôle Applicatif (RBAC)
              </span>
              <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f0effe] text-[#5645d4]">
                <ShieldCheck className="w-3 h-3" />
                {data.roleName ?? 'Aucun rôle assigné'}
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-[#e5e3df] space-y-1 font-mono text-[11px]">
            <div className="flex justify-between items-center text-[#5d5b54]">
              <span>SQL Server UUID:</span>
              <span className="text-[#1a1a1a] font-semibold select-all truncate max-w-[200px]" title={data.userId}>
                {data.userId}
              </span>
            </div>
            <div className="flex justify-between items-center text-[#5d5b54]">
              <span>Clerk User ID:</span>
              <span className="text-[#1a1a1a] font-semibold select-all truncate max-w-[200px]" title={data.clerkUserId}>
                {data.clerkUserId}
              </span>
            </div>
          </div>

          {data.permissions && data.permissions.length > 0 && (
            <div className="p-2.5 bg-white rounded-lg border border-[#e5e3df] space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-[#787670] tracking-wider block">
                Permissions accordées ({data.permissions.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {data.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-1.5 py-0.5 bg-[#f0eeec] text-[#37352f] rounded text-[10px] font-mono"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
