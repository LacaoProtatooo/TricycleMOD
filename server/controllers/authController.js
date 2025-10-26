import User from "../models/userModel.js";
import cloudinary from "../utils/cloudinaryConfig.js";
import ErrorHandler from "../utils/errorHandler.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";

// Logout
export const logout = async (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error during logout" });
  }
};

// Verify user (for example after email verification or manual verification)
export const verifyUser = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "User ID is required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if (user.isVerified) {
      return res
        .status(200)
        .json({ success: true, message: "User already verified" });
    }

    user.isVerified = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User verified successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update profile (name, contact info, and optional Cloudinary image)
export const updateProfile = async (req, res) => {
  const { userId, username, firstname, lastname, email, address, phone } =
    req.body;
  const image = req.file;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "User ID is required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Update basic fields || to be updated
    user.firstname = firstname || user.firstname;
    user.lastname = lastname || user.lastname;

    // Handle address updates (support stringified JSON or object)
    user.address = address
      ? typeof address === "string"
        ? JSON.parse(address)
        : address
      : user.address;

    user.phone = phone || user.phone;

    // Handle image upload
    if (image) {
      // Delete old image if present
      if (user.image?.public_id) {
        await cloudinary.uploader.destroy(user.image.public_id);
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "user_image" },
          (error, result) => {
            if (error) {
              reject(new Error("Error uploading image to Cloudinary"));
            } else {
              resolve(result);
            }
          }
        );
        stream.end(image.buffer);
      });

      user.image = {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        ...user._doc,
        password: undefined,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again.",
    });
  }
};

// Fetch all users (admin or debug use)
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch users" });
  }
};

// Fetch single user by ID
export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).select("-password");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get currently logged-in user (using token middleware)
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Store or update Firebase FCM token
export const storeFCM = async (req, res) => {
  const { userId, FCMToken } = req.body;
  console.log("Received FCM token:", FCMToken, "User ID:", userId);

  if (!userId || !FCMToken) {
    return res
      .status(400)
      .json({ success: false, message: "User ID and FCM Token are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if (user.FCMToken === FCMToken) {
      return res.status(200).json({
        success: true,
        message: "FCM token already up to date",
      });
    }

    user.FCMToken = FCMToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: "FCM token stored successfully",
      FCMToken,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
