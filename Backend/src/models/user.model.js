import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: [true, "username already taken"],
    required: true,
  },

  email: {
    type: String,
    unique: [true, "Account already exists with this email address"],
    required: true,
  },

  password: {
    type: String,
    required: true,
  },

  // Sessions (JWTs) issued before this moment are no longer accepted
  passwordChangedAt: {
    type: Date
  },

  // "admin" is never set through the API: set it by hand in the database,
  // e.g. db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  }
});

const userModel = mongoose.model("users", userSchema);

export default userModel;
