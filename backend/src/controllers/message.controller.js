import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const APP_ASSET_FOLDER = "lovinks";
const MAX_MESSAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["application/pdf"];

const getBase64SizeInBytes = (base64String) => {
  const base64Data = base64String.includes(",") ? base64String.split(",")[1] : base64String;
  const padding = (base64Data.match(/=+$/) || [""])[0].length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
};

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } })
      .select("-password")
      .lean();

    const usersWithLastMessage = await Promise.all(
      filteredUsers.map(async (user) => {
        const lastMessage = await Message.findOne({
          $and: [
            {
              $or: [
                { senderId: loggedInUserId, receiverId: user._id },
                { senderId: user._id, receiverId: loggedInUserId },
              ],
            },
            { deletedFor: { $nin: [loggedInUserId] } },
          ],
        })
          .sort({ createdAt: -1 })
          .select(
            "text encryptedText encryptionIv encryptedKeyForReceiver encryptedKeysForReceiverDevices encryptedKeyForSender encryptedKeysForSenderDevices image createdAt senderId receiverId"
          )
          .lean();

        const unreadCount = await Message.countDocuments({
          senderId: user._id,
          receiverId: loggedInUserId,
          status: { $ne: "read" },
          deletedFor: { $nin: [loggedInUserId] },
        });

        return {
          ...user,
          lastMessage: lastMessage || null,
          unreadCount,
        };
      })
    );

    res.status(200).json(usersWithLastMessage);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const readAt = new Date();
    const unreadMessages = await Message.find({
      senderId: userToChatId,
      receiverId: myId,
      status: { $ne: "read" },
      deletedFor: { $nin: [myId] },
    })
      .sort({ createdAt: 1 })
      .select("_id");

    const firstUnreadMessageId = unreadMessages.length ? unreadMessages[0]._id : null;

    if (unreadMessages.length) {
      const unreadMessageIds = unreadMessages.map((message) => message._id);

      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        {
          $set: {
            status: "read",
            readAt,
            deliveredAt: readAt,
          },
        }
      );

      const senderSocketId = getReceiverSocketId(userToChatId);
      if (senderSocketId) {
        const serializedUnreadMessageIds = unreadMessageIds.map((id) => id.toString());
        io.to(senderSocketId).emit("messageStatusUpdated", {
          messageIds: serializedUnreadMessageIds,
          status: "read",
          readAt,
        });
      }
    }

    const messages = await Message.find({
      $and: [
        {
          $or: [
            { senderId: myId, receiverId: userToChatId },
            { senderId: userToChatId, receiverId: myId },
          ],
        },
        { deletedFor: { $nin: [myId] } },
      ],
    });

    res.status(200).json({
      messages,
      firstUnreadMessageId,
    });
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const {
      text,
      image,
      file,
      fileName,
      fileType,
      encryptedText,
      encryptionIv,
      encryptedKeyForReceiver,
      encryptedKeyForSender,
      encryptedKeysForReceiverDevices,
      encryptedKeysForSenderDevices,
      encryptionVersion,
      encryptedFileData,
      fileEncryptionIv,
      encryptedFileKeyForReceiver,
      encryptedFileKeyForSender,
      encryptedFileKeysForReceiverDevices,
      encryptedFileKeysForSenderDevices,
      fileEncryptionVersion,
    } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    let fileUrl;
    let resolvedFileType = "";
    let resolvedFileName = "";

    if (file) {
      const fileSizeBytes = getBase64SizeInBytes(file);
      if (fileSizeBytes > MAX_MESSAGE_FILE_SIZE_BYTES) {
        return res.status(400).json({ message: "File must be 10MB or smaller" });
      }

      const normalizedFileType = typeof fileType === "string" ? fileType : "";
      const isAllowedAttachment =
        normalizedFileType.startsWith("image/") || ALLOWED_ATTACHMENT_TYPES.includes(normalizedFileType);

      if (!isAllowedAttachment) {
        return res.status(400).json({ message: "Only image and PDF files are allowed" });
      }

      const uploadResponse = await cloudinary.uploader.upload(file, {
        folder: APP_ASSET_FOLDER,
        public_id: `message-${senderId}-${Date.now()}`,
        resource_type: "auto",
      });
      fileUrl = uploadResponse.secure_url;
      resolvedFileType = normalizedFileType;
      resolvedFileName = typeof fileName === "string" ? fileName : "";

      if (resolvedFileType.startsWith("image/")) {
        imageUrl = fileUrl;
      }
    }

    if (image) {
      const imageSizeBytes = getBase64SizeInBytes(image);
      if (imageSizeBytes > MAX_MESSAGE_FILE_SIZE_BYTES) {
        return res.status(400).json({ message: "File must be 10MB or smaller" });
      }

      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image, {
        folder: APP_ASSET_FOLDER,
        public_id: `message-${senderId}-${Date.now()}`,
        resource_type: "image",
      });
      imageUrl = uploadResponse.secure_url;
    }

    const receiverSocketId = getReceiverSocketId(receiverId);
    const isDelivered = Boolean(receiverSocketId);

    const newMessage = new Message({
      senderId,
      receiverId,
      text: typeof text === "string" ? text : "",
      encryptedText: typeof encryptedText === "string" ? encryptedText : "",
      encryptionIv: typeof encryptionIv === "string" ? encryptionIv : "",
      encryptedKeyForReceiver: typeof encryptedKeyForReceiver === "string" ? encryptedKeyForReceiver : "",
      encryptedKeyForSender: typeof encryptedKeyForSender === "string" ? encryptedKeyForSender : "",
      encryptedKeysForReceiverDevices:
        encryptedKeysForReceiverDevices && typeof encryptedKeysForReceiverDevices === "object"
          ? encryptedKeysForReceiverDevices
          : {},
      encryptedKeysForSenderDevices:
        encryptedKeysForSenderDevices && typeof encryptedKeysForSenderDevices === "object"
          ? encryptedKeysForSenderDevices
          : {},
      encryptionVersion: typeof encryptionVersion === "string" ? encryptionVersion : "",
      encryptedFileData: typeof encryptedFileData === "string" ? encryptedFileData : "",
      fileEncryptionIv: typeof fileEncryptionIv === "string" ? fileEncryptionIv : "",
      encryptedFileKeyForReceiver:
        typeof encryptedFileKeyForReceiver === "string" ? encryptedFileKeyForReceiver : "",
      encryptedFileKeyForSender:
        typeof encryptedFileKeyForSender === "string" ? encryptedFileKeyForSender : "",
      encryptedFileKeysForReceiverDevices:
        encryptedFileKeysForReceiverDevices && typeof encryptedFileKeysForReceiverDevices === "object"
          ? encryptedFileKeysForReceiverDevices
          : {},
      encryptedFileKeysForSenderDevices:
        encryptedFileKeysForSenderDevices && typeof encryptedFileKeysForSenderDevices === "object"
          ? encryptedFileKeysForSenderDevices
          : {},
      fileEncryptionVersion: typeof fileEncryptionVersion === "string" ? fileEncryptionVersion : "",
      image: imageUrl,
      fileUrl,
      fileType:
        resolvedFileType ||
        (typeof fileType === "string" ? fileType : "") ||
        (typeof encryptedFileData === "string" && encryptedFileData ? "application/octet-stream" : ""),
      fileName: resolvedFileName || (typeof fileName === "string" ? fileName : ""),
      status: isDelivered ? "delivered" : "sent",
      deliveredAt: isDelivered ? new Date() : null,
    });

    await newMessage.save();

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const requesterId = req.user._id;
    const { scope = "everyone" } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const isParticipant =
      message.senderId.toString() === requesterId.toString() ||
      message.receiverId.toString() === requesterId.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "You are not allowed to delete this message" });
    }

    if (scope === "me") {
      await Message.updateOne(
        { _id: messageId },
        {
          $addToSet: {
            deletedFor: requesterId,
          },
        }
      );

      const updatedMessage = await Message.findById(messageId).select("deletedFor senderId receiverId");
      if (updatedMessage) {
        const participantIds = [
          updatedMessage.senderId.toString(),
          updatedMessage.receiverId.toString(),
        ];
        const deletedForSet = new Set(updatedMessage.deletedFor.map((id) => id.toString()));
        const isDeletedForBoth = participantIds.every((id) => deletedForSet.has(id));

        if (isDeletedForBoth) {
          await Message.deleteOne({ _id: messageId });
        }
      }

      return res.status(200).json({
        message: "Message deleted for you",
        messageId: message._id.toString(),
        scope: "me",
      });
    }

    if (scope !== "everyone") {
      return res.status(400).json({ message: "Invalid delete scope" });
    }

    if (message.senderId.toString() !== requesterId.toString()) {
      return res.status(403).json({ message: "Only sender can delete for everyone" });
    }

    await Message.deleteOne({ _id: messageId });

    const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", {
        messageId: message._id.toString(),
      });
    }

    res.status(200).json({
      message: "Message deleted successfully",
      messageId: message._id.toString(),
      scope: "everyone",
    });
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
