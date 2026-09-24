const fs = require('fs');
const file = 'src/app/inventory/tasks/[taskId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// We are going to rewrite the frontend to support "byShelf" identical to "byEquipment"

// 1. Add `isAddingEquipment`, `equipmentToAdd`, `selectedAdditionalEquipments`
if (!content.includes('const [isAddingEquipment, setIsAddingEquipment]')) {
  content = content.replace(
    '  const [shelfToAdd, setShelfToAdd] = useState("");',
    '  const [shelfToAdd, setShelfToAdd] = useState("");\n  const [isAddingEquipment, setIsAddingEquipment] = useState(false);\n  const [equipmentToAdd, setEquipmentToAdd] = useState("");\n  const [selectedAdditionalEquipments, setSelectedAdditionalEquipments] = useState<string[]>([]);'
  );
}

// 2. Add `expectedEquipments` memo
if (!content.includes('const expectedEquipments = useMemo')) {
  content = content.replace(
    '  const [standardRows, setStandardRows] = useState',
    '  const expectedEquipments = useMemo(() => {\n    return task?.expectedEquipments ?? [];\n  }, [task]);\n\n  const [standardRows, setStandardRows] = useState'
  );
}

// 3. Add `renderedEquipmentIds` memo
if (!content.includes('const renderedEquipmentIds = useMemo')) {
  content = content.replace(
    '  const renderedShelfIds = useMemo(() => {',
    '  const renderedEquipmentIds = useMemo(() => {\n    const expectedIds = expectedEquipments.map((a: any) => a.equipmentId);\n    const stdIds = standardRows.map((r) => r.equipmentId).filter(Boolean);\n    const serIds = serialRows.map((r) => r.equipmentId).filter(Boolean);\n    const all = new Set([...expectedIds, ...stdIds, ...serIds, ...selectedAdditionalEquipments]);\n    return Array.from(all);\n  }, [expectedEquipments, standardRows, serialRows, selectedAdditionalEquipments]);\n\n  const renderedShelfIds = useMemo(() => {'
  );
}

// 4. Update `useEffect` that initializes rows from expected properties
// When it's ByShelf, initialize empty rows for expected equipments
const oldUseEffectRows = `    if (byEquipment) {
      if (task.isSerialized) {
        setSerialRows((current) => {
          if (current.length > 0) return current;
          if (expectedShelves.length > 0) {
            return expectedShelves.map((s) => ({
              id: newId(),
              code: "",
              shelfId: s.shelfId,
            }));
          }
          return [];
        });
      } else {
        setStandardRows((current) => {
          if (current.length > 0) return current;
          if (expectedShelves.length > 0) {
            return expectedShelves.map((s) => ({
              id: newId(),
              equipmentId: task.unit.equipmentId ?? "",
              shelfId: s.shelfId,
              quantity: 0,
            }));
          }
          return [];
        });
      }
    } else {
      if (task.isSerialized) {
        setSerialRows((current) =>
          current.length > 0
            ? current
            : [
                {
                  id: newId(),
                  code: "",
                  shelfId: task.unit.shelfId ?? "",
                },
              ],
        );
      } else {
        setStandardRows((current) =>
          current.length > 0
            ? current
            : [
                {
                  id: newId(),
                  equipmentId: "",
                  shelfId: task.unit.shelfId ?? "",
                  quantity: 0,
                },
              ],
        );
      }
    }`;

const newUseEffectRows = `    if (byEquipment) {
      if (task.isSerialized) {
        setSerialRows((current) => {
          if (current.length > 0) return current;
          if (expectedShelves.length > 0) {
            return expectedShelves.map((s) => ({ id: newId(), code: "", shelfId: s.shelfId }));
          }
          return [];
        });
      } else {
        setStandardRows((current) => {
          if (current.length > 0) return current;
          if (expectedShelves.length > 0) {
            return expectedShelves.map((s) => ({ id: newId(), equipmentId: task.unit.equipmentId ?? "", shelfId: s.shelfId, quantity: 0 }));
          }
          return [];
        });
      }
    } else {
      // ByShelf
      setStandardRows((current) => {
        if (current.length > 0) return current;
        return expectedEquipments.filter(e => !e.hasSerialNumber).map((e) => ({
          id: newId(), equipmentId: e.equipmentId, shelfId: task.unit.shelfId ?? "", quantity: 0
        }));
      });
      setSerialRows((current) => {
        if (current.length > 0) return current;
        return expectedEquipments.filter(e => e.hasSerialNumber).map((e) => ({
          id: newId(), equipmentId: e.equipmentId, code: "", shelfId: task.unit.shelfId ?? ""
        }));
      });
    }`;
content = content.replace(oldUseEffectRows, newUseEffectRows);

fs.writeFileSync(file, content);
console.log('Patch step 1 applied.');
