const INTERNAL_TAG_PREFIXES = [
  "scoring_version:",
  "weighted_score:",
  "model_url:",
  "model_text:",
  "safe_browsing:",
  "policy_action:",
  "policy_reason:",
  "policy_forensics_mode:",
  "policy_store_safe_content:",
  "policy_store_phishing_content:",
  "policy_store_safe_url:",
  "policy_store_phishing_url:",
  "policy_store_full_url:",
  "retention_text:",
  "retention_url:",
  "text_sha256:",
  "url_sha256:",
] as const;

export function isInternalScanTag(tag: string): boolean {
  return INTERNAL_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix));
}

export function isFeedbackTag(tag: string): boolean {
  return tag.startsWith("feedback_");
}

export function isAttackTypeTag(tag: string): boolean {
  return tag.startsWith("attack_type:");
}

export function filterUserFacingThreats(tags: string[]): string[] {
  return (tags || []).filter((tag) => {
    if (typeof tag !== "string" || tag.length === 0) return false;
    if (isFeedbackTag(tag)) return false;
    if (isInternalScanTag(tag)) return false;
    if (isAttackTypeTag(tag)) return false;
    return true;
  });
}

