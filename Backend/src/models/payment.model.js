import mongoose from "mongoose";

// One Razorpay payment (a subscription charge, or a failed attempt), kept as
// the user's billing history. Written from webhooks, so a retry updates it.
const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      required: true,
      unique: true
    },
    razorpaySubscriptionId: String,
    invoiceId: String,
    plan: String,
    amountInPaise: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: "INR"
    },
    // Razorpay's payment states: captured, failed, refunded, ...
    status: {
      type: String,
      required: true
    },
    method: String,
    paidAt: Date
  },
  { timestamps: true }
);

const paymentModel = mongoose.model("Payment", paymentSchema);

export default paymentModel;
