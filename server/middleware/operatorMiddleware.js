// Middleware to check if user is an operator
export const operatorOnly = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, please login',
      });
    }

    if (req.user.role !== 'operator') {
      return res.status(403).json({
        success: false,
        message: 'Only operators can access this resource',
      });
    }

    next();
  } catch (error) {
    console.error('Error in operator middleware:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};


