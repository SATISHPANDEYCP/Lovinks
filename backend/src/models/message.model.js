import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    encryptedText: {
      type: String,
      default: "",
    },
    encryptionIv: {
      type: String,
      default: "",
    },
    encryptedKeyForReceiver: {
      type: String,
      default: "",
    },
    encryptedKeyForSender: {
      type: String,
      default: "",
    },
    encryptionVersion: {
      type: String,
      default: "",
    },
    encryptedFileData: {
      type: String,
      default: "",
    },
    fileEncryptionIv: {
      type: String,
      default: "",
    },
    encryptedFileKeyForReceiver: {
      type: String,
      default: "",
    },
    encryptedFileKeyForSender: {
      type: String,
      default: "",
    },
    fileEncryptionVersion: {
      type: String,
      default: "",
    },
    image: {
      type: String,
    },
    fileUrl: {
      type: String,
      default: "",
    },
    fileType: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
