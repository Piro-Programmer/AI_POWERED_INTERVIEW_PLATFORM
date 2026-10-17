import userModel from "../models/user.model.js";
import interviewReportModel from "../models/interviewReport.model.js";
import practiceAttemptModel from "../models/practiceAttempt.model.js";
import aiUsageModel from "../models/aiUsage.model.js";
import subscriptionModel from "../models/subscription.model.js";

/**
 * Delete a user and everything stored for them: reports (and with them any
 * share links), practice answers and usage counters.
 * Data first, the user last: if anything fails, the account still exists and
 * deleting again finishes the job. Their sessions stop working because
 * authUser rejects tokens of users that no longer exist.
 */
export async function deleteUserAndData(userId) {
  await Promise.all([
    interviewReportModel.deleteMany({ user: userId }),
    practiceAttemptModel.deleteMany({ user: userId }),
    aiUsageModel.deleteMany({ user: userId }),
    subscriptionModel.deleteMany({ user: userId })
  ]);
  await userModel.deleteOne({ _id: userId });
}
