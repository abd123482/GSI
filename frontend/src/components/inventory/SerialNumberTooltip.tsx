import { Loader2 } from 'lucide-react';
import { useSerialNumbers } from '@/hooks/use-serial-numbers';

interface SerialNumberTooltipProps {
  equipmentId: string;
}

export function SerialNumberTooltip({ equipmentId }: SerialNumberTooltipProps) {
  const { data, isLoading } = useSerialNumbers({ equipmentId, limit: 10 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader2 className="h-4 w-4 animate-spin text-[#71717a]" />
      </div>
    );
  }

  const serials = data?.serialNumbers || [];
  const total = data?.totalSerialNumbers || 0;

  if (serials.length === 0) {
    return (
      <div className="p-2">
        <p className="text-[10px] text-[#a1a1aa]">Aucun numéro de série trouvé.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      <p className="mb-1 text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
        Numéros de série ({total})
      </p>
      {serials.map((sn) => (
        <span key={sn.serialNumberId} className="text-[11px] font-mono text-[#fafafa]">
          {sn.serialNumberCode}
        </span>
      ))}
      {total > 10 && (
        <span className="mt-1 text-[10px] italic text-[#71717a]">
          ...et {total - 10} autres
        </span>
      )}
    </div>
  );
}
