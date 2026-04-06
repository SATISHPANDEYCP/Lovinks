import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    encryptionPublicKey: {
      type: String,
      default: "",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    loginOtpHash: {
      type: String,
      default: "",
    },
    loginOtpExpiresAt: {
      type: Date,
      default: null,
    },
    loginOtpSessionHash: {
      type: String,
      default: "",
    },
    loginOtpAttempts: {
      type: Number,
      default: 0,
    },
    passwordResetOtpHash: {
      type: String,
      default: "",
    },
    passwordResetOtpExpiresAt: {
      type: Date,
      default: null,
    },
    passwordResetOtpSessionHash: {
      type: String,
      default: "",
    },
    passwordResetOtpAttempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
