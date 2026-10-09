export function publicMasterError(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  const name = error instanceof Error ? error.name : "";

  if (name === "UnauthorizedError") return "Sign in is required for this action.";
  if (name === "ForbiddenError") {
    // Prefer specific API messages over the generic label.
    if (raw && !/^you do not have permission for this action\.?$/i.test(raw)) {
      return raw;
    }
    return "You do not have permission for this action.";
  }
  if (name === "DuplicateError" || /already exists|duplicate/i.test(raw)) {
    return "A record with this code already exists.";
  }
  // Firestore security-rule denials — distinct from app RBAC ForbiddenError
  if (/missing or insufficient permissions/i.test(raw)) {
    return "Data access was denied by security rules. Sign out and back in, or contact an administrator.";
  }
  if (/\b(unauthorized|forbidden)\b/i.test(raw)) {
    return raw || "You do not have permission for this action.";
  }
  if (/network|failed to fetch|unavailable/i.test(raw)) {
    return "Network error. Check your connection and try again.";
  }
  if (/overlap/i.test(raw)) return raw;
  if (/inactive/i.test(raw)) return raw;
  if (/closed financial year/i.test(raw)) return raw;
  if (/conversion rule/i.test(raw)) return raw;
  if (name === "ValidationError") return raw || "Please correct the highlighted fields.";
  return "Unable to complete this request. Try again or contact an administrator.";
}

export function createNamedError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}
