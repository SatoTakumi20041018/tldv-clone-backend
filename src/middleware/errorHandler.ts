import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public statusCode: number;
  public errors?: { property: string; constraints: Record<string, string> }[];

  constructor(
    statusCode: number,
    message: string,
    errors?: { property: string; constraints: Record<string, string> }[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(404, message);
    this.name = "NotFound";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
    this.name = "Unauthorized";
  }
}

export class ValidationError extends AppError {
  constructor(
    errors: { property: string; constraints: Record<string, string> }[]
  ) {
    super(400, "Validation failed", errors);
    this.name = "ValidationError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Error:", err.message);

  // Handle malformed JSON body
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      name: "BadRequest",
      message: "Invalid JSON in request body",
    });
    return;
  }

  // Handle Prisma unique constraint errors (race conditions)
  if (err.constructor?.name === "PrismaClientKnownRequestError" && (err as any).code === "P2002") {
    res.status(400).json({
      name: "ValidationError",
      message: "A record with that value already exists",
      errors: [{ property: (err as any).meta?.target?.[0] || "unknown", constraints: { unique: "Value already in use" } }],
    });
    return;
  }

  // Handle Prisma validation errors (e.g., negative skip)
  if (err.constructor?.name === "PrismaClientValidationError") {
    res.status(400).json({
      name: "ValidationError",
      message: "Invalid query parameters",
    });
    return;
  }

  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };

    if (err.errors) {
      response.errors = err.errors;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  res.status(500).json({
    name: "InternalServerError",
    message: "An unexpected error occurred",
  });
}
