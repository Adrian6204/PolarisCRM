import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Consistent error response shape across every route:
 *
 *   { error: { code, message, details? }, requestId }
 *
 * Routes throw an ApiError (or let a ZodError / unexpected error bubble to the
 * withApiRoute wrapper) instead of hand-rolling responses, so clients get one
 * predictable contract.
 */
export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_error: 422,
  rate_limited: 429,
  internal_error: 500,
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get status() {
    return STATUS_BY_CODE[this.code];
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError("unauthorized", message);
  }
  static forbidden(message = "You do not have access to this resource") {
    return new ApiError("forbidden", message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError("not_found", message);
  }
  static conflict(message = "Resource conflict") {
    return new ApiError("conflict", message);
  }
  static badRequest(message = "Bad request") {
    return new ApiError("bad_request", message);
  }
}

interface ErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
  requestId: string;
}

export function errorResponse(
  error: unknown,
  requestId: string,
): NextResponse<ErrorBody> {
  // Zod validation errors → structured 422 with field-level detail.
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: error.flatten(),
        },
        requestId,
      },
      { status: STATUS_BY_CODE.validation_error },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: { code: error.code, message: error.message, details: error.details },
        requestId,
      },
      { status: error.status },
    );
  }

  // Unknown/unexpected — never leak internals to the client.
  return NextResponse.json(
    {
      error: { code: "internal_error", message: "Internal server error" },
      requestId,
    },
    { status: STATUS_BY_CODE.internal_error },
  );
}
