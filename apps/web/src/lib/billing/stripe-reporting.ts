import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";

export type StripeCashPeriodSummary = {
  collected: number;
  paidInvoices: number;
  payingCustomers: number;
  averageInvoiceValue: number;
};

export type StripeFinancialOverview = {
  available: boolean;
  currency: string;
  generatedAt: string;
  thisMonth: StripeCashPeriodSummary;
  lastMonth: StripeCashPeriodSummary;
  monthOverMonthChange: number | null;
  openPipeline: {
    amountOutstanding: number;
    openInvoices: number;
  };
  note: string;
  error?: string;
};

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toUnixTimestamp(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function listInvoices(
  stripe: ReturnType<typeof getStripe>,
  params: Stripe.InvoiceListParams
) {
  const invoices: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const page = await stripe.invoices.list({
      limit: 100,
      ...params,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    invoices.push(...page.data);

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) {
      break;
    }
  }

  return invoices;
}

function summarizePaidInvoices(invoices: Stripe.Invoice[]): StripeCashPeriodSummary {
  const customerIds = new Set<string>();
  const collectedCents = invoices.reduce((sum, invoice) => {
    if (typeof invoice.customer === "string" && invoice.customer.length > 0) {
      customerIds.add(invoice.customer);
    }

    return sum + (invoice.amount_paid || 0);
  }, 0);

  const collected = collectedCents / 100;

  return {
    collected,
    paidInvoices: invoices.length,
    payingCustomers: customerIds.size,
    averageInvoiceValue: invoices.length > 0 ? collected / invoices.length : 0,
  };
}

export async function getStripeFinancialOverview(): Promise<StripeFinancialOverview> {
  const zeroSummary: StripeCashPeriodSummary = {
    collected: 0,
    paidInvoices: 0,
    payingCustomers: 0,
    averageInvoiceValue: 0,
  };

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch (error) {
    return {
      available: false,
      currency: "USD",
      generatedAt: new Date().toISOString(),
      thisMonth: zeroSummary,
      lastMonth: zeroSummary,
      monthOverMonthChange: null,
      openPipeline: {
        amountOutstanding: 0,
        openInvoices: 0,
      },
      note: "Stripe cash metrics need a valid STRIPE_SECRET_KEY before they can be shown.",
      error: error instanceof Error ? error.message : "Stripe is not configured.",
    };
  }

  const now = new Date();
  const startOfThisMonth = getMonthStart(now);
  const startOfLastMonth = addMonths(startOfThisMonth, -1);
  const startOfNextMonth = addMonths(startOfThisMonth, 1);

  const [paidThisMonth, paidLastMonth, openInvoices] = await Promise.all([
    listInvoices(stripe, {
      status: "paid",
      created: {
        gte: toUnixTimestamp(startOfThisMonth),
        lt: toUnixTimestamp(startOfNextMonth),
      },
    }),
    listInvoices(stripe, {
      status: "paid",
      created: {
        gte: toUnixTimestamp(startOfLastMonth),
        lt: toUnixTimestamp(startOfThisMonth),
      },
    }),
    listInvoices(stripe, {
      status: "open",
    }),
  ]);

  const thisMonth = summarizePaidInvoices(paidThisMonth);
  const lastMonth = summarizePaidInvoices(paidLastMonth);
  const amountOutstanding =
    openInvoices.reduce((sum, invoice) => sum + (invoice.amount_remaining || 0), 0) / 100;
  const monthOverMonthChange =
    lastMonth.collected > 0
      ? (thisMonth.collected - lastMonth.collected) / lastMonth.collected
      : thisMonth.collected > 0
        ? 1
        : null;
  const currency =
    (paidThisMonth[0]?.currency || paidLastMonth[0]?.currency || openInvoices[0]?.currency || "usd").toUpperCase();

  return {
    available: true,
    currency,
    generatedAt: now.toISOString(),
    thisMonth,
    lastMonth,
    monthOverMonthChange,
    openPipeline: {
      amountOutstanding,
      openInvoices: openInvoices.length,
    },
    note: "Stripe cash metrics are computed from paid invoices this month and last month, plus currently open invoices.",
  };
}