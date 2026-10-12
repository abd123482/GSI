const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/src/inventory/inventory.service.ts');
let code = fs.readFileSync(filePath, 'utf8');

// Replace this.prisma.inventoryInvestigationIssue.findMany
code = code.replace(
  /this\.prisma\.inventoryInvestigationIssue\.findMany\(\{[\s\S]*?orderBy:\s*\{\s*createdAt:\s*'desc',\s*\},\s*\}\);/,
  `this.prisma.inventoryIssue.findMany({
      where: { inventoryId },
      include: {
        unit: true,
        resolvedByUser: {
          select: {
            userId: true,
            userName: true,
            userEmail: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });`
);

// Replace resolveInvestigationIssue
code = code.replace(
  /async resolveInvestigationIssue\([\s\S]*?return tx\.inventoryInvestigationIssue\.update\(\{[\s\S]*?\}\);\s*\}\);/,
  `async resolveInvestigationIssue(
    inventoryId: string,
    issueId: string,
    userId: string,
    dto: ResolveIssueDTO,
  ) {
    const data = resolveIssueSchema.parse(dto);

    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.inventoryIssue.findUnique({
        where: { issueId },
      });

      if (!issue) {
        throw new NotFoundException(
          "Problème d'investigation introuvable",
        );
      }

      if (issue.inventoryId !== inventoryId) {
        throw new BadRequestException(
          'Le problème ne correspond pas à cet inventaire.',
        );
      }

      return tx.inventoryIssue.update({
        where: { issueId },
        data: {
          resolvedByUserId: userId,
          resolvedAt: new Date(),
        },
      });
    });`
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully patched issues methods!');
