const fs = require('fs');
const file = 'src/app/inventory/tasks/[taskId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldSerialByShelf = `              ) : (
                serialRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_38px]"
                  >
                    <SerialCodeInput
                      value={row.code}
                      onChange={(value) =>
                        setSerialRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, code: value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Code série observé"
                      className="h-9 w-full rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs"
                    />

                    <div className="flex h-9 items-center rounded border border-[#3f3a36] bg-[#383330]/50 px-3 text-xs">
                      {scopeShelf?.shelfName ?? "Emplacement"}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSerialRows((current) =>
                          current.filter((item) => item.id !== row.id),
                        )
                      }
                      title="Supprimer ce numéro"
                      className="flex h-9 items-center justify-center rounded text-rose-300 hover:bg-rose-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}`;

const newSerialByShelf = `              ) : (
                <div className="p-4 space-y-4">
                  {renderedEquipmentIds.filter(id => {
                    const eq = expectedEquipments.find((e: any) => e.equipmentId === id) ?? equipments.equipments.find((e) => e.equipmentId === id);
                    return eq && eq.hasSerialNumber;
                  }).length === 0 ? (
                    <div className="rounded border border-[#3f3a36] bg-[#26221f] p-4 text-center text-xs text-white/50">
                      Aucun article sérialisé attendu dans cet emplacement.
                    </div>
                  ) : (
                    renderedEquipmentIds.filter(id => {
                      const eq = expectedEquipments.find((e: any) => e.equipmentId === id) ?? equipments.equipments.find((e) => e.equipmentId === id);
                      return eq && eq.hasSerialNumber;
                    }).map((equipmentId) => {
                      const equipment = equipments.equipments.find((e) => e.equipmentId === equipmentId);
                      const expected = expectedEquipments.find((a: any) => a.equipmentId === equipmentId);
                      const isAdditional = !expected;
                      const rowsInEq = serialRows.filter((r) => r.equipmentId === equipmentId);
                      const scannedCount = rowsInEq.filter((r) => r.code.trim()).length;

                      return (
                        <div
                          key={equipmentId}
                          className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#26221f]"
                        >
                          <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#1f1b18] px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Barcode className="h-4 w-4 text-amber-400" />
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
                              <span
                                className={\`rounded border px-2 py-0.5 text-xs font-medium \${
                                  expected && scannedCount === expected.quantity
                                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                                    : "border-white/10 bg-white/5 text-white/70"
                                }\`}
                              >
                                Observé : {scannedCount}
                              </span>
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
                          
                          <div className="p-4 space-y-3">
                            {rowsInEq.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-4 text-center">
                                <p className="mb-2 text-xs text-white/40">
                                  Aucun numéro de série saisi pour cet article.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setSerialRows(c => [...c, { id: newId(), code: "", shelfId: task.unit.shelfId ?? "", equipmentId }])}
                                  className="inline-flex items-center gap-1.5 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-white/5"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Saisir un code série
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="space-y-2">
                                  {rowsInEq.map((row, idx) => (
                                    <div key={row.id} className="flex items-center gap-2">
                                      <span className="w-6 text-right font-mono text-[11px] text-white/40">
                                        {idx + 1}.
                                      </span>
                                      <SerialCodeInput
                                        value={row.code}
                                        onChange={(value) =>
                                          setSerialRows((current) =>
                                            current.map((item) =>
                                              item.id === row.id ? { ...item, code: value } : item
                                            )
                                          )
                                        }
                                        placeholder="Code série observé"
                                        className="h-9 flex-1 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSerialRows((current) =>
                                            current.filter((item) => item.id !== row.id)
                                          )
                                        }
                                        title="Supprimer ce numéro"
                                        className="flex h-9 w-9 items-center justify-center rounded text-rose-400 transition hover:bg-rose-950/30"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setSerialRows(c => [...c, { id: newId(), code: "", shelfId: task.unit.shelfId ?? "", equipmentId }])}
                                    className="inline-flex items-center gap-1.5 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/5 hover:text-white"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-amber-400" />
                                    Ajouter un autre numéro de série
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div className="pt-2">
                    {isAddingEquipment ? (
                      <div className="rounded-lg border border-[#4a423a] bg-[#26221f] p-5 shadow-lg">
                        <h4 className="mb-1 text-xs font-semibold text-white">Ajouter un autre article sérialisé</h4>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={equipmentToAdd}
                            onChange={(e) => setEquipmentToAdd(e.target.value)}
                            className="h-10 flex-1 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="">Sélectionnez un article...</option>
                            {equipments.equipments
                              .filter((e) => !renderedEquipmentIds.includes(e.equipmentId) && e.hasSerialNumber)
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
                        Ajouter un autre article sérialisé
                      </button>
                    )}
                  </div>
                </div>
              )}`;

content = content.replace(oldSerialByShelf, newSerialByShelf);

// Also need to remove the unused addStandardRow and addSerialRow references that the user clicked in the screenshot
// `addStandardRow(task.unit.shelfId ?? "")`
// Wait, we need to hide or remove the header 'Ajouter' button.
content = content.replace(
`              {byShelf && (
                <button
                  type="button"
                  onClick={() => addStandardRow(task.unit.shelfId ?? "")}
                  className="inline-flex items-center gap-1 rounded border border-[#3f3a36] px-2 py-1 text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </button>
              )}`, ''
);
content = content.replace(
`              {byShelf && (
                <button
                  type="button"
                  onClick={() => addSerialRow(task.unit.shelfId ?? "")}
                  className="inline-flex items-center gap-1 rounded border border-[#3f3a36] px-2 py-1 text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </button>
              )}`, ''
);

fs.writeFileSync(file, content);
console.log('Patch step 3 applied.');
