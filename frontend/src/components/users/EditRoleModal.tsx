'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, ShieldAlert, Check, Loader2, AlertCircle, Edit2 } from 'lucide-react';
import { EditRoleInput, Role } from '@/types/user-role';

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePermissions: string[];
  roleToEdit: Role | null;
  onSubmitRole: (input: EditRoleInput) => Promise<void>;
  isSubmitting?: boolean;
}

const PERMISSION_GROUPS: {
  id: string;
  title: string;
  icon: string;
  permissions: { name: string; label: string }[];
}[] = [
  {
    id: 'equipment',
    title: 'Articles & Mouvements',
    icon: '⚡',
    permissions: [
      { name: 'equipment.read', label: 'Consulter les articles' },
      { name: 'equipment.create', label: 'Créer de nouveaux articles' },
      { name: 'equipment.update', label: 'Modifier les articles' },
      { name: 'equipment.delete', label: 'Supprimer des articles' },
      { name: 'movement.read', label: 'Consulter l’historique des mouvements' },
      { name: 'movement.create', label: 'Effectuer des transferts/mouvements' },
    ],
  },
  {
    id: 'serial',
    title: 'Numéros de Série',
    icon: '🔢',
    permissions: [
      { name: 'serial-number.read', label: 'Consulter les numéros de série' },
      { name: 'serial-number.create', label: 'Ajouter des numéros de série' },
      { name: 'serial-number.update', label: 'Mettre à jour les numéros de série' },
      { name: 'serial-number.delete', label: 'Supprimer des numéros de série' },
    ],
  },
  {
    id: 'shelves',
    title: 'Emplacements & Rangement',
    icon: '🗄️',
    permissions: [
      { name: 'shelf.read', label: 'Consulter les emplacements' },
      { name: 'shelf.create', label: 'Créer de nouveaux emplacements' },
      { name: 'shelf.update', label: 'Modifier les emplacements' },
      { name: 'shelf.delete', label: 'Supprimer des emplacements' },
    ],
  },
  {
    id: 'stocks',
    title: 'Gestion des Stocks',
    icon: '🏭',
    permissions: [
      { name: 'stock.read', label: 'Consulter les stocks' },
      { name: 'stock.create', label: 'Créer des zones de stock' },
      { name: 'stock.update', label: 'Modifier les zones de stock' },
      { name: 'stock.delete', label: 'Supprimer des zones de stock' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventaires & Réconciliations',
    icon: '📋',
    permissions: [
      { name: 'inventory.read', label: 'Consulter les inventaires et rapports' },
      { name: 'inventory.create', label: 'Créer de nouveaux projets d’inventaire' },
      { name: 'inventory.launch', label: 'Lancer et démarrer un inventaire' },
      { name: 'inventory.count', label: 'Contrôleur d’inventaire (Comptage initial et arbitrage en cas de divergence)' },
      { name: 'inventory.finalize', label: 'Clôturer et ajuster le stock final' },
      { name: 'inventory.delete', label: 'Supprimer un inventaire' },
    ],
  },
  {
    id: 'admin',
    title: 'Administration Système',
    icon: '🛡️',
    permissions: [
      { name: 'dashboard.read', label: 'Consulter le tableau de bord exécutif (Dashboard)' },
      { name: 'user.manage', label: 'Gérer les comptes utilisateurs et statuts' },
      { name: 'role.manage', label: 'Créer des rôles et assigner des permissions' },
    ],
  },
];

export function EditRoleModal({
  isOpen,
  onClose,
  availablePermissions,
  roleToEdit,
  onSubmitRole,
  isSubmitting = false,
}: EditRoleModalProps) {
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const groupsToDisplay = useMemo(() => {
    const knownPerms = new Set(
      PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.name)),
    );
    // Exclude inventory.adjudicate as it is internally bundled with inventory.count (Contrôleur)
    const extraPerms = (availablePermissions || []).filter(
      (p) => !knownPerms.has(p) && p !== 'inventory.adjudicate',
    );

    if (extraPerms.length === 0) {
      return PERMISSION_GROUPS;
    }

    return [
      ...PERMISSION_GROUPS,
      {
        id: 'other',
        title: 'Autres Permissions',
        icon: '⚙️',
        permissions: extraPerms.map((name) => ({
          name,
          label: name,
        })),
      },
    ];
  }, [availablePermissions]);

  useEffect(() => {
    if (isOpen && roleToEdit) {
      setRoleName(roleToEdit.roleName);
      setSelectedPermissions(
        roleToEdit.permissions
          .map((p) => p.permissionName)
          .filter((p) => p !== 'inventory.adjudicate'),
      );
      setValidationError(null);
    }
  }, [isOpen, roleToEdit]);

  if (!isOpen || !roleToEdit) return null;

  const handleTogglePermission = (permName: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((p) => p !== permName)
        : [...prev, permName],
    );
  };

  const handleToggleGroup = (groupPerms: string[]) => {
    const allSelected = groupPerms.every((p) => selectedPermissions.includes(p));
    if (allSelected) {
      setSelectedPermissions((prev) =>
        prev.filter((p) => !groupPerms.includes(p)),
      );
    } else {
      setSelectedPermissions((prev) =>
        Array.from(new Set([...prev, ...groupPerms])),
      );
    }
  };

  const handleSelectAll = () => {
    const all = groupsToDisplay.flatMap((g) => g.permissions.map((p) => p.name));
    setSelectedPermissions(all);
  };

  const handleDeselectAll = () => {
    setSelectedPermissions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmed = roleName.trim();
    if (!trimmed) {
      setValidationError('Veuillez renseigner un nom pour le rôle.');
      return;
    }
    if (selectedPermissions.length === 0) {
      setValidationError('Veuillez cocher au moins une permission pour ce rôle.');
      return;
    }

    try {
      const finalPermissions = new Set(selectedPermissions);
      if (finalPermissions.has('inventory.count')) {
        finalPermissions.add('inventory.adjudicate');
      } else {
        finalPermissions.delete('inventory.adjudicate');
      }

      await onSubmitRole({
        roleId: roleToEdit.roleId,
        roleName: trimmed.toUpperCase(),
        permissions: Array.from(finalPermissions),
      });
      onClose();
    } catch {
      // Handled by mutation toast
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#27272a] rounded-[4px] shadow-2xl border border-[#3f3f46] flex flex-col max-h-[90vh] overflow-hidden text-[#fafafa]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#3f3f46] flex items-center justify-between bg-[#18181b]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[3px] bg-[#27272a] text-[#fafafa] border border-[#3f3f46] flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-[#fafafa]">
                Modifier le Rôle
              </h2>
              <p className="text-xs text-[#d4d4d8]">
                Mettez à jour le nom et les permissions de ce rôle.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[3px] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5">
            {validationError && (
              <div className="p-3 bg-[#2d1616] border border-[#451e1e] rounded-[3px] text-xs text-[#ef4444] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Role Name Input */}
            <div>
              <label
                htmlFor="roleNameEdit"
                className="block text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa] mb-1.5"
              >
                Nom du Rôle <span className="text-[#ef4444]">*</span>
              </label>
              <input
                id="roleNameEdit"
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Ex: MAGASINIER, AUDITEUR..."
                className="w-full px-3 py-2 text-xs font-mono bg-[#18181b] text-[#fafafa] border border-[#3f3f46] rounded-[3px] focus:outline-none focus:border-[#fafafa] transition-all placeholder:text-[#a1a1aa]"
                autoFocus
              />
            </div>

            {/* Permissions Selection Header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa]">
                  Permissions ({selectedPermissions.length} cochée
                  {selectedPermissions.length > 1 ? 's' : ''})
                </label>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[11px] text-[#fafafa] hover:underline cursor-pointer"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-[#3f3f46]">•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-[11px] text-[#a1a1aa] hover:underline cursor-pointer"
                  >
                    Tout décocher
                  </button>
                </div>
              </div>

              {/* Grouped Permissions Grid */}
              <div className="space-y-3 border border-[#3f3f46] rounded-[3px] p-3 bg-[#18181b]">
                {groupsToDisplay.map((group) => {
                  const groupPermNames = group.permissions.map((p) => p.name);
                  const isAllGroupSelected = groupPermNames.every((p) =>
                    selectedPermissions.includes(p),
                  );
                  const isSomeGroupSelected =
                    !isAllGroupSelected &&
                    groupPermNames.some((p) => selectedPermissions.includes(p));

                  return (
                    <div
                      key={group.id}
                      className="bg-[#27272a] rounded-[3px] border border-[#3f3f46] p-3"
                    >
                      {/* Group Header */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3f3f46]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{group.icon}</span>
                          <span className="text-xs font-medium text-[#fafafa]">
                            {group.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(groupPermNames)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] transition-colors border cursor-pointer ${
                            isAllGroupSelected
                              ? 'bg-[#18181b] text-[#fafafa] border-[#fafafa]'
                              : isSomeGroupSelected
                                ? 'bg-[#18181b] text-[#f4f4f5] border-[#3f3f46]'
                                : 'text-[#a1a1aa] border-transparent hover:border-[#3f3f46]'
                          }`}
                        >
                          {isAllGroupSelected
                            ? 'Tout désélectionner'
                            : 'Tout cocher'}
                        </button>
                      </div>

                      {/* Group Checkboxes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.permissions.map((perm) => {
                          const isChecked = selectedPermissions.includes(perm.name);
                          return (
                            <label
                              key={perm.name}
                              className={`flex items-start gap-2.5 p-2 rounded-[2px] cursor-pointer text-xs transition-colors border ${
                                isChecked
                                  ? 'bg-[#18181b] border-[#fafafa] text-[#fafafa]'
                                  : 'hover:bg-[#18181b] border-[#3f3f46]/60 text-[#d4d4d8]'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-[2px] mt-0.5 flex items-center justify-center border transition-colors shrink-0 ${
                                  isChecked
                                    ? 'bg-[#fafafa] border-[#fafafa] text-[#18181b]'
                                    : 'border-[#3f3f46] bg-[#18181b]'
                                }`}
                              >
                                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-normal text-xs leading-tight text-[#fafafa]">
                                  {perm.label}
                                </span>
                                <span className="font-mono text-[10px] text-[#a1a1aa]">
                                  {perm.name}
                                </span>
                              </div>
                              {/* Hidden checkbox element to handle toggle natively if needed or just handled by onClick of label implicitly by structure wait no we use div click so we need an input or handleTogglePermission on label */}
                              <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={isChecked} 
                                onChange={() => handleTogglePermission(perm.name)} 
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3 border-t border-[#3f3f46] bg-[#18181b] flex items-center justify-between gap-2.5">
            <span className="text-[10px] text-[#a1a1aa] font-mono">ID: {roleToEdit.roleId}</span>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-medium text-[#d4d4d8] hover:text-[#fafafa] hover:bg-[#27272a] rounded-[3px] transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-[#18181b] bg-[#fafafa] hover:bg-[#f4f4f5] rounded-[3px] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Sauvegarder les modifications</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
