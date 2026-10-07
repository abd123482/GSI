import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestUrl = httpAdapter.getRequestUrl(request) || request.url;
    const message = exception instanceof HttpException 
      ? exception.message 
      : 'Internal server error';

    // Async logging instead of sync fs.appendFileSync
    this.logger.error(`Exception on path: ${requestUrl}`, exception instanceof Error ? exception.stack : String(exception));

    const responseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: requestUrl,
      message: message,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, status);
  }
}
