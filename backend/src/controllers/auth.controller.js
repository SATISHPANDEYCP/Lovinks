import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

const MAX_PROFILE_PIC_SIZE_BYTES = 5 * 1024 * 1024;
const APP_ASSET_FOLDER = "lovinks";

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

    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        encryptionPublicKey: newUser.encryptionPublicKey,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
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

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      encryptionPublicKey: user.encryptionPublicKey,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
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
