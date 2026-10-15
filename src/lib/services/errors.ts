export class ServiceError extends Error {
  constructor(message: string, public status = 400, public code = "bad_request") {
    super(message);
  }
}
export const notFound = (what: string) => new ServiceError(`${what} not found`, 404, "not_found");

/** Throw on a Supabase error, returning data otherwise. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, context: string): T {
  if (res.error) throw new ServiceError(`${context}: ${res.error.message}`, 500, "db_error");
  if (res.data === null) throw notFound(context);
  return res.data;
}
