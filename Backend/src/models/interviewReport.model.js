import mongoose from 'mongoose'


const technicalQuestions = new mongoose.Schema({
  question: {
    type: String,
    required: [true, "Technical question is required"]
  },
  intention:{
    type: String,
    required: [true, "Intention is required"]
  },
  answer:{
    type: String,
    required: [true, "Answer is required"]
  }
},{
  _id: false
})

const behavioralQuestions = new mongoose.Schema({
  question: {
    type: String,
    required: [true, "Behavioral question is required"]
  },
  intention:{
    type: String,
    required: [true, "Intention is required"]
  },
  answer:{
    type: String,
    required: [true, "Answer is required"]
  }
},{
  _id: false
})

const skillGapSchema = new mongoose.Schema({
  skill: {
    type: String,
    required: [true, "Skill is required"]
  },
  severity:{
    type: String,
    enum: ["low", "medium", "high"],
    required: [true, "Severity is required"]
  }
},{
  _id: false
})

const preparationPlanSchema = new mongoose.Schema({
  day: {
    type: Number,
    required: [true, "Day is required"]
  },
  focus:{
    type: String,
    required: [true, "focus is required"]
  },
  tasks:[{
    type: String,
    required: [true, "Task is required"]
  }]

})

const interviewReportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Report title is required"],
    default: "Interview Report"
  },
  jobDescription:{
    type: String,
    required: [true, "Job description is required"]

  },
  // No longer saved (privacy); kept in the schema so the startup cleanup can
  // $unset it from reports created before that change.
  resume: {
    type: String,
    select: false
  },
  selfDescription:{
    type: String,
  },
  matchScore:{
    type: Number,
    min: 0,
    max:100,
  },
  technicalQuestions:[technicalQuestions],
  behavioralQuestions: [behavioralQuestions],
  skillGaps: [skillGapSchema],
  preparationPlan: [preparationPlanSchema],
  // Ticked plan tasks as "dayIndex-taskIndex", e.g. "1-0" = first task of day 2
  completedTasks: {
    type: [String],
    default: []
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref:"users"
  }
}, {
  timestamps: true
})


const interviewReportModel = mongoose.model("InterviewReport", interviewReportSchema)

export default interviewReportModel;
