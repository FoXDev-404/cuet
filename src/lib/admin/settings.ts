import { getSettings, setSetting } from "../settings";

export type SettingField = {
  key: string;
  label: string;
  description: string;
  type: "text" | "boolean";
  defaultValue: string;
  maxLength?: number;
};

export const SETTING_FIELDS: SettingField[] = [
  {
    key: "site_name",
    label: "Site name",
    description: "Shown in the public footer and organization metadata. Keep the real brand name.",
    type: "text",
    defaultValue: "CUET Free Mock Test",
    maxLength: 80,
  },
  {
    key: "registration_enabled",
    label: "Registration open",
    description: "When off, new account signups return a closed-registration error. Existing users can still log in.",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "discussion_enabled",
    label: "Discussions enabled",
    description: "When off, the discussion pages and posting APIs pause for everyone except admins.",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "maintenance_mode",
    label: "Maintenance mode",
    description: "When on, public pages are rewritten to the maintenance notice. Admin pages and APIs stay reachable.",
    type: "boolean",
    defaultValue: "false",
  },
  {
    key: "share_question_during_attempt",
    label: "Share during a live attempt",
    description: "When on, the live ranked attempt screen shows a link-only Share mock button. The question text and image are never shareable there.",
    type: "boolean",
    defaultValue: "false",
  },
];

export const SETTING_KEYS = SETTING_FIELDS.map((field) => field.key);

export async function loadSettings(): Promise<Record<string, string>> {
  const stored = await getSettings(SETTING_KEYS);
  return Object.fromEntries(
    SETTING_FIELDS.map((field) => [field.key, stored[field.key] ?? field.defaultValue]),
  );
}

export function normalizeSettings(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const field of SETTING_FIELDS) {
    const raw = input[field.key];
    if (field.type === "boolean") {
      output[field.key] = raw === false || raw === "false" || raw === "0" || raw === 0 || raw === null || raw === undefined
        ? "false"
        : "true";
      continue;
    }
    const value = String(raw ?? "").trim();
    if (value.length < 2 || value.length > (field.maxLength ?? 80)) {
      throw new Error(`${field.label} must be 2-${field.maxLength ?? 80} characters.`);
    }
    if (value.includes("<") || value.includes(">")) {
      throw new Error(`${field.label} must be plain text.`);
    }
    output[field.key] = value;
  }
  return output;
}

export async function saveSettings(values: Record<string, string>): Promise<void> {
  for (const field of SETTING_FIELDS) {
    const value = values[field.key];
    if (value !== undefined) await setSetting(field.key, value);
  }
}
