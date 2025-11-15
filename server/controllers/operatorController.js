import Tricycle from '../models/tricycleModel.js';
import User from '../models/userModel.js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// ==================== GET OPERATOR OVERVIEW ====================
// Get all tricycles and drivers for the logged-in operator
export const getOperatorOverview = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // User is already verified as operator by middleware

    // Get all tricycles owned by this operator
    const tricycles = await Tricycle.find({ operator: operatorId })
      .populate('driver', 'firstname lastname username email phone image')
      .populate('operator', 'firstname lastname username email')
      .sort({ createdAt: -1 });

    // Get all available drivers (drivers not assigned to any tricycle)
    const assignedDriverIds = tricycles
      .map((t) => t.driver)
      .filter((driver) => driver !== null && driver !== undefined)
      .map((driver) => (driver._id ? driver._id.toString() : driver.toString()));

    const availableDrivers = await User.find({
      role: 'driver',
      _id: { $nin: assignedDriverIds },
    }).select('firstname lastname username email phone image rating numReviews');

    // Get all drivers (for reference)
    const allDrivers = await User.find({ role: 'driver' }).select(
      'firstname lastname username email phone image rating numReviews'
    );

    // Format tricycles with driver info
    const formattedTricycles = tricycles.map((tricycle) => ({
      id: tricycle._id,
      plate: tricycle.plateNumber,
      model: tricycle.model,
      driverId: tricycle.driver?._id || null,
      driverName: tricycle.driver
        ? `${tricycle.driver.firstname} ${tricycle.driver.lastname}`
        : 'Unassigned',
      driver: tricycle.driver || null,
      status: tricycle.status,
      images: tricycle.images || [],
      createdAt: tricycle.createdAt,
      updatedAt: tricycle.updatedAt,
    }));

    res.status(200).json({
      success: true,
      tricycles: formattedTricycles,
      availableDrivers,
      allDrivers,
      drivers: allDrivers, // For backward compatibility
    });
  } catch (error) {
    console.error('Error fetching operator overview:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ==================== GET OPERATOR'S TRICYCLES ====================
export const getOperatorTricycles = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // User is already verified as operator by middleware
    const tricycles = await Tricycle.find({ operator: operatorId })
      .populate('driver', 'firstname lastname username email phone image')
      .populate('operator', 'firstname lastname username email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tricycles.length,
      data: tricycles,
    });
  } catch (error) {
    console.error('Error fetching operator tricycles:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// ==================== GET AVAILABLE DRIVERS ====================
export const getAvailableDrivers = async (req, res) => {
  try {
    const operatorId = req.user.id;

    // User is already verified as operator by middleware
    // Get all tricycles to find assigned drivers
    const allTricycles = await Tricycle.find({});
    const assignedDriverIds = allTricycles
      .map((t) => t.driver)
      .filter((driver) => driver !== null && driver !== undefined)
      .map((driver) => (driver._id ? driver._id.toString() : driver.toString()));

    // Get drivers not assigned to any tricycle
    const availableDrivers = await User.find({
      role: 'driver',
      _id: { $nin: assignedDriverIds },
    }).select('firstname lastname username email phone image rating numReviews');

    res.status(200).json({
      success: true,
      count: availableDrivers.length,
      data: availableDrivers,
    });
  } catch (error) {
    console.error('Error fetching available drivers:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// ==================== ASSIGN DRIVER TO TRICYCLE ====================
export const assignDriverToTricycle = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { tricycleId, driverId } = req.body;

    // User is already verified as operator by middleware
    if (!tricycleId || !driverId) {
      return res.status(400).json({
        success: false,
        message: 'Tricycle ID and Driver ID are required',
      });
    }

    // Verify tricycle exists and belongs to operator
    const tricycle = await Tricycle.findById(tricycleId);
    if (!tricycle) {
      return res.status(404).json({
        success: false,
        message: 'Tricycle not found',
      });
    }

    if (tricycle.operator.toString() !== operatorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only assign drivers to your own tricycles',
      });
    }

    // Verify driver exists and is a driver
    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    if (driver.role !== 'driver') {
      return res.status(400).json({
        success: false,
        message: 'User is not a driver',
      });
    }

    // Check if driver is already assigned to another tricycle
    const existingAssignment = await Tricycle.findOne({
      driver: driverId,
      _id: { $ne: tricycleId },
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Driver is already assigned to another tricycle',
      });
    }

    // Assign driver to tricycle
    tricycle.driver = driverId;
    await tricycle.save();

    // Populate and return updated tricycle
    const updatedTricycle = await Tricycle.findById(tricycleId)
      .populate('driver', 'firstname lastname username email phone image')
      .populate('operator', 'firstname lastname username email');

    res.status(200).json({
      success: true,
      message: 'Driver assigned successfully',
      data: updatedTricycle,
    });
  } catch (error) {
    console.error('Error assigning driver:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ==================== UNASSIGN DRIVER FROM TRICYCLE ====================
export const unassignDriverFromTricycle = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { tricycleId } = req.body;

    // User is already verified as operator by middleware
    if (!tricycleId) {
      return res.status(400).json({
        success: false,
        message: 'Tricycle ID is required',
      });
    }

    // Verify tricycle exists and belongs to operator
    const tricycle = await Tricycle.findById(tricycleId);
    if (!tricycle) {
      return res.status(404).json({
        success: false,
        message: 'Tricycle not found',
      });
    }

    if (tricycle.operator.toString() !== operatorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only unassign drivers from your own tricycles',
      });
    }

    // Unassign driver
    tricycle.driver = null;
    await tricycle.save();

    // Populate and return updated tricycle
    const updatedTricycle = await Tricycle.findById(tricycleId)
      .populate('operator', 'firstname lastname username email');

    res.status(200).json({
      success: true,
      message: 'Driver unassigned successfully',
      data: updatedTricycle,
    });
  } catch (error) {
    console.error('Error unassigning driver:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ==================== GET DRIVER DETAILS ====================
export const getDriverDetails = async (req, res) => {
  try {
    const operatorId = req.user.id;
    const { driverId } = req.params;

    // User is already verified as operator by middleware
    const driver = await User.findById(driverId).select('-password');
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    if (driver.role !== 'driver') {
      return res.status(400).json({
        success: false,
        message: 'User is not a driver',
      });
    }

    // Get tricycle assigned to this driver (if any)
    const tricycle = await Tricycle.findOne({ driver: driverId })
      .populate('operator', 'firstname lastname username email');

    res.status(200).json({
      success: true,
      driver,
      tricycle: tricycle || null,
    });
  } catch (error) {
    console.error('Error fetching driver details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// ==================== SCAN RECEIPT (PaddleOCR via Python) ====================
export const scanReceipt = async (req, res) => {
  try {
    // multer stores file buffer in req.file (memoryStorage)
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    // Create temporary file
    const uploadsDir = path.join(process.cwd(), 'tmp_uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `receipt-${Date.now()}-${Math.random().toString(36).slice(2,8)}${path.extname(req.file.originalname) || '.jpg'}`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    // Resolve python script path robustly (avoid duplicated folder names)
    const scriptCandidates = [
      path.join(process.cwd(), 'ocr', 'paddle_scan.py'),
      path.join(process.cwd(), 'server', 'ocr', 'paddle_scan.py'),
      path.join(process.cwd(), '..', 'server', 'ocr', 'paddle_scan.py'),
    ];

    let scriptPath = null;
    for (const p of scriptCandidates) {
      if (fs.existsSync(p)) {
        scriptPath = p;
        break;
      }
    }

    if (!scriptPath) {
      // cleanup temp file
      try { fs.unlinkSync(filepath); } catch (e) { /* ignore */ }
      console.error('PaddleOCR script not found. Tried:', scriptCandidates);
      return res.status(500).json({ success: false, message: 'OCR script not found on server', tried: scriptCandidates });
    }

    const trySpawn = (cmd) => {
      return new Promise((resolve, reject) => {
        // Quote paths for Windows to handle spaces and special characters
        const quotedScriptPath = scriptPath.includes(' ') ? `"${scriptPath}"` : scriptPath;
        const quotedFilePath = filepath.includes(' ') ? `"${filepath}"` : filepath;
        
        // Construct command - on Windows with shell, build full command string
        const isWindows = process.platform === 'win32';
        let proc;
        
        if (isWindows) {
          // On Windows, construct full command string for better compatibility
          const fullCommand = `${cmd} ${quotedScriptPath} ${quotedFilePath}`;
          proc = spawn(fullCommand, { 
            shell: true,
            cwd: process.cwd()
          });
        } else {
          // On Unix, use array of arguments
          proc = spawn(cmd, [scriptPath, filepath], { 
            shell: false,
            cwd: process.cwd()
          });
        }
        
        let out = '';
        let err = '';
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.stderr.on('data', (d) => { err += d.toString(); });
        
        // Add timeout to prevent hanging (30 seconds)
        const timeout = setTimeout(() => {
          proc.kill();
          reject({ code: 'timeout', error: 'Python script execution timed out', cmd });
        }, 30000);
        
        proc.on('error', (e) => {
          clearTimeout(timeout);
          reject({ code: 'spawn_error', error: e, cmd, message: e.message });
        });
        
        proc.on('close', (code) => {
          clearTimeout(timeout);
          resolve({ code, out, err, cmd });
        });
      });
    };

    // Try different Python commands based on platform
    // Windows: try 'py', 'python', 'python3'
    // Unix: try 'python3', 'python'
    const isWindows = process.platform === 'win32';
    const pythonCommands = isWindows ? ['py', 'python', 'python3'] : ['python3', 'python'];
    
    let result = null;
    const attempts = [];
    
    for (const cmd of pythonCommands) {
      try {
        const attempt = await trySpawn(cmd);
        attempts.push({ cmd, ...attempt });
        
        // If successful (code 0) or got output, use this result
        if (attempt.code === 0 || (attempt.out && attempt.out.length > 0)) {
          result = attempt;
          break;
        }
        // If non-zero exit but no output, try next command
        // (might be command not found or script error)
        continue;
      } catch (spawnErr) {
        attempts.push({ 
          cmd, 
          code: 'spawn_error', 
          error: spawnErr.message || String(spawnErr),
          err: String(spawnErr)
        });
        // Continue to next command
        continue;
      }
    }

    // If all commands failed
    if (!result || (result.code !== 0 && (!result.out || result.out.length === 0))) {
      // cleanup temp file
      try { fs.unlinkSync(filepath); } catch (ex) { /* ignore */ }
      
      // Find the most informative error
      const lastAttempt = attempts[attempts.length - 1];
      const errorDetails = attempts.map(a => ({
        command: a.cmd,
        code: a.code,
        error: a.error || a.err || 'No error message',
        hasOutput: !!(a.out && a.out.length > 0)
      }));
      
      console.error(`Failed to execute OCR python. All attempts:`, attempts);
      
      // Check if Python might not be installed
      const allSpawnErrors = attempts.every(a => a.code === 'spawn_error' || !a.out);
      const errorMsg = allSpawnErrors 
        ? 'Python is not installed or not in PATH. Please install Python and ensure it is accessible.'
        : (lastAttempt?.error || lastAttempt?.err || 'Unknown error');
      
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to execute OCR python', 
        error: errorMsg,
        attempts: errorDetails,
        scriptPath: scriptPath,
        platform: process.platform,
        hint: allSpawnErrors ? 'Install Python from python.org and ensure it is in your PATH' : 'Check if PaddleOCR is installed: pip install paddleocr'
      });
    }

    // cleanup temp file
    try { fs.unlinkSync(filepath); } catch (e) { /* ignore */ }

    // If we have output, try to parse it (even if exit code is non-zero, might be error JSON)
    if (result && result.out && result.out.length > 0) {
      try {
        const parsed = JSON.parse(result.out);
        // Check if Python script returned an error in JSON
        if (parsed.error) {
          console.error('PaddleOCR python error', parsed);
          return res.status(500).json({ success: false, message: 'OCR processing failed', error: parsed.error, detail: parsed.detail });
        }
        return res.status(200).json({ success: true, data: parsed });
      } catch (e) {
        console.error('Failed to parse OCR output', e, result && result.out);
        return res.status(500).json({ success: false, message: 'Invalid OCR output', error: e.message, raw: result && result.out });
      }
    }

    // If we got here, something went wrong
    console.error('PaddleOCR python error - no output', result);
    return res.status(500).json({ success: false, message: 'OCR processing failed', error: result?.err || 'No output from Python script' });
  } catch (error) {
    console.error('Error in scanReceipt:', error.message);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

