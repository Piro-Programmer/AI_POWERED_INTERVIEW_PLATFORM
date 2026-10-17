import mongoose from "mongoose";

// A user's paid subscription, mirrored from the payment provider (Razorpay).
// One document per user: subscribing again reuses it. Payments keep the history.
const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true
    },
    plan: {
      type: String,
      enum: ["pro", "premium"],
      required: true
    },
    // Razorpay's own subscription states, kept as they are
    status: {
      type: String,
      enum: ["created", "authenticated", "active", "pending", "halted", "cancelled", "completed", "expired"],
      default: "created"
    },
    razorpaySubscriptionId: {
      type: String,
      unique: true,
      sparse: true
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    // cancelled by the user, but paid up until currentPeriodEnd
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    },
    // time of the newest provider event applied, so older ones are ignored
    lastEventAt: Date
  },
  { timestamps: true }
);

const subscriptionModel = mongoose.model("Subscription", subscriptionSchema);

export default subscriptionModel;
