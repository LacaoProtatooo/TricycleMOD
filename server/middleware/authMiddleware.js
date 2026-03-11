import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import License from '../models/licenseModel.js';

// Helper: extract and validate token from request
const extractToken = (req) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // Treat "null", "undefined", or empty strings as missing
  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }
  return token;
};

// Helper: check token looks like a JWT (3 base64 segments separated by dots)
const isValidJwtFormat = (token) => {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
};

export const authUser = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  if (!isValidJwtFormat(token)) {
    return res.status(401).json({ success: false, message: 'Not authorized, malformed token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (error) {
    console.error(error);
    if (error && error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', expiredAt: error.expiredAt });
    }
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

// Alias for authUser - commonly used name for protecting routes
export const protect = authUser;

// driOps role can act as both driver and operator
const expandRole = (role) => {
  if (role === 'driOps') return ['driver', 'operator', 'driOps'];
  return [role];
};

// Role-based authorization middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, no user found' 
      });
    }
    
    const effectiveRoles = expandRole(req.user.role);
    if (!roles.some(role => effectiveRoles.includes(role))) {
      return res.status(403).json({ 
        success: false, 
        message: `Role '${req.user.role}' is not authorized to access this resource` 
      });
    }
    
    next();
  };
};

export const adminOnly = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  if (!isValidJwtFormat(token)) {
    return res.status(401).json({ success: false, message: 'Not authorized, malformed token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    // Check if user is an operator (admin) based on role
    if (req.user && (req.user.role === 'operator' || req.user.role === 'admin' || req.user.role === 'driOps')) {
      return next();
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized as an admin' });
    }
  } catch (error) {
    console.error(error);
    if (error && error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', expiredAt: error.expiredAt });
    }
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

export const operatorAndAdmin = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  if (!isValidJwtFormat(token)) {
    return res.status(401).json({ success: false, message: 'Not authorized, malformed token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    // Check if user is an operator or admin based on role
    if (req.user && (req.user.role === 'operator' || req.user.role === 'admin' || req.user.role === 'driOps')) {
      return next();
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized as an operator or admin' });
    }
  } catch (error) {
    console.error(error);
    if (error && error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', expiredAt: error.expiredAt });
    }
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

/**
 * Optional authentication middleware
 * Attaches user to req if token is valid, but doesn't fail if no token
 * Useful for endpoints that work for both guests and authenticated users
 */
export const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);

  if (token && isValidJwtFormat(token)) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Token invalid but we continue anyway for guest access
      console.log('Optional auth: Invalid token, continuing as guest');
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  next();
};

/**
 * Require verified user middleware
 * Only allows verified users (isVerified: true) to proceed
 * Must be used after protect middleware
 */
export const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no user found',
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Account not verified. Please verify your email to access this feature.',
      code: 'UNVERIFIED_USER',
    });
  }

  next();
};

/**
 * Optional verified user middleware
 * For tracking routes - requires verification if user is logged in
 * Guests (no token) can still proceed but are marked
 */
export const optionalVerified = async (req, res, next) => {
  const token = extractToken(req);

  if (token && isValidJwtFormat(token)) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      // If user is logged in, they must be verified
      if (req.user && !req.user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Account not verified. Please verify your email to use tracking.',
          code: 'UNVERIFIED_USER',
        });
      }
    } catch (error) {
      console.log('Optional verified: Invalid token, continuing as guest');
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
};

/**
 * Require driver license middleware
 * Only allows drivers with a verified uploaded license to proceed
 * Must be used after protect and authorize('driver') middleware
 */
export const requireDriverLicense = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no user found',
    });
  }

  if (req.user.role !== 'driver' && req.user.role !== 'driOps') {
    return res.status(403).json({
      success: false,
      message: 'This endpoint is for drivers only',
    });
  }

  try {
    // Check if driver has an uploaded license
    const license = await License.findOne({ userId: req.user._id });

    if (!license) {
      return res.status(403).json({
        success: false,
        message: 'You must upload a driver\'s license to accept bookings.',
        code: 'NO_LICENSE',
      });
    }

    if (!license.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your driver\'s license is pending verification. Please wait for approval.',
        code: 'LICENSE_PENDING',
      });
    }

    // Check if license is expired
    if (license.expiryDate && new Date(license.expiryDate) < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Your driver\'s license has expired. Please upload a valid license.',
        code: 'LICENSE_EXPIRED',
      });
    }

    // Attach license to request for use in controllers
    req.license = license;
    next();
  } catch (error) {
    console.error('Error checking driver license:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying driver license',
    });
  }
};
