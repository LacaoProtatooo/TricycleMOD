import Tricycle from '../models/tricycleModel.js';
import User from '../models/userModel.js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const resolveOcrScriptPath = () => {
  const scriptCandidates = [
    path.join(process.cwd(), 'ocr', 'paddle_scan.py'),
    path.join(process.cwd(), 'server', 'ocr', 'paddle_scan.py'),
    path.join(process.cwd(), '..', 'server', 'ocr', 'paddle_scan.py'),
  ];

  for (const candidate of scriptCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        return { scriptPath: candidate, scriptCandidates };
      }
    } catch (error) {
      // ignore fs permission errors and continue
    }
  }

  return { scriptPath: null, scriptCandidates };
};

const runPaddleOcr = async ({ filepath, langArg, noClsFlag }) => {
  const { scriptPath, scriptCandidates } = resolveOcrScriptPath();

  if (!scriptPath) {
    const err = new Error('OCR script not found on server');
    err.meta = { scriptCandidates };
    throw err;
  }

  const baseArgs = [scriptPath, filepath];
  if (langArg) {
    baseArgs.push('--lang', String(langArg));
  }
  if (noClsFlag) {
    baseArgs.push('--no-cls');
  }

  const trySpawn = (cmd) =>
    new Promise((resolve, reject) => {
      let proc;
      try {
        proc = spawn(cmd, baseArgs, { shell: false, cwd: process.cwd() });
      } catch (error) {
        return reject({ code: 'spawn_error', error });
      }

      let out = '';
      let err = '';
      proc.stdout.on('data', (d) => {
        out += d.toString();
      });
      proc.stderr.on('data', (d) => {
        err += d.toString();
      });

      const timeout = setTimeout(() => {
        try {
          proc.kill();
        } catch (_) {
          // ignore
        }
        reject({ code: 'timeout', error: new Error('Python script execution timed out') });
      }, 30000);

      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject({ code: 'spawn_error', error });
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ code, out, err, cmd, args: baseArgs });
      });
    });

  const isWindows = process.platform === 'win32';
  const pythonCommands = isWindows ? ['py', 'python', 'python3'] : ['python3', 'python'];
  const venvCandidates = [
    path.join(process.cwd(), '.venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
    path.join(process.cwd(), 'venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
  ];
  for (const vp of venvCandidates) {
    try {
      if (fs.existsSync(vp) && !pythonCommands.includes(vp)) {
        pythonCommands.unshift(vp);
        break;
      }
    } catch (_) {
      // ignore
    }
  }

  const attempts = [];
  let result = null;

  for (const cmd of pythonCommands) {
    try {
      const attempt = await trySpawn(cmd);
      attempts.push({
        cmd,
        code: attempt.code,
        stderr: attempt.err,
        hasOutput: Boolean(attempt.out && attempt.out.length > 0),
      });

      if (attempt.code === 0 && attempt.out && attempt.out.length > 0) {
        result = attempt;
        break;
      }

      if (!result && attempt.out && attempt.out.length > 0) {
        result = attempt; // keep the most informative output even if exit code != 0
      }
    } catch (spawnErr) {
      attempts.push({
        cmd,
        code: spawnErr.code || 'spawn_error',
        error: spawnErr.error?.message || spawnErr.message || String(spawnErr),
      });
    }
  }

  if (!result || (result.code !== 0 && (!result.out || result.out.length === 0))) {
    const err = new Error('Failed to execute OCR python');
    err.meta = { attempts, scriptPath, platform: process.platform };
    throw err;
  }

  if (result.out && result.out.length > 0) {
    try {
      const parsed = JSON.parse(result.out);
      if (parsed.error) {
        const err = new Error(parsed.error || 'OCR python reported an error');
        err.meta = { detail: parsed, attempts, scriptPath, stderr: result.err };
        throw err;
      }
      return parsed;
    } catch (parseErr) {
      const err = new Error('Invalid OCR output');
      err.meta = {
        parseError: parseErr.message || String(parseErr),
        raw: result.out,
        stderr: result.err,
        attempts,
        scriptPath,
      };
      throw err;
    }
  }

  const err = new Error('OCR python returned no output');
  err.meta = { attempts, scriptPath, stderr: result?.err };
  throw err;
};

let cachedTesseract = null;
const loadTesseract = async () => {
  if (cachedTesseract) return cachedTesseract;
  const mod = await import('tesseract.js');
  cachedTesseract = mod.default || mod;
  return cachedTesseract;
};

const normalizeTesseractLang = (langArg) => {
  const map = {
    en: 'eng',
    eng: 'eng',
    english: 'eng',
    fil: 'fil',
    filipino: 'fil',
    tl: 'tgl',
    tgl: 'tgl',
    tagalog: 'tgl',
    es: 'spa',
    spa: 'spa',
    spanish: 'spa',
    fr: 'fra',
    fra: 'fra',
    french: 'fra',
  };

  if (!langArg) return 'eng';
  const normalized = String(langArg).trim().toLowerCase();
  if (map[normalized]) return map[normalized];
  if (normalized.length === 3) return normalized;
  return 'eng';
};

const runTesseractFallback = async (imagePath, langArg) => {
  const Tesseract = await loadTesseract();
  const lang = normalizeTesseractLang(langArg);

  try {
    const { data } = await Tesseract.recognize(imagePath, lang, { logger: () => {} });
    const normalizeConfidence = (value) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return null;
      return value > 1 ? value / 100 : value;
    };

    const lines = (data?.lines || [])
      .map((line) => {
        const text = line.text?.trim();
        if (!text) return null;
        const confidence = normalizeConfidence(line.confidence);
        const box = line.bbox
          ? [
              [line.bbox.x0, line.bbox.y0],
              [line.bbox.x1, line.bbox.y0],
              [line.bbox.x1, line.bbox.y1],
              [line.bbox.x0, line.bbox.y1],
            ]
          : null;
        return { text, confidence, box };
      })
      .filter(Boolean);

    if (!lines.length && data?.text) {
      const fallbackLines = data.text
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ text, confidence: null, box: null }));
      lines.push(...fallbackLines);
    }

    if (!lines.length) {
      const err = new Error('Tesseract fallback returned no text');
      err.meta = { lang };
      throw err;
    }

    return { lines };
  } catch (error) {
    if (error.meta) throw error;
    const err = new Error(error.message || 'Tesseract processing failed');
    err.meta = { lang };
    throw err;
  }
};

const buildErrorPayload = (err) => {
  if (!err) return null;
  return {
    message: err.message || String(err),
    meta: err.meta || null,
  };
};

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
      .populate('schedules.driver', 'firstname lastname username email')
      .sort({ createdAt: -1 });

    // Get all available drivers (drivers not assigned to any tricycle)
    // Note: Drivers in schedules are also considered "assigned" for that slot, 
    // but might be available for other slots. For simplicity, let's exclude anyone attached to a tricycle.
    const assignedDriverIds = new Set();
    tricycles.forEach(t => {
        if (t.driver) assignedDriverIds.add(t.driver._id.toString());
        if (t.schedules && t.schedules.length > 0) {
            t.schedules.forEach(s => {
                if (s.driver) assignedDriverIds.add(s.driver._id.toString());
            });
        }
    });

    const availableDrivers = await User.find({
      role: 'driver',
      _id: { $nin: Array.from(assignedDriverIds) },
    }).select('firstname lastname username email phone image rating numReviews');

    // Get all drivers (for reference)
    const allDrivers = await User.find({ role: 'driver' }).select(
      'firstname lastname username email phone image rating numReviews'
    );

    // Format tricycles with driver info
    const formattedTricycles = tricycles.map((tricycle) => {
      let driverName = 'Unassigned';
      if (tricycle.driver) {
          driverName = `${tricycle.driver.firstname} ${tricycle.driver.lastname}`;
      } else if (tricycle.schedules && tricycle.schedules.length > 0) {
          driverName = `${tricycle.schedules.length} Drivers Scheduled`;
      }

      return {
        id: tricycle._id,
        plate: tricycle.plateNumber,
        bodyNumber: tricycle.bodyNumber || '',
        model: tricycle.model,
        driverId: tricycle.driver?._id || null,
        driverName: driverName,
        driver: tricycle.driver || null,
        status: tricycle.status,
        images: tricycle.images || [],
        maintenanceHistory: tricycle.maintenanceHistory || [],
        schedules: tricycle.schedules || [],
        currentOdometer: tricycle.currentOdometer || 0,
        createdAt: tricycle.createdAt,
        updatedAt: tricycle.updatedAt,
      };
    });

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

    // Check if driver is already assigned to another tricycle (EXCLUSIVE assignment check)
    const existingPrimaryAssignment = await Tricycle.findOne({
      driver: driverId,
      _id: { $ne: tricycleId },
    });

    if (existingPrimaryAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Driver is already exclusively assigned to another tricycle',
      });
    }

    const { schedule } = req.body;

    if (schedule) {
        // Shared Assignment Logic
        const existingScheduleIndex = tricycle.schedules.findIndex(s => s.driver.toString() === driverId);
        
        const newScheduleEntry = {
            driver: driverId,
            days: schedule.days, 
            startTime: schedule.startTime,
            endTime: schedule.endTime
        };

        if (existingScheduleIndex >= 0) {
            tricycle.schedules[existingScheduleIndex] = newScheduleEntry;
        } else {
            tricycle.schedules.push(newScheduleEntry);
        }
        
        if (!tricycle.driver) {
            tricycle.driver = driverId;
        }

    } else {
        // Exclusive Assignment Logic
        tricycle.schedules = []; 
        tricycle.driver = driverId;
    }

    await tricycle.save();

    // Populate and return updated tricycle
    const updatedTricycle = await Tricycle.findById(tricycleId)
      .populate('driver', 'firstname lastname username email phone image')
      .populate('operator', 'firstname lastname username email')
      .populate('schedules.driver', 'firstname lastname username email phone image');

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
    const { tricycleId, driverId } = req.body;

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

    if (driverId) {
        // Remove specific driver from schedules
        if (tricycle.schedules && tricycle.schedules.length > 0) {
            tricycle.schedules = tricycle.schedules.filter(s => s.driver.toString() !== driverId);
        }
        
        // If this driver was the primary one, remove them
        if (tricycle.driver && tricycle.driver.toString() === driverId) {
            tricycle.driver = null;
        }
    } else {
        // Unassign ALL
        tricycle.driver = null;
        tricycle.schedules = [];
    }

    await tricycle.save();

    // Populate and return updated tricycle
    const updatedTricycle = await Tricycle.findById(tricycleId)
      .populate('driver', 'firstname lastname username email phone image')
      .populate('operator', 'firstname lastname username email')
      .populate('schedules.driver', 'firstname lastname username email phone image');

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
  let filepath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const uploadsDir = path.join(process.cwd(), 'tmp_uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(req.file.originalname) || '.jpg'}`;
    filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    const langArg = (req.body && req.body.lang) || (req.query && req.query.lang) || process.env.PADDLE_OCR_LANG || 'en';
    const noClsFlag =
      (req.body && (req.body.noCls || req.body.no_cls || req.body.no_cls === true)) ||
      (req.query && (req.query.noCls || req.query.no_cls));

    let paddleResult = null;
    let paddleError = null;

    try {
      paddleResult = await runPaddleOcr({ filepath, langArg, noClsFlag });
    } catch (error) {
      paddleError = error;
      console.error('PaddleOCR execution failed:', error.message, error.meta || '');
    }

    if (paddleResult) {
      return res.status(200).json({
        success: true,
        data: paddleResult,
        meta: { engine: 'paddleocr', fallbackUsed: false },
      });
    }

    try {
      const fallbackResult = await runTesseractFallback(filepath, langArg);
      return res.status(200).json({
        success: true,
        data: fallbackResult,
        meta: {
          engine: 'tesseract.js',
          fallbackUsed: true,
          paddleError: paddleError?.message || 'PaddleOCR unavailable',
        },
      });
    } catch (fallbackError) {
      console.error('Tesseract fallback failed:', fallbackError.message, fallbackError.meta || '');
      return res.status(500).json({
        success: false,
        message: 'OCR processing failed',
        error: fallbackError.message,
        detail: {
          paddle: buildErrorPayload(paddleError),
          fallback: buildErrorPayload(fallbackError),
        },
      });
    }
  } catch (error) {
    console.error('Error in scanReceipt:', error.message);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  } finally {
    if (filepath) {
      try {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp OCR file:', cleanupError.message);
      }
    }
  }
};

