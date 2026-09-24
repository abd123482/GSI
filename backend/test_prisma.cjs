const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const eq = await prisma.equipment.findFirst();
    const sh = await prisma.shelf.findFirst();
    console.log(eq.equipmentId, sh.shelfId);
    await prisma.$transaction(async tx => {
      const h = await tx.mouvement.create({
        data: {
          mouvementStatus: 'IN',
          mouvementQuantity: 10
        }
      });
      console.log('header', h.mouvementId);
      await tx.mouvementEquipment.createMany({
        data: [{
          mouvementId: h.mouvementId,
          rowNum: 1,
          equipmentId: eq.equipmentId,
          equipmentTypeSnapshot: 'STANDARD',
          mouvementQuantity: 10,
          mouvementStatus: 'IN',
          destinationShelfId: sh.shelfId
        }]
      });
      console.log('lines done');
      throw new Error('ROLLBACK');
    });
  } catch (e) {
    console.error('Caught:', e);
  }
}
run();
