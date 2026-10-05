import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
  score: { type: Number, min: 0, max: 10, required: true },
  criteria: {
    structure: { type: Number, min: 1, max: 5 },
    specificity: { type: Number, min: 1, max: 5 },
    relevance: { type: Number, min: 1, max: 5 },
    clarity: { type: Number, min: 1, max: 5 }
  },
  verdict: String,
  strengths: [String],
  improvements: [String],
  strongerAnswer: String
}, {
  _id: false
});

// One practice answer to one question of one report, with its AI review.
const practiceAttemptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  report: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InterviewReport",
    required: true
  },
  kind: {
    type: String,
    enum: ["technical", "behavioral"],
    required: true
  },
  questionIndex: {
    type: Number,
    min: 0,
    required: true
  },
  answer: {
    type: String,
    maxlength: 4000,
    required: true
  },
  durationSeconds: {
    type: Number,
    min: 0
  },
  inputMode: {
    type: String,
    enum: ["typed", "voice"],
    default: "typed"
  },
  feedback: {
    type: feedbackSchema,
    required: true
  }
}, {
  timestamps: true
});

practiceAttemptSchema.index({ user: 1, report: 1, kind: 1, questionIndex: 1, createdAt: -1 });

const practiceAttemptModel = mongoose.model("PracticeAttempt", practiceAttemptSchema);

export default practiceAttemptModel;
