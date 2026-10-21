import mongoose from "mongoose";

// Razorpay webhook events already handled (by x-razorpay-event-id), so a
// redelivered event is skipped. Razorpay retries for about a day; 30 days is plenty.
const webhookEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  event: String,
  receivedAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60
  }
});

const webhookEventModel = mongoose.model("WebhookEvent", webhookEventSchema);

export default webhookEventModel;
