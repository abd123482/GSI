import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Webhook } from 'svix';
import { AuthService } from './auth.service.js';

@Controller('auth/webhooks')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('clerk')
  @HttpCode(HttpStatus.OK)
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.error('CLERK_WEBHOOK_SECRET is not configured on the server');
      throw new InternalServerErrorException('Webhook secret not configured');
    }

    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new BadRequestException('Missing required Svix webhook verification headers');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error(
        'Raw request body unavailable for signature verification. Ensure rawBody: true is configured in NestFactory.create.',
      );
      throw new InternalServerErrorException('Raw body unavailable for signature verification');
    }

    const payload = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : String(rawBody);

    let wh: Webhook;
    try {
      wh = new Webhook(webhookSecret);
    } catch (err: any) {
      this.logger.error(`Invalid webhook secret format: ${err?.message}`);
      throw new InternalServerErrorException('Webhook secret configuration error');
    }

    let event: any;
    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (err: any) {
      this.logger.warn(`Clerk webhook signature verification failed: ${err?.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    const eventType = event.type;
    const data = event.data;
    this.logger.log(`Received Clerk webhook event: ${eventType}`);

    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        const clerkUserId = data.id;
        const email =
          data.email_addresses?.find(
            (item: any) => item.id === data.primary_email_address_id,
          )?.email_address ??
          data.email_addresses?.[0]?.email_address ??
          null;

        const fullName =
          [data.first_name, data.last_name].filter(Boolean).join(' ') ||
          data.username ||
          email;

        await this.authService.syncUserFromClerk(clerkUserId, {
          userName: fullName,
          userEmail: email,
        });
        break;
      }

      case 'user.deleted': {
        const clerkUserId = data.id;
        await this.authService.disableUserFromClerk(clerkUserId);
        this.logger.log(`Soft-disabled local user for deleted Clerk user: ${clerkUserId}`);
        break;
      }

      default:
        this.logger.debug(`Ignored unhandled Clerk webhook event: ${eventType}`);
    }

    return { received: true };
  }
}
