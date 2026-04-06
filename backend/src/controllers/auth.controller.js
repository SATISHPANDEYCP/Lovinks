import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import cloudinary from "../lib/cloudinary.js";
import { sendLoginOtpEmail } from "../lib/gmail.js";

const MAX_PROFILE_PIC_SIZE_BYTES = 5 * 1024 * 1024;
const APP_ASSET_FOLDER = "lovinks";
const OTP_VALIDITY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const hashValue = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const generateOtpCode = () => String(crypto.randomInt(100000, 999999));

const clearLoginOtpState = {
  loginOtpHash: "",
  loginOtpExpiresAt: null,
  loginOtpSessionHash: "",
  loginOtpAttempts: 0,
};

const getBase64SizeInBytes = (base64String) => {
  const base64Data = base64String.includes(",") ? base64String.split(",")[1] : base64String;
  const padding = (base64Data.match(/=+$/) || [""])[0].length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
};

const getCloudinaryPublicIdFromUrl = (url) => {
  if (!url || typeof url !== "string") return null;

  // Handles Cloudinary URLs like: .../upload/v123/folder/name.jpg
  const uploadMarker = "/upload/";
  const uploadIndex = url.indexOf(uploadMarker);
  if (uploadIndex === -1) return null;

  let publicIdWithVersion = url.slice(uploadIndex + uploadMarker.length);
  publicIdWithVersion = publicIdWithVersion.split("?")[0];

  // Remove optional transformation segments by taking the last occurrence of /v<number>/
  const versionMatch = publicIdWithVersion.match(/\/v\d+\//);
  if (versionMatch) {
    const versionSegment = versionMatch[0];
    const versionIndex = publicIdWithVersion.indexOf(versionSegment);
    publicIdWithVersion = publicIdWithVersion.slice(versionIndex + versionSegment.length);
  }

  const lastDotIndex = publicIdWithVersion.lastIndexOf(".");
  if (lastDotIndex === -1) return publicIdWithVersion;

  return publicIdWithVersion.slice(0, lastDotIndex);
};

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });

    if (user?.isEmailVerified) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOtpCode();
    const otpSessionToken = crypto.randomBytes(32).toString("hex");

    let newUser = user;

    if (!newUser) {
      newUser = new User({
        fullName,
        email,
        password: hashedPassword,
        isEmailVerified: false,
      });
    } else {
      newUser.fullName = fullName;
      newUser.password = hashedPassword;
      newUser.isEmailVerified = false;
    }

    newUser.loginOtpHash = hashValue(otp);
    newUser.loginOtpSessionHash = hashValue(otpSessionToken);
    newUser.loginOtpExpiresAt = new Date(Date.now() + OTP_VALIDITY_MS);
    newUser.loginOtpAttempts = 0;

    await newUser.save();

    try {
      await sendLoginOtpEmail({ to: newUser.email, otp });
    } catch (error) {
      await User.findByIdAndUpdate(newUser._id, { $set: clearLoginOtpState });
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    res.status(201).json({
      requiresOtp: true,
      email: newUser.email,
      otpSessionToken,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isEmailVerified) {
      const otp = generateOtpCode();
      const otpSessionToken = crypto.randomBytes(32).toString("hex");

      user.loginOtpHash = hashValue(otp);
      user.loginOtpSessionHash = hashValue(otpSessionToken);
      user.loginOtpExpiresAt = new Date(Date.now() + OTP_VALIDITY_MS);
      user.loginOtpAttempts = 0;
      await user.save();

      try {
        await sendLoginOtpEmail({ to: user.email, otp });
      } catch (error) {
        await User.findByIdAndUpdate(user._id, { $set: clearLoginOtpState });
        return res.status(500).json({ message: "Failed to send OTP email" });
      }

      return res.status(200).json({
        requiresOtp: true,
        email: user.email,
        otpSessionToken,
        message: "Email verification OTP sent",
      });
    }

    const otp = generateOtpCode();
    const otpSessionToken = crypto.randomBytes(32).toString("hex");

    user.loginOtpHash = hashValue(otp);
    user.loginOtpSessionHash = hashValue(otpSessionToken);
    user.loginOtpExpiresAt = new Date(Date.now() + OTP_VALIDITY_MS);
    user.loginOtpAttempts = 0;

    await user.save();

    try {
      await sendLoginOtpEmail({ to: user.email, otp });
    } catch (error) {
      await User.findByIdAndUpdate(user._id, { $set: clearLoginOtpState });
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    res.status(200).json({
      requiresOtp: true,
      email: user.email,
      otpSessionToken,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const verifyLoginOtp = async (req, res) => {
  const { email, otp, otpSessionToken } = req.body;

  try {
    if (!email || !otp || !otpSessionToken) {
      return res.status(400).json({ message: "Email, OTP and session token are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid verification request" });
    }

    if (!user.loginOtpHash || !user.loginOtpSessionHash || !user.loginOtpExpiresAt) {
      return res.status(400).json({ message: "No active OTP request found" });
    }

    if (user.loginOtpExpiresAt.getTime() < Date.now()) {
      await User.findByIdAndUpdate(user._id, { $set: clearLoginOtpState });
      return res.status(400).json({ message: "OTP expired. Please login again." });
    }

    if (user.loginOtpAttempts >= OTP_MAX_ATTEMPTS) {
      await User.findByIdAndUpdate(user._id, { $set: clearLoginOtpState });
      return res.status(429).json({ message: "Too many invalid attempts. Please login again." });
    }

    const isSessionValid = hashValue(otpSessionToken) === user.loginOtpSessionHash;
    const isOtpValid = hashValue(otp) === user.loginOtpHash;

    if (!isSessionValid || !isOtpValid) {
      user.loginOtpAttempts += 1;

      if (user.loginOtpAttempts >= OTP_MAX_ATTEMPTS) {
        user.loginOtpHash = "";
        user.loginOtpSessionHash = "";
        user.loginOtpExpiresAt = null;
        user.loginOtpAttempts = 0;
      }

      await user.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.loginOtpHash = "";
    user.loginOtpSessionHash = "";
    user.loginOtpExpiresAt = null;
    user.loginOtpAttempts = 0;
    user.isEmailVerified = true;
    await user.save();

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      encryptionPublicKey: user.encryptionPublicKey,
    });
  } catch (error) {
    console.log("Error in verifyLoginOtp controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const resendLoginOtp = async (req, res) => {
  const { email, otpSessionToken } = req.body;

  try {
    if (!email || !otpSessionToken) {
      return res.status(400).json({ message: "Email and session token are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid resend request" });
    }

    if (!user.loginOtpSessionHash || hashValue(otpSessionToken) !== user.loginOtpSessionHash) {
      return res.status(400).json({ message: "Session expired. Please login again." });
    }

    const otp = generateOtpCode();
    user.loginOtpHash = hashValue(otp);
    user.loginOtpExpiresAt = new Date(Date.now() + OTP_VALIDITY_MS);
    user.loginOtpAttempts = 0;
    await user.save();

    try {
      await sendLoginOtpEmail({ to: user.email, otp });
    } catch (error) {
      return res.status(500).json({ message: "Failed to resend OTP email" });
    }

    res.status(200).json({ message: "OTP resent to your email" });
  } catch (error) {
    console.log("Error in resendLoginOtp controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    const imageSizeBytes = getBase64SizeInBytes(profilePic);
    if (imageSizeBytes > MAX_PROFILE_PIC_SIZE_BYTES) {
      return res.status(400).json({ message: "Profile pic must be 5MB or smaller" });
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic, {
      folder: APP_ASSET_FOLDER,
      public_id: `profile-${userId}-${Date.now()}`,
      resource_type: "image",
    });

    if (currentUser.profilePic) {
      const oldPublicId = getCloudinaryPublicIdFromUrl(currentUser.profilePic);
      if (oldPublicId) {
        try {
          await cloudinary.uploader.destroy(oldPublicId);
        } catch (destroyError) {
          console.log("Failed to delete old profile pic:", destroyError.message);
        }
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const destroyCloudinaryAssetByPublicId = async (publicId) => {
  // Message uploads can be image/video/raw depending on file type.
  const resourceTypes = ["image", "video", "raw"];

  for (const resourceType of resourceTypes) {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
      return;
    } catch (error) {
      // Try next resource type.
    }
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Password is required to delete account" });
    }

    const existingUser = await User.findById(userId).select("profilePic password");
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const relatedMessages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    }).select("image fileUrl");

    const publicIdsToDelete = new Set();

    const addPublicIdFromUrl = (url) => {
      const publicId = getCloudinaryPublicIdFromUrl(url);
      if (publicId) {
        publicIdsToDelete.add(publicId);
      }
    };

    addPublicIdFromUrl(existingUser.profilePic);
    relatedMessages.forEach((message) => {
      addPublicIdFromUrl(message.image);
      addPublicIdFromUrl(message.fileUrl);
    });

    await Promise.all(
      Array.from(publicIdsToDelete).map(async (publicId) => {
        try {
          await destroyCloudinaryAssetByPublicId(publicId);
        } catch (error) {
          console.log("Failed to delete cloud asset during account removal:", error.message);
        }
      })
    );

    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    await User.findByIdAndDelete(userId);

    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.log("Error in deleteAccount controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateEncryptionPublicKey = async (req, res) => {
  try {
    const { encryptionPublicKey } = req.body;
    const userId = req.user._id;

    if (!encryptionPublicKey || typeof encryptionPublicKey !== "string") {
      return res.status(400).json({ message: "Valid encryption public key is required" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { encryptionPublicKey },
      { new: true }
    ).select("_id fullName email profilePic encryptionPublicKey");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in updateEncryptionPublicKey controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
