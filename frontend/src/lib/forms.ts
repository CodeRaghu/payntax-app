import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "@/api/client";

/** Copy server-side field errors ({errors: {email: [...]}}) onto react-hook-form fields. Returns the
 *  message to show at the top of the form, if any. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: string[]) {
  if (!(error instanceof ApiError)) return "Something went wrong. Try again.";
  let unmatched = false;
  for (const [name, messages] of Object.entries(error.fieldErrors)) {
    if (fields.includes(name)) setError(name as Path<T>, { message: messages.join(" ") });
    else unmatched = true;
  }
  const hasFieldErrors = Object.keys(error.fieldErrors).length > 0;
  if (!hasFieldErrors) return error.message;
  if (unmatched) return Object.values(error.fieldErrors).flat().join(" ");
  return undefined;
}
