export const PASSWORD_MIN_LENGTH = 10;

const PASSWORD_RULES = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    label: "At least one number",
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    id: "symbol",
    label: "At least one special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

export function getPasswordRuleStates(value: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(value),
  }));
}

export function isPasswordStrong(value: string) {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

export const PASSWORD_POLICY_ERROR =
  "Password must include uppercase, lowercase, number, special character, and minimum length.";
