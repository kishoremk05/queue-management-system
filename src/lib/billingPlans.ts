export type BillingPlanId = "starter" | "professional" | "enterprise";

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  amountMinor: number;
  currency: string;
  priceLabel: string;
  periodLabel: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

export function formatMoneyMinor(amountMinor: number, currency: string) {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(0)}`;
  }
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    amountMinor: 5000,
    currency: "USD",
    priceLabel: formatMoneyMinor(5000, "USD"),
    periodLabel: "/month",
    description: "Perfect for small businesses with a single location.",
    features: [
      "1 service counter",
      "Up to 3 services",
      "Basic queue display",
      "Token generation",
      "Email support",
    ],
    cta: "Choose Starter",
    highlighted: false,
  },
  {
    id: "professional",
    name: "Professional",
    amountMinor: 10000,
    currency: "USD",
    priceLabel: formatMoneyMinor(10000, "USD"),
    periodLabel: "/month",
    description: "For growing businesses needing advanced queue management.",
    features: [
      "Unlimited counters",
      "Unlimited services",
      "Priority queuing (VIP/Urgent)",
      "Audio announcements",
      "Analytics & reports",
      "Thermal ticket printing",
      "Staff management",
      "Priority support",
    ],
    cta: "Choose Professional",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    amountMinor: 15000,
    currency: "USD",
    priceLabel: formatMoneyMinor(15000, "USD"),
    periodLabel: "/month",
    description: "Multi-branch operations with full feature access.",
    features: [
      "Everything in Professional",
      "Multi-branch support",
      "Advanced queue alerts",
      "Custom branding",
      "API access",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Choose Enterprise",
    highlighted: false,
  },
];

export const BILLING_PLAN_BY_ID = BILLING_PLANS.reduce(
  (acc, plan) => {
    acc[plan.id] = plan;
    return acc;
  },
  {} as Record<BillingPlanId, BillingPlan>,
);

export const DEFAULT_PLAN_ID: BillingPlanId = "professional";
