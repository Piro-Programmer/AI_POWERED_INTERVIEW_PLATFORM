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
  }
});

const userModel = mongoose.model("users", userSchema);

export default userModel;
