import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: number = status;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseBody = exceptionResponse as Record<string, unknown>;
        const resMessage = responseBody.message;
        if (Array.isArray(resMessage)) {
          message = resMessage.join(', ');
        } else if (typeof resMessage === 'string') {
          message = resMessage;
        } else {
          message = exception.message;
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        message = exception.message;
      }
      code = status;
    } else if (exception instanceof QueryFailedError) {
      const queryError = exception as QueryFailedError & { code?: string };
      if (queryError.code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these details already exists.';
      } else {
        message = 'Database query failed';
        status = HttpStatus.INTERNAL_SERVER_ERROR;
      }
      code = status;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Internal server error';
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
