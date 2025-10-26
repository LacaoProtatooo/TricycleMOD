// Login Controller
import crypto from "crypto";
import User from "../models/userModel.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { auth } from "../utils/firebase.js";
import cloudinary from "../utils/cloudinaryConfig.js";

// Signup 
export const signup = async (req, res) => {
  const {
    username,
    firstname,
    lastname,
    email,
    password,
    address,
    phone,
    image,
    role,
    FCMToken,
  } = req.body;

  try {
    // Validate required fields
    if (!username || !firstname || !lastname || !email || !password) {
      throw new Error("All fields are required");
    }

    // Check if user already exists
    const userAlreadyExists = await User.findOne({ email });
    if (userAlreadyExists) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const userData = {
      username,
      firstname,
      lastname,
      email,
      password, // plain text, will be hashed by pre-save hook
      address: address || {},
      phone: phone || "",
      role: role || "driver", // defaults to driver
      FCMToken: FCMToken || "",
      isVerified: false, // set verified upon signup
      verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    // Handle image upload (optional)
    if (req.file) {
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
        stream.end(req.file.buffer);
      });
      userData.image = {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
      };
    } else if (image && image.url) {
      userData.image = image;
    } else {
      userData.image = {};
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Generate JWT & set cookie
    const token = generateTokenAndSetCookie(res, user);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      token,
      user: {
        ...user._doc,
        password: undefined,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Login
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Email not verified" });
    }

    // Generate JWT and set cookie
    const token = generateTokenAndSetCookie(res, user);

    res.status(200).json({
      success: true,
      message:
        user.role === "operator"
          ? "Logged in successfully as operator"
          : "Logged in successfully as driver",
      token,
      user: {
        ...user._doc,
        password: undefined,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Google Login
export const googlelogin = async (req, res) => {
  const { firebaseIdToken, FCMToken } = req.body;

  try {
    const decodedToken = await auth.verifyIdToken(firebaseIdToken);
    const email = decodedToken.email;
    const firebaseUid = decodedToken.uid;

    let user = await User.findOne({ email });

    if (!user) {
      const fullName = decodedToken.name || "Google User";
      const [firstname, lastname = ""] = fullName.split(" ", 2);

      // Ensure unique username
      let username = fullName.replace(/\s+/g, "_").toLowerCase();
      let usernameExists = await User.findOne({ username });
      while (usernameExists) {
        username = `${username}_${crypto.randomBytes(3).toString("hex")}`;
        usernameExists = await User.findOne({ username });
      }

      // Generate random password (schema hashes automatically)
      const randomPassword = crypto.randomBytes(8).toString("hex");

      user = new User({
        username,
        firstname,
        lastname,
        email,
        password: randomPassword,
        firebaseUid,
        address: {},
        role: "driver",
        FCMToken: FCMToken || "",
        isVerified: true,
      });

      await user.save();
    }

    const token = generateTokenAndSetCookie(res, user);

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      token,
      user: {
        ...user._doc,
        password: undefined,
      },
    });
  } catch (error) {
    console.error("Error verifying Google ID token:", error);
    res
      .status(400)
      .json({ success: false, message: "Invalid Google ID token" });
  }
};
