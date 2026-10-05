import mongoose from "mongoose";
import aiUsageModel from "../models/aiUsage.model.js";

async function connectToDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to Database");

    // The usage counter's unique index changed from {user, day} to
    // {user, day, kind}; drop the old one so review counters can coexist.
    await aiUsageModel.syncIndexes();
  } catch (err) {
    console.log(err);
  }
}

export default connectToDB;
