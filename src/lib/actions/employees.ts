"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function updateEmployeeStatus(formData: FormData) {
  const locale = await getLocale();
  const employeeId = formData.get("employeeId") as string;
  const propertyId = str(formData, "propertyId"); // null for company staff — fine, only used for the returnTo fallback
  const status = formData.get("status") === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  if (!employeeId) throw new Error("Missing employee id");

  // updateMany (not update) so an id that's already changed/gone by the time
  // of submission (e.g. a stale dialog) is a silent no-op instead of throwing.
  await prisma.employee.updateMany({
    where: { id: employeeId, status: { in: ["ACTIVE", "INACTIVE"] } },
    data: { status },
  });

  const returnTo = str(formData, "returnTo") ?? (propertyId ? `/properties/${propertyId}` : "/employees");
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

export async function terminateEmployee(formData: FormData) {
  const locale = await getLocale();
  const employeeId = formData.get("employeeId") as string;
  const propertyId = str(formData, "propertyId");
  if (!employeeId) throw new Error("Missing employee id");

  await prisma.employee.updateMany({
    where: { id: employeeId, status: { in: ["ACTIVE", "INACTIVE"] } },
    data: { status: "TERMINATED", terminatedAt: new Date() },
  });

  const returnTo = str(formData, "returnTo") ?? (propertyId ? `/properties/${propertyId}` : "/employees");
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

// Creates a new employee — either assigned to one property (Employee has no
// unit-level relation, staff belong to a property as a whole, not a unit) or,
// when no propertyId is submitted, as company-level staff (manager, office
// receptionist, admin) not tied to any single property.
export async function createEmployee(formData: FormData) {
  const locale = await getLocale();
  const propertyId = str(formData, "propertyId");

  const name = str(formData, "name");
  const role = str(formData, "role");
  const salaryAmount = str(formData, "salaryAmount");
  if (!name || !role || !salaryAmount) throw new Error("Missing required employee fields");

  const contactInfo = str(formData, "contactInfo");
  const nidNumber = str(formData, "nidNumber");
  const notes = str(formData, "notes");
  const joinedAtStr = str(formData, "joinedAt");

  await prisma.employee.create({
    data: {
      propertyId,
      name,
      role,
      contactInfo,
      nidNumber,
      notes,
      salaryAmount,
      joinedAt: joinedAtStr ? new Date(joinedAtStr) : undefined,
    },
  });

  const returnTo = str(formData, "returnTo") ?? "/employees";
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}

// Direct update (not updateMany) — matches updateTenantLease/updateProperty's
// precedent for user-initiated edits, including reassigning the employee to
// a different property altogether, or to/from company staff ("stuff assign"
// from the profile/edit UI) — an empty propertyId means company staff.
export async function updateEmployee(formData: FormData) {
  const locale = await getLocale();
  const employeeId = formData.get("employeeId") as string;
  if (!employeeId) throw new Error("Missing employee id");
  const propertyId = str(formData, "propertyId");

  const name = str(formData, "name");
  const role = str(formData, "role");
  const salaryAmount = str(formData, "salaryAmount");
  if (!name || !role || !salaryAmount) throw new Error("Missing required employee fields");

  const contactInfo = str(formData, "contactInfo");
  const nidNumber = str(formData, "nidNumber");
  const notes = str(formData, "notes");

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      propertyId,
      name,
      role,
      contactInfo,
      nidNumber,
      notes,
      salaryAmount,
    },
  });

  const returnTo = str(formData, "returnTo") ?? `/employees/${employeeId}`;
  revalidatePath(returnTo);
  redirect({ href: returnTo, locale });
}
