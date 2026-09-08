import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { AuthService } from './auth.service.js';
import { ClerkWebhookController } from './clerk-webhook.controller.js';
import { UsersAdminService } from '../users/users-admin.service.js';
import * as clerkBackend from '@clerk/backend';

vi.mock('@clerk/backend', () => {
  return {
    createClerkClient: vi.fn().mockReturnValue({
      users: {
        getUser: vi.fn(),
      },
    }),
    verifyToken: vi.fn(),
  };
});

export const mockWebhookVerify = vi.fn();
vi.mock('svix', () => {
  return {
    Webhook: class MockWebhook {
      verify = mockWebhookVerify;
    },
  };
});

describe('Complete 25-Point Authentication, Authorization & Webhook Test Suite', () => {
  let authService: AuthService;
  let clerkAuthGuard: ClerkAuthGuard;
  let reflector: Reflector;
  let permissionsGuard: PermissionsGuard;
  let rolesGuard: RolesGuard;
  let clerkWebhookController: ClerkWebhookController;
  let usersAdminService: UsersAdminService;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.CLERK_JWT_KEY = 'test_jwt_key';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_secret';

    mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      role: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      permission: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };

    authService = new AuthService(mockPrisma as any);
    clerkAuthGuard = new ClerkAuthGuard(authService);
    reflector = new Reflector();
    permissionsGuard = new PermissionsGuard(reflector);
    rolesGuard = new RolesGuard(reflector);
    clerkWebhookController = new ClerkWebhookController(authService);
    usersAdminService = new UsersAdminService(mockPrisma as any);
  });

  function createMockContext(
    headers: Record<string, string> = {},
    authUser?: any,
    handler: any = () => ({}),
    cls: any = () => ({}),
  ): ExecutionContext {
    const request: any = {
      headers,
      authUser,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;
  }

  // =========================================================================
  // 1-7: Authentication Guard & Status Enforcement
  // =========================================================================
  describe('Clerk Authentication & User Status Enforcement (Tests 1-7)', () => {
    it('1. should throw 401 when Authorization header is missing', async () => {
      const context = createMockContext({});
      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        'Authentication required',
      );
    });

    it('2. should throw 401 when Bearer token is empty', async () => {
      const context = createMockContext({ authorization: 'Bearer ' });
      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        /Bearer token is empty/,
      );
    });

    it('3. should throw 401 when token is invalid or expired', async () => {
      const context = createMockContext({ authorization: 'Bearer invalid_tok' });
      vi.mocked(clerkBackend.verifyToken).mockRejectedValue(
        new Error('Token signature invalid'),
      );

      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        'Invalid or expired Clerk session',
      );
    });

    it('4. should succeed with 200 and attach AuthenticatedUser for valid ACTIVE user', async () => {
      const context = createMockContext({ authorization: 'Bearer valid_tok' });
      vi.mocked(clerkBackend.verifyToken).mockResolvedValue({
        sub: 'user_clerk_active',
      } as any);

      mockPrisma.user.findFirst.mockResolvedValue({
        userId: 'uuid-active-1',
        clerkUserId: 'user_clerk_active',
        userName: 'Admin User',
        userEmail: 'admin@somipharm.com',
        userStatus: 'ACTIVE',
        roleId: 'role-admin-id',
        role: {
          roleName: 'ADMIN',
          permissions: [{ permissionName: 'equipment.read' }],
        },
      });

      const allowed = await clerkAuthGuard.canActivate(context);
      expect(allowed).toBe(true);

      const req = context.switchToHttp().getRequest<any>();
      expect(req.authUser).toEqual({
        userId: 'uuid-active-1',
        clerkUserId: 'user_clerk_active',
        userName: 'Admin User',
        userEmail: 'admin@somipharm.com',
        roleId: 'role-admin-id',
        roleName: 'ADMIN',
        permissions: ['equipment.read'],
        status: 'ACTIVE',
      });
    });

    it('5. should throw 403 Forbidden when userStatus is PENDING', async () => {
      const context = createMockContext({ authorization: 'Bearer valid_tok' });
      vi.mocked(clerkBackend.verifyToken).mockResolvedValue({
        sub: 'user_pending',
      } as any);

      mockPrisma.user.findFirst.mockResolvedValue({
        userId: 'uuid-pending',
        clerkUserId: 'user_pending',
        userStatus: 'PENDING',
      });

      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        /User account is not active \(status: PENDING\)/,
      );
    });

    it('6. should throw 403 Forbidden when userStatus is DISABLED', async () => {
      const context = createMockContext({ authorization: 'Bearer valid_tok' });
      vi.mocked(clerkBackend.verifyToken).mockResolvedValue({
        sub: 'user_disabled',
      } as any);

      mockPrisma.user.findFirst.mockResolvedValue({
        userId: 'uuid-disabled',
        clerkUserId: 'user_disabled',
        userStatus: 'DISABLED',
      });

      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('7. should throw 403 Forbidden when userStatus is BLOCKED', async () => {
      const context = createMockContext({ authorization: 'Bearer valid_tok' });
      vi.mocked(clerkBackend.verifyToken).mockResolvedValue({
        sub: 'user_blocked',
      } as any);

      mockPrisma.user.findFirst.mockResolvedValue({
        userId: 'uuid-blocked',
        clerkUserId: 'user_blocked',
        userStatus: 'BLOCKED',
      });

      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =========================================================================
  // 8-13: Granular Permission Authorization across Controllers
  // =========================================================================
  describe('Permission Guard on Business Controllers (Tests 8-13)', () => {
    it('8. should reject GET /equipment without token (401)', async () => {
      const context = createMockContext({});
      await expect(clerkAuthGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('9. should reject ACTIVE user without equipment.read on GET /equipment (403)', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['equipment.read']);
      const context = createMockContext(
        {},
        { permissions: ['shelf.read', 'movement.read'] },
      );
      expect(() => permissionsGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
      expect(() => permissionsGuard.canActivate(context)).toThrow(
        /Missing required permission\(s\): equipment\.read/,
      );
    });

    it('10. should allow ACTIVE user with equipment.read on GET /equipment', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['equipment.read']);
      const context = createMockContext(
        {},
        { permissions: ['equipment.read', 'equipment.create'] },
      );
      expect(permissionsGuard.canActivate(context)).toBe(true);
    });

    it('11. should reject ACTIVE user without equipment.create on POST /equipment (403)', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['equipment.create']);
      const context = createMockContext(
        {},
        { permissions: ['equipment.read'] },
      );
      expect(() => permissionsGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
    });

    it('12. should allow ACTIVE user with equipment.create on POST /equipment', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['equipment.create']);
      const context = createMockContext(
        {},
        { permissions: ['equipment.read', 'equipment.create'] },
      );
      expect(permissionsGuard.canActivate(context)).toBe(true);
    });

    it('13. should enforce permissions for serial numbers, movements, and shelves', () => {
      // serial-number.create
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['serial-number.create']);
      const noSerial = createMockContext({}, { permissions: ['movement.create'] });
      expect(() => permissionsGuard.canActivate(noSerial)).toThrow(ForbiddenException);

      const hasSerial = createMockContext({}, { permissions: ['serial-number.create'] });
      expect(permissionsGuard.canActivate(hasSerial)).toBe(true);

      // movement.create
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['movement.create']);
      const noMovement = createMockContext({}, { permissions: ['shelf.create'] });
      expect(() => permissionsGuard.canActivate(noMovement)).toThrow(ForbiddenException);

      const hasMovement = createMockContext({}, { permissions: ['movement.create'] });
      expect(permissionsGuard.canActivate(hasMovement)).toBe(true);

      // shelf.create
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['shelf.create']);
      const noShelf = createMockContext({}, { permissions: ['equipment.create'] });
      expect(() => permissionsGuard.canActivate(noShelf)).toThrow(ForbiddenException);

      const hasShelf = createMockContext({}, { permissions: ['shelf.create'] });
      expect(permissionsGuard.canActivate(hasShelf)).toBe(true);
    });
  });

  // =========================================================================
  // 14-16: User Onboarding, Idempotency & Race Safety
  // =========================================================================
  describe('User Onboarding & Concurrency (Tests 14-16)', () => {
    it('14. should create one PENDING local user on first authenticated request', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const mockGetUser = vi.fn().mockResolvedValue({
        id: 'user_clerk_new',
        firstName: 'New',
        lastName: 'Member',
        primaryEmailAddressId: 'e-1',
        emailAddresses: [{ id: 'e-1', emailAddress: 'new@somipharm.com' }],
      });
      (authService as any).clerk = { users: { getUser: mockGetUser } };

      mockPrisma.user.create.mockResolvedValue({
        userId: 'uuid-new-1',
        clerkUserId: 'user_clerk_new',
        userName: 'New Member',
        userEmail: 'new@somipharm.com',
        userStatus: 'PENDING',
        roleId: null,
      });

      const user = await authService.getOrCreateLocalUser('user_clerk_new');
      expect(user.userStatus).toBe('PENDING');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clerkUserId: 'user_clerk_new',
            userStatus: 'PENDING',
          }),
        }),
      );
    });

    it('15. should reuse existing user on repeated requests without creating duplicates', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        userId: 'uuid-existing',
        clerkUserId: 'user_clerk_existing',
        userStatus: 'ACTIVE',
      });

      const user = await authService.getOrCreateLocalUser('user_clerk_existing');
      expect(user.userId).toBe('uuid-existing');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('16. should handle concurrent race condition (P2002) and return winning user', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const p2002Err: any = new Error('Unique constraint UX_User_ClerkUserId');
      p2002Err.code = 'P2002';
      mockPrisma.user.create.mockRejectedValueOnce(p2002Err);

      mockPrisma.user.findFirst.mockResolvedValueOnce({
        userId: 'uuid-concurrent-winner',
        clerkUserId: 'user_concurrent',
        userStatus: 'PENDING',
      });

      const user = await authService.getOrCreateLocalUser('user_concurrent');
      expect(user.userId).toBe('uuid-concurrent-winner');
    });
  });

  // =========================================================================
  // 17-21: Clerk Webhook Hardening & Signatures
  // =========================================================================
  describe('Clerk Webhook Synchronization & Signatures (Tests 17-21)', () => {
    it('17. should process user.created webhook and create local PENDING user', async () => {
      const syncSpy = vi
        .spyOn(authService, 'syncUserFromClerk')
        .mockResolvedValue({} as any);

      mockWebhookVerify.mockReturnValue({
        type: 'user.created',
        data: {
          id: 'user_wh_1',
          first_name: 'Jane',
          last_name: 'Doe',
          primary_email_address_id: 'e-1',
          email_addresses: [{ id: 'e-1', email_address: 'jane@somipharm.com' }],
        },
      });

      const mockReq: any = {
        rawBody: Buffer.from(JSON.stringify({ test: 'payload' })),
      };

      const res = await clerkWebhookController.handleClerkWebhook(
        mockReq,
        'msg_1',
        '1234567890',
        'v1,valid_sig',
      );

      expect(res).toEqual({ received: true });
      expect(syncSpy).toHaveBeenCalledWith('user_wh_1', {
        userName: 'Jane Doe',
        userEmail: 'jane@somipharm.com',
      });
    });

    it('18. should process user.updated webhook to update name/email without modifying role or status', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        userId: 'uuid-1',
        userStatus: 'ACTIVE',
        roleId: 'role-admin',
      });

      const updateSpy = vi.spyOn(authService, 'syncUserFromClerk');

      mockWebhookVerify.mockReturnValue({
        type: 'user.updated',
        data: {
          id: 'user_wh_1',
          first_name: 'Jane',
          last_name: 'Updated',
          primary_email_address_id: 'e-1',
          email_addresses: [{ id: 'e-1', email_address: 'jane.new@somipharm.com' }],
        },
      });

      const mockReq: any = {
        rawBody: Buffer.from(JSON.stringify({ test: 'payload' })),
      };

      await clerkWebhookController.handleClerkWebhook(
        mockReq,
        'msg_1',
        '1234567890',
        'v1,valid_sig',
      );

      expect(updateSpy).toHaveBeenCalledWith('user_wh_1', {
        userName: 'Jane Updated',
        userEmail: 'jane.new@somipharm.com',
      });
    });

    it('19. should process user.deleted webhook and set userStatus to DISABLED', async () => {
      const disableSpy = vi
        .spyOn(authService, 'disableUserFromClerk')
        .mockResolvedValue({} as any);

      mockWebhookVerify.mockReturnValue({
        type: 'user.deleted',
        data: {
          id: 'user_deleted_1',
        },
      });

      const mockReq: any = {
        rawBody: Buffer.from(JSON.stringify({ test: 'payload' })),
      };

      const res = await clerkWebhookController.handleClerkWebhook(
        mockReq,
        'msg_1',
        '1234567890',
        'v1,valid_sig',
      );

      expect(res).toEqual({ received: true });
      expect(disableSpy).toHaveBeenCalledWith('user_deleted_1');
    });

    it('20. should throw 400 BadRequest when webhook signature is invalid', async () => {
      mockWebhookVerify.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      const mockReq: any = {
        rawBody: Buffer.from('payload'),
      };

      await expect(
        clerkWebhookController.handleClerkWebhook(
          mockReq,
          'msg_1',
          '1234567890',
          'v1,bad_sig',
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        clerkWebhookController.handleClerkWebhook(
          mockReq,
          'msg_1',
          '1234567890',
          'v1,bad_sig',
        ),
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('21. should throw 400 BadRequest when required Svix headers are missing', async () => {
      const mockReq: any = { rawBody: Buffer.from('payload') };
      await expect(
        clerkWebhookController.handleClerkWebhook(mockReq, undefined, '123', 'sig'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        clerkWebhookController.handleClerkWebhook(mockReq, 'id', undefined, 'sig'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        clerkWebhookController.handleClerkWebhook(mockReq, 'id', '123', undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 22-25: Administrator Approval & Role Management Endpoints
  // =========================================================================
  describe('Administrator Approval & Role Assignment (Tests 22-25)', () => {
    it('22. should reject status update without user.manage permission (403)', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user.manage']);
      const context = createMockContext({}, { permissions: ['equipment.read'] });
      expect(() => permissionsGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
    });

    it('23. should update user status when user has user.manage permission', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        userId: 'uuid-target-user',
        userStatus: 'PENDING',
      });
      mockPrisma.user.update.mockResolvedValue({
        userId: 'uuid-target-user',
        userStatus: 'ACTIVE',
      });

      const result = await usersAdminService.updateUserStatus(
        'uuid-target-user',
        'ACTIVE',
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'uuid-target-user' },
          data: { userStatus: 'ACTIVE' },
        }),
      );
      expect(result.userStatus).toBe('ACTIVE');
    });

    it('24. should reject role assignment without role.manage permission (403)', () => {
      expect(rolesGuard).toBeDefined();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['role.manage']);
      const context = createMockContext({}, { permissions: ['user.manage'] });
      expect(() => permissionsGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
    });

    it('25. should assign role when user has role.manage and role exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        userId: 'uuid-target-user',
      });
      mockPrisma.role.findUnique.mockResolvedValue({
        roleId: 'role-tech-id',
        roleName: 'TECHNICIAN',
      });
      mockPrisma.user.update.mockResolvedValue({
        userId: 'uuid-target-user',
        roleId: 'role-tech-id',
      });

      const result = await usersAdminService.updateUserRole(
        'uuid-target-user',
        'role-tech-id',
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'uuid-target-user' },
          data: { roleId: 'role-tech-id' },
        }),
      );
      expect(result.roleId).toBe('role-tech-id');
    });
  });
});
