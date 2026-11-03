import { run } from "./db";

type AuditInput = {
  adminId: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  diff?: unknown;
};

/** Every admin write must leave a trail. Never let a logging failure hide the write. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await run(
      `INSERT INTO audit_log (admin_id, action, entity_type, entity_id, diff_json)
       VALUES (?, ?, ?, ?, ?)`,
      input.adminId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.diff ? JSON.stringify(input.diff).slice(0, 20_000) : null,
    );
  } catch (error) {
    console.error("audit_log write failed", error);
  }
}
