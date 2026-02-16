export type AttackType =
  | "CEO Fraud"
  | "Credential Harvesting"
  | "Invoice/Payment"
  | "Account Suspension"
  | "Delivery/Logistics"
  | "Other";

const ATTACK_TYPE_KEYWORDS: Record<AttackType, string[]> = {
  "CEO Fraud": [
    "ceo",
    "cfo",
    "director",
    "executive",
    "urgent request",
    "wire transfer",
    "gift card",
    "payment approval",
    "director general",
    "transfer bancar",
    "plata urgenta",
  ],
  "Credential Harvesting": [
    "login",
    "sign in",
    "password",
    "verify",
    "account",
    "confirm",
    "reset",
    "autentificare",
    "parola",
    "verifica",
    "cont",
  ],
  "Invoice/Payment": [
    "invoice",
    "payment",
    "bank",
    "iban",
    "swift",
    "ach",
    "factura",
    "plata",
    "transfer",
    "remittance",
  ],
  "Account Suspension": [
    "suspend",
    "locked",
    "disabled",
    "deactivate",
    "account limited",
    "suspendat",
    "blocat",
    "dezactivat",
  ],
  "Delivery/Logistics": [
    "delivery",
    "package",
    "shipment",
    "tracking",
    "dhl",
    "fedex",
    "ups",
    "livrare",
    "colet",
  ],
  Other: [],
};

export function classifyAttackType(text: string): AttackType {
  const normalized = text.toLowerCase();
  for (const [type, keywords] of Object.entries(ATTACK_TYPE_KEYWORDS) as [
    AttackType,
    string[],
  ][]) {
    if (type === "Other") continue;
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return type;
    }
  }
  return "Other";
}

export const ATTACK_TYPES: AttackType[] = [
  "CEO Fraud",
  "Credential Harvesting",
  "Invoice/Payment",
  "Account Suspension",
  "Delivery/Logistics",
  "Other",
];
