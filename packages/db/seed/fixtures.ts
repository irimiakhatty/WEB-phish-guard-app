import { daysAgo, withAttackType, type ScanFixture } from "./helpers";

export const DEMO_ORG = {
  name: "Acme Romania SRL",
  slug: "acme-romania",
  domain: "acme.demo",
} as const;

export const DEMO_PASSWORD = "Demo@123456";

export const DEMO_DEPARTMENTS = ["IT", "Finance", "HR"] as const;

export type DemoMemberRole = "admin" | "member" | "viewer";

export type DemoUserFixture = {
  key: string;
  name: string;
  email: string;
  role: DemoMemberRole;
  department: (typeof DEMO_DEPARTMENTS)[number];
  scans: ScanFixture[];
  training?: {
    status: "assigned" | "in_progress" | "completed" | "dismissed";
    source: "manual" | "automatic";
    attackType: string;
    recommendation: string;
    dueInDays?: number;
    completedDaysAgo?: number;
  };
};

const safeScan = (days: number, hour = 0): ScanFixture => ({
  daysAgo: days,
  riskLevel: "safe",
  isPhishing: false,
  overallScore: 0.08,
  urlScore: 0.05,
  textScore: 0.1,
  confidence: 0.92,
  url: "https://www.anaf.ro",
  textContent: "Notificare ANAF privind declararea impozitelor pentru Q1.",
  analysis:
    "Conținutul corespunde unui mesaj instituțional legitim. Nu s-au detectat indicatori de phishing.",
  detectedThreats: [],
  source: "web",
});

const lowScan = (
  days: number,
  attackType: ScanFixture["attackType"],
  text: string,
  hour = 0
): ScanFixture => ({
  daysAgo: days,
  riskLevel: "low",
  isPhishing: false,
  overallScore: 0.28,
  urlScore: 0.22,
  textScore: 0.34,
  confidence: 0.74,
  url: "https://support-portal.example.com/login",
  textContent: text,
  analysis:
    "Mesaj cu urgență moderată și link extern. Recomandăm verificarea domeniului înainte de acțiune.",
  detectedThreats: withAttackType(["Suspicious urgency language"], attackType),
  source: hour % 2 === 0 ? "web" : "extension",
});

const mediumScan = (
  days: number,
  attackType: ScanFixture["attackType"],
  text: string,
  url: string
): ScanFixture => ({
  daysAgo: days,
  riskLevel: "medium",
  isPhishing: true,
  overallScore: 0.52,
  urlScore: 0.48,
  textScore: 0.56,
  confidence: 0.81,
  url,
  textContent: text,
  analysis:
    "Pattern de impersonare detectat. URL-ul nu corespunde brandului menționat în mesaj.",
  detectedThreats: withAttackType(
    ["Brand impersonation", "Misleading login link"],
    attackType
  ),
  source: "extension",
});

const highScan = (
  days: number,
  attackType: ScanFixture["attackType"],
  text: string,
  url: string
): ScanFixture => ({
  daysAgo: days,
  riskLevel: "high",
  isPhishing: true,
  overallScore: 0.72,
  urlScore: 0.69,
  textScore: 0.75,
  confidence: 0.89,
  url,
  textContent: text,
  analysis:
    "Indicatori multipli de compromitere: domeniu nou, presiune temporală și solicitare de acțiune financiară.",
  detectedThreats: withAttackType(
    ["High urgency", "External payment request", "Executive impersonation"],
    attackType
  ),
  source: "web",
});

const criticalScan = (
  days: number,
  attackType: ScanFixture["attackType"],
  text: string,
  url: string
): ScanFixture => ({
  daysAgo: days,
  riskLevel: "critical",
  isPhishing: true,
  overallScore: 0.91,
  urlScore: 0.88,
  textScore: 0.94,
  confidence: 0.96,
  url,
  textContent: text,
  analysis:
    "Amenințare critică: colectare credențiale pe domeniu malițios cu indicii clare de spear phishing.",
  detectedThreats: withAttackType(
    ["Credential harvesting form", "Typosquatting domain", "Spoofed sender"],
    attackType
  ),
  source: "api",
});

export const DEMO_USERS: DemoUserFixture[] = [
  {
    key: "org-admin",
    name: "Ana Popescu",
    email: "ana.popescu@acme.demo",
    role: "admin",
    department: "IT",
    scans: [
      safeScan(1),
      safeScan(3),
      lowScan(5, "Delivery/Logistics", "Colet DHL în așteptare. Verificați adresa de livrare."),
      safeScan(8),
      mediumScan(
        12,
        "Account Suspension",
        "Contul dvs. Microsoft va fi suspendat dacă nu confirmați identitatea.",
        "https://microsft-verify-login.example/auth"
      ),
      safeScan(16),
      safeScan(22),
    ],
  },
  {
    key: "high-risk-it",
    name: "Ion Marinescu",
    email: "ion.marinescu@acme.demo",
    role: "member",
    department: "IT",
    scans: [
      highScan(
        1,
        "CEO Fraud",
        "De la: Director General. Transfer urgent 15.000 EUR către furnizor extern până la 16:00.",
        "https://acme-executive-payments.example/wire"
      ),
      criticalScan(
        2,
        "CEO Fraud",
        "Aprobare imediată necesară pentru plată confidențială. Nu discutați cu echipa financiară.",
        "https://ceo-approval-acme.example/confirm"
      ),
      highScan(
        4,
        "CEO Fraud",
        "Gift cards pentru parteneri - cumpărați 10 carduri și trimiteți codurile.",
        "https://giftcard-request-acme.example"
      ),
      mediumScan(
        6,
        "CEO Fraud",
        "Plata urgenta catre furnizor nou. Transfer bancar astazi.",
        "https://wire-transfer-acme.example"
      ),
      highScan(
        9,
        "CEO Fraud",
        "Director general: aprobati plata urgenta inainte de sedinta.",
        "https://executive-payment-acme.example"
      ),
      criticalScan(
        11,
        "CEO Fraud",
        "Transfer bancar confidential necesar imediat.",
        "https://urgent-wire-acme.example"
      ),
      safeScan(14),
      lowScan(18, "CEO Fraud", "Reminder: verificati cererea de plata urgenta."),
    ],
    training: {
      status: "assigned",
      source: "automatic",
      attackType: "CEO Fraud",
      recommendation:
        "Ion are 5 scanări high/critical legate de CEO Fraud în ultimele 30 de zile. Recomandăm modul de awareness pentru fraude executive.",
      dueInDays: 5,
    },
  },
  {
    key: "critical-finance",
    name: "Elena Stan",
    email: "elena.stan@acme.demo",
    role: "member",
    department: "Finance",
    scans: [
      criticalScan(
        1,
        "Credential Harvesting",
        "Autentificare necesară pentru portal bancar. Verificați parola contului.",
        "https://secure-bank-login.example/auth"
      ),
      criticalScan(
        3,
        "Invoice/Payment",
        "Factura restantă #INV-9921. Plata prin IBAN alternativ până mâine.",
        "https://invoice-payment-acme.example/pay"
      ),
      highScan(
        5,
        "Invoice/Payment",
        "Swift transfer required for overdue invoice. IBAN updated in attachment.",
        "https://billing-acme-partner.example"
      ),
      highScan(
        7,
        "Credential Harvesting",
        "Reset parola contului. Link de autentificare expiră în 2 ore.",
        "https://login-verify-acme.example/reset"
      ),
      mediumScan(
        10,
        "Invoice/Payment",
        "Payment approval needed for vendor invoice #4421.",
        "https://vendor-pay-acme.example"
      ),
      lowScan(13, "Invoice/Payment", "Reminder: factura #8832 așteaptă confirmare."),
      safeScan(20),
    ],
    training: {
      status: "assigned",
      source: "automatic",
      attackType: "Credential Harvesting",
      recommendation:
        "Elena a interacționat cu multiple tentative de credential harvesting și facturi frauduloase. Training prioritar recomandat.",
      dueInDays: 3,
    },
  },
  {
    key: "medium-hr",
    name: "Mihai Dumitru",
    email: "mihai.dumitru@acme.demo",
    role: "member",
    department: "HR",
    scans: [
      mediumScan(
        2,
        "Account Suspension",
        "Contul dvs. a fost suspendat temporar. Confirmați identitatea.",
        "https://account-reactivate.example"
      ),
      mediumScan(
        6,
        "Delivery/Logistics",
        "Colet blocat la vamă. Plătiți taxa de procesare.",
        "https://dhl-customs-fee.example"
      ),
      lowScan(9, "Account Suspension", "Cont blocat - verificare necesară."),
      safeScan(12),
      safeScan(19),
    ],
  },
  {
    key: "low-viewer",
    name: "Laura Ionescu",
    email: "laura.ionescu@acme.demo",
    role: "viewer",
    department: "HR",
    scans: [
      safeScan(2),
      safeScan(7),
      lowScan(11, "Other", "Mesaj necunoscut cu link generic."),
      safeScan(17),
    ],
  },
  {
    key: "training-in-progress",
    name: "Andrei Vasile",
    email: "andrei.vasile@acme.demo",
    role: "member",
    department: "IT",
    scans: [
      highScan(
        3,
        "Delivery/Logistics",
        "DHL: coletul nu poate fi livrat. Actualizați adresa și plătiți taxa.",
        "https://dhl-redelivery-fee.example"
      ),
      highScan(
        8,
        "Delivery/Logistics",
        "Shipment on hold. Pay customs processing fee to release package.",
        "https://fedex-hold-payment.example"
      ),
      mediumScan(
        12,
        "Delivery/Logistics",
        "Tracking update required for package #DHL-99231.",
        "https://tracking-update-dhl.example"
      ),
      lowScan(16, "Delivery/Logistics", "Colet in asteptare la depozit."),
      safeScan(21),
    ],
    training: {
      status: "in_progress",
      source: "manual",
      attackType: "Delivery/Logistics",
      recommendation:
        "Andrei a deschis link-uri de tip delivery scam. Continuați modulul de training despre fraude logistice.",
      dueInDays: 2,
    },
  },
  {
    key: "training-completed",
    name: "Maria Georgescu",
    email: "maria.georgescu@acme.demo",
    role: "member",
    department: "Finance",
    scans: [
      safeScan(4),
      safeScan(9),
      safeScan(15),
      lowScan(20, "Other", "Mesaj cu link suspect, dar fără acțiune."),
    ],
    training: {
      status: "completed",
      source: "automatic",
      attackType: "Invoice/Payment",
      recommendation:
        "Training completat cu succes după expunere la tentative de facturi frauduloase.",
      completedDaysAgo: 10,
    },
  },
];

export const DEMO_PERSONAL_USER = {
  name: "Radu Demo Personal",
  email: "radu.personal@phishguard.demo",
  scans: [
    safeScan(1),
    lowScan(4, "Credential Harvesting", "Verificați contul dvs. acum."),
    mediumScan(
      8,
      "Account Suspension",
      "Contul va fi dezactivat în 24h dacă nu confirmați.",
      "https://account-lock.example"
    ),
    safeScan(14),
  ],
} as const;

export const DEMO_PENDING_INVITE = {
  email: "nou.membru@acme.demo",
  role: "member",
} as const;

export function buildScanDates(fixtures: ScanFixture[]): Array<ScanFixture & { createdAt: Date }> {
  return fixtures.map((fixture, index) => ({
    ...fixture,
    createdAt: daysAgo(fixture.daysAgo, index % 5),
  }));
}
