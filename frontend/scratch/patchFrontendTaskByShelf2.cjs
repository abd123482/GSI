const fs = require('fs');
const file = 'src/app/inventory/tasks/[taskId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// For Section 1 (Standard)
const oldStandardByShelf = `              ) : (
                standardRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_120px_38px]"
                  >
                    <select
                      value={row.equipmentId}
                      onChange={(event) =>
                        setStandardRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, equipmentId: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs"
                    >
                      <option value="">Sélectionnez un article</option>
                      {equipments.equipments.map((equipment) => (
                        <option
                          key={equipment.equipmentId}
                          value={equipment.equipmentId}
                        >
                          {equipment.equipmentName}
                        </option>
                      ))}
                    </select>

                    <div className="flex h-9 items-center rounded border border-[#3f3a36] bg-[#383330]/50 px-3 text-xs">
                      {scopeShelf?.shelfName ?? "Emplacement"}
                    </div>

                    <input
                      type="number"
                      min={0}
                      value={row.quantity}
                      onChange={(event) =>
                        setStandardRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? {
                                  ...item,
                                  quantity: Math.max(
                                    0,
                                    Number(event.target.value) || 0,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                      className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setStandardRows((current) =>
                          current.filter((item) => item.id !== row.id),
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded text-rose-300 hover:bg-rose-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}`;

const newStandardByShelf = `              ) : (
                <div className="p-4 space-y-4">
                  {renderedEquipmentIds.filter(id => {
                    const eq = expectedEquipments.find((e: any) => e.equipmentId === id) ?? equipments.equipments.find((e) => e.equipmentId === id);
                    return eq && !eq.hasSerialNumber;
                  }).length === 0 ? (
                    <div className="rounded border border-[#3f3a36] bg-[#26221f] p-4 text-center text-xs text-white/50">
                      Aucun article standard attendu dans cet emplacement.
                    </div>
                  ) : (
                    renderedEquipmentIds.filter(id => {
                      const eq = expectedEquipments.find((e: any) => e.equipmentId === id) ?? equipments.equipments.find((e) => e.equipmentId === id);
                      return eq && !eq.hasSerialNumber;
                    }).map((equipmentId) => {
                      const equipment = equipments.equipments.find((e) => e.equipmentId === equipmentId);
                      const expected = expectedEquipments.find((a: any) => a.equipmentId === equipmentId);
                      const isAdditional = !expected;
                      const row = standardRows.find((r) => r.equipmentId === equipmentId);

                      return (
                        <div
                          key={equipmentId}
                          className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#26221f]"
                        >
                          <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#1f1b18] px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-amber-400" />
                              <h3 className="text-sm font-semibold text-white">
                                {expected?.equipmentName ?? equipment?.equipmentName ?? "Article"}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              {expected ? (
                                <span className="rounded border border-emerald-500/20 bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                  Attendu : {expected.quantity ?? 0}
                                </span>
                              ) : (
                                <span className="rounded border border-amber-500/20 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-300">
                                  Article supplémentaire
                                </span>
                              )}
                              {isAdditional && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAdditionalEquipments(c => c.filter(x => x !== equipmentId))}
                                  title="Retirer cet article supplémentaire"
                                  className="ml-1 rounded p-1 text-white/40 transition hover:bg-rose-950/30 hover:text-rose-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="text-xs text-white/70">
                                Quantité comptée pour cet article :
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={row?.quantity ?? 0}
                                  onChange={(event) => {
                                    const val = Math.max(0, Number(event.target.value) || 0);
                                    setStandardRows((current) => {
                                      const existing = current.find((r) => r.equipmentId === equipmentId);
                                      if (existing) {
                                        return current.map((r) => r.equipmentId === equipmentId ? { ...r, quantity: val } : r);
                                      }
                                      return [...current, { id: newId(), equipmentId, shelfId: task.unit.shelfId ?? "", quantity: val }];
                                    });
                                  }}
                                  className="h-10 w-24 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-center font-mono text-sm font-semibold text-amber-100 focus:border-amber-500 focus:outline-none"
                                />
                                <span className="text-xs text-white/40">unités</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div className="pt-2">
                    {isAddingEquipment ? (
                      <div className="rounded-lg border border-[#4a423a] bg-[#26221f] p-5 shadow-lg">
                        <h4 className="mb-1 text-xs font-semibold text-white">Ajouter un autre article</h4>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={equipmentToAdd}
                            onChange={(e) => setEquipmentToAdd(e.target.value)}
                            className="h-10 flex-1 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="">Sélectionnez un article...</option>
                            {equipments.equipments
                              .filter((e) => !renderedEquipmentIds.includes(e.equipmentId) && !e.hasSerialNumber)
                              .map((e) => (
                                <option key={e.equipmentId} value={e.equipmentId}>
                                  {e.equipmentName}
                                </option>
                              ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!equipmentToAdd}
                              onClick={() => {
                                setSelectedAdditionalEquipments(c => [...c, equipmentToAdd]);
                                setIsAddingEquipment(false);
                                setEquipmentToAdd("");
                              }}
                              className="h-10 rounded bg-amber-600 px-4 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40"
                            >
                              Ajouter
                            </button>
                            <button
                              type="button"
                              onClick={() => { setIsAddingEquipment(false); setEquipmentToAdd(""); }}
                              className="h-10 rounded border border-[#3f3a36] px-3 text-xs text-white/70 hover:bg-white/5"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingEquipment(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#4a423a] bg-[#1f1b18] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:border-amber-500/50 hover:bg-[#2c2724] hover:text-amber-300"
                      >
                        <Plus className="h-4 w-4 text-amber-400" />
                        Ajouter un autre article
                      </button>
                    )}
                  </div>
                </div>
              )}`;

content = content.replace(oldStandardByShelf, newStandardByShelf);

fs.writeFileSync(file, content);
console.log('Patch step 2 applied.');
