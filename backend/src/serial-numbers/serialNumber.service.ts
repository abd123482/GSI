import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z, ZodError } from 'zod';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginationSchema } from './dto/index.js';

const uuid = z.string().trim().uuid().transform((id) => id.toLowerCase());
const status = z.union([z.boolean(), z.string().trim().toUpperCase()
  .pipe(z.enum(['TRUE', 'FALSE', 'ACTIVE', 'INACTIVE', 'AVAILABLE', 'UNAVAILABLE']))])
  .transform((value) => value === true || value === 'TRUE' || value === 'ACTIVE' || value === 'AVAILABLE' ? 'ACTIVE' : 'INACTIVE');
const updateSchema = z.object({ serialNumberStatus: status }).strict();
const searchSchema = z.object({
  serialNumberCode: z.string().trim().max(200).optional(),
  serialNumberStatus: status.optional(), equipmentId: uuid.optional(),
});
const SERIAL_SELECT = {
  serialNumberId: true, serialNumberCode: true, serialNumberStatus: true, equipmentId: true,
  equipment: { select: { equipmentId: true, equipmentName: true, hasSerialNumber: true, equipmentStatus: true } },
} satisfies Prisma.SerialNumberSelect;

@Injectable()
export class SerialNumberService {
  constructor(private readonly prisma: PrismaService) { }

  // Keep old controller methods, but never allow standalone serial creation.
  async createSerialNumber(_dto: unknown): Promise<never> {
    throw new BadRequestException('Create serial numbers in POST /movements with movementType IN');
  }
  async createBatchSerialNumbers(dto: unknown): Promise<never> { return this.createSerialNumber(dto); }

  async getSerialNumbers(query: unknown = {}, pagination?: unknown) {
    return this.run(async () => {
      const f = searchSchema.parse(query ?? {}), { page, limit } = paginationSchema.parse(pagination ?? query ?? {});
      const skip = (page - 1) * limit;
      if (!Number.isSafeInteger(skip) || skip > 2_147_483_647) throw new BadRequestException('Page is too large');
      const where: Prisma.SerialNumberWhereInput = {
        ...(f.serialNumberCode ? { serialNumberCode: { contains: f.serialNumberCode } } : {}),
        ...(f.serialNumberStatus !== undefined ? { serialNumberStatus: f.serialNumberStatus } : {}),
        ...(f.equipmentId ? { equipmentId: f.equipmentId } : {}),
      };
      const [serialNumbers, totalSerialNumbers] = await Promise.all([
        this.prisma.serialNumber.findMany({
          where, skip, take: limit, select: SERIAL_SELECT,
          orderBy: [{ serialNumberCode: 'asc' }, { serialNumberId: 'asc' }]
        }),
        this.prisma.serialNumber.count({ where }),
      ]);
      return { serialNumbers, totalSerialNumbers, totalPages: Math.ceil(totalSerialNumbers / limit) || 1, currentPage: page, limit };
    });
  }

  async getSerialNumberById(id: string) {
    return this.run(() => this.prisma.serialNumber.findUniqueOrThrow({ where: { serialNumberId: uuid.parse(id) }, select: SERIAL_SELECT }));
  }
  async getSerialNumberByCode(code: string) {
    return this.run(() => this.prisma.serialNumber.findUniqueOrThrow({
      where: { serialNumberCode: z.string().trim().min(1).max(200).parse(code) }, select: SERIAL_SELECT,
    }));
  }
  async updateSerialNumber(id: string, dto: unknown) {
    return this.run(() => this.prisma.serialNumber.update({
      where: { serialNumberId: uuid.parse(id) }, data: updateSchema.parse(dto), select: SERIAL_SELECT,
    }));
  }
  async updateSerialNumberStatus(id: string, dto: unknown) { return this.updateSerialNumber(id, dto); }

  // Only a never-used legacy identity can be deleted. OUT does not erase history.
  async deleteSerialNumber(id: string) {
    return this.run(async () => {
      const serialNumberId = uuid.parse(id);
      return this.prisma.$transaction(async (tx) => {
        const resource = `SOMIPHARM:SERIAL:${serialNumberId}`;
        const [lock] = await tx.$queryRaw<{ result: number }[]>`
          DECLARE @r int; EXEC @r = sys.sp_getapplock @Resource=${resource},
          @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=5000;
          SELECT @r AS result;`;
        if (!lock || (lock.result !== 0 && lock.result !== 1)) throw new ConflictException('Serial is busy; retry');
        const serial = await tx.serialNumber.findUniqueOrThrow({
          where: { serialNumberId },
          select: { ...SERIAL_SELECT, _count: { select: { movementItems: true } } }
        });
        if (Object.values(serial._count).some((count) => count > 0))
          throw new ConflictException('Serial is allocated or has history; deactivate it instead');
        return tx.serialNumber.delete({ where: { serialNumberId }, select: SERIAL_SELECT });
      }, { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 15_000 });
    });
  }

  private async run<T>(work: () => PromiseLike<T>): Promise<T> {
    try { return await work(); } catch (error) {
      if (error instanceof ZodError) throw new BadRequestException(error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 'P2025') throw new NotFoundException('Serial number not found');
      if (code === 'P2002' || code === 'P2003' || code === 'P2034') throw new ConflictException('Serial is duplicated, referenced, or changed concurrently');
      if (code === 'P2028') throw new ServiceUnavailableException('Transaction could not complete; refresh before retrying');
      throw error;
    }
  }
}
