import { z } from "zod";
import { APP_ROLES } from "@/types/permissions";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

export const requiredString = (label: string, min = 1) =>
  z.string().trim().min(min, `${label} is required.`);

export const optionalString = z.string().trim().optional();

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
  remember: z.boolean().optional(),
});

export const passwordResetSchema = z.object({
  email: emailSchema,
});

export const setupSchema = z.object({
  name: requiredString("Full name", 2),
  employeeId: requiredString("Employee ID", 3),
  email: emailSchema,
  password: passwordSchema,
  phone: optionalString,
  department: optionalString,
  designation: optionalString,
});

export const createUserSchema = z.object({
  name: requiredString("Full name", 2),
  employeeId: optionalString,
  email: emailSchema,
  phone: optionalString,
  department: optionalString,
  designation: optionalString,
  role: z.enum(APP_ROLES),
  status: z.enum(["active", "inactive", "invited", "suspended"]).default("invited"),
});

export const profileUpdateSchema = z.object({
  name: requiredString("Full name", 2),
  phone: optionalString,
  department: optionalString,
  designation: optionalString,
});

export const accountStatusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().trim().optional(),
});

export const idSchema = z.string().trim().min(1, "Record id is required.");

export function parseForm<T>(schema: z.ZodSchema<T>, values: unknown) {
  const result = schema.safeParse(values);
  if (result.success) {
    return { data: result.data, errors: {} as Record<string, string> };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }

  return { data: null, errors };
}
