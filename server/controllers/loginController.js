// Login Controller
import crypto from "crypto";
import User from "../models/userModel.js";
import jwt from 'jsonwebtoken';
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { auth } from "../utils/firebase.js";
import cloudinary from "../utils/cloudinaryConfig.js";
import bcrypt from 'bcryptjs';

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
      role: 'guest',
      FCMToken: FCMToken || "",
      isVerified: true,
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
    const token = await generateTokenAndSetCookie(res, user);

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
  const { email, password } = req.body || {};

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and password required' });
    }

    // normalize input - can be email or username
    const rawInput = String(email).trim();
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Check if input is email (contains @) or username
    const isEmail = rawInput.includes('@');
    
    let user;
    if (isEmail) {
      // Search by email (case-insensitive)
      user = await User.findOne({ email: { $regex: `^${escapeRegExp(rawInput)}$`, $options: 'i' } }).select('+password');
    } else {
      // Search by username (case-insensitive)
      user = await User.findOne({ username: { $regex: `^${escapeRegExp(rawInput)}$`, $options: 'i' } }).select('+password');
    }

    if (!user) {
      console.warn(`Login failed — user not found for: ${rawInput}`);
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // compare password — use model helper if present, otherwise bcrypt fallback
    let isPasswordValid = false;
    try {
      if (typeof user.comparePassword === 'function') {
        isPasswordValid = await user.comparePassword(password);
      } else {
        isPasswordValid = await bcrypt.compare(String(password), user.password || '');
      }
    } catch (e) {
      console.warn('Password compare error', e);
    }

    console.log(`Login attempt for ${user.email} — password match: ${isPasswordValid}`);
    console.log(`User isVerified status: ${user.isVerified}`);

    if (!isPasswordValid) {
      console.warn(`Password validation failed for: ${user.email}`);
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // In development, allow unverified users to login. In production, require verification.
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (!user.isVerified && !isDevelopment) {
      console.warn(`User not verified for: ${user.email}`);
      return res.status(400).json({ success: false, message: 'Email not verified. Please verify your email before logging in.' });
    }
    
    if (!user.isVerified && isDevelopment) {
      console.log(`Development mode: Allowing login for unverified user: ${user.email}`);
    }

    // Generate JWT and set cookie
    try {
      const token = await generateTokenAndSetCookie(res, user);
      console.log(`Token generated successfully for user: ${user.email}`);

      // Update last login date
      user.lastLogin = new Date();
      await user.save();

      res.status(200).json({
        success: true,
        message: (user.role === 'operator' || user.role === 'driOps') ? 'Logged in successfully as operator' : 'Logged in successfully as driver',
        token,
        user: { ...user._doc, password: undefined },
      });
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return res.status(500).json({ success: false, message: 'Error generating authentication token' });
    }
  } catch (error) {
    console.error('login error', error);
    res.status(400).json({ success: false, message: error.message || 'Login failed. Please try again.' });
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
        role: 'guest',
        FCMToken: FCMToken || "",
        isVerified: true,
      });

      await user.save();
    }

    const token = await generateTokenAndSetCookie(res, user);

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

// Refresh access token using refresh token cookie
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token provided' });

    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (err) {
      console.error('Refresh token verify failed', err);
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Ensure refresh token exists on user record
    const stored = (user.refreshTokens || []).find(r => r.token === refreshToken);
    if (!stored) return res.status(401).json({ success: false, message: 'Refresh token not recognised' });

    // Remove the used refresh token (rotation)
    user.refreshTokens = (user.refreshTokens || []).filter(r => r.token !== refreshToken);
    await user.save();

    // Issue a new access + refresh token pair
    const accessToken = await generateTokenAndSetCookie(res, user);

    return res.status(200).json({ success: true, token: accessToken });
  } catch (error) {
    console.error('refreshToken error', error);
    return res.status(500).json({ success: false, message: 'Could not refresh token' });
  }
};
