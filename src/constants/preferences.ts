import { UserPreferences } from "@/types";

export const defaultPreferences: UserPreferences = {
  theme: "system",
  font_family: "system",
  language: "en",
  auto_sync: true,
  sync_on_save: true,
  default_editor: "system",
  tab_size: 2,
  show_sync_notifications: true,
  remove_links_when_disabling_tool: false,
  vault_backup_consent: "unknown",
  telemetry_consent: "unknown",
  github_token: "",
  skill_display_name_lang: "original",
  skill_display_desc_lang: "original",
};
