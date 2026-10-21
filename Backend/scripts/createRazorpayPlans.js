// One-off: create the paid plans in Razorpay and print the env lines to set.
//   cd Backend && node scripts/createRazorpayPlans.js
// Uses RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET from .env. Refuses live keys
// unless --live is passed, so test-mode plans are the default.
import "dotenv/config";
import Razorpay from "razorpay";
import { PAID_PLAN_IDS, getPlan } from "../src/config/plans.js";

const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = process.env;
if (!keyId || !keySecret) {
  console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Backend/.env first.");
  process.exit(1);
}
if (!keyId.startsWith("rzp_test_") && !process.argv.includes("--live")) {
  console.error("These aren't test keys (rzp_test_...). Pass --live to create plans in live mode.");
  process.exit(1);
}

const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

for (const id of PAID_PLAN_IDS) {
  const plan = getPlan(id);
  const created = await razorpay.plans.create({
    period: "monthly",
    interval: 1,
    item: { name: plan.name, amount: plan.priceInPaise, currency: plan.currency, description: plan.features.join(", ") },
    notes: { plan: id }
  });
  console.log(`${plan.razorpayPlanEnv}=${created.id}`);
}
