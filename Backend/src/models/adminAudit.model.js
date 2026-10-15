import mongoose from "mongoose";

// Every admin action, so there is a record of who did what to whom.
const adminAuditSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  adminName: String,
  action: { type: String, required: true }, // e.g. "delete-user"
  target: { type: mongoose.Schema.Types.ObjectId },
  // a snapshot, since the target may no longer exist
  details: { type: Object, default: {} }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

adminAuditSchema.index({ createdAt: -1 });

const adminAuditModel = mongoose.model("AdminAudit", adminAuditSchema);

export default adminAuditModel;
