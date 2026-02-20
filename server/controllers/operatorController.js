import Tricycle from '../models/tricycleModel.js';
import User from '../models/userModel.js';
import Receipt from '../models/receiptModel.js';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import cloudinary from '../utils/cloudinaryConfig.js';

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
      .populate('schedules.driver', 'firstname lastname username email phone image')
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
        codingDay: tricycle.codingDay !== undefined ? tricycle.codingDay : null,
        boundary: tricycle.boundary || null,
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

    const { schedule, boundary } = req.body;

    // Handle boundary/koding agreement
    if (boundary) {
      tricycle.boundary = {
        amount: boundary.amount || 500,
        settlementType: boundary.settlementType || 'daily',
        notes: boundary.notes || '',
        lastSettledAt: null
      };
    }

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
        tricycle.status = 'available';

    } else {
        // Exclusive Assignment Logic
        tricycle.schedules = []; 
        tricycle.driver = driverId;
        tricycle.status = 'available';
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
        
        // If no driver and no schedules left, mark unavailable
        if (!tricycle.driver && (!tricycle.schedules || tricycle.schedules.length === 0)) {
            tricycle.status = 'unavailable';
        }
    } else {
        // Unassign ALL
        tricycle.driver = null;
        tricycle.schedules = [];
        tricycle.status = 'unavailable';
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

// Save a scanned receipt
export const saveReceipt = async (req, res) => {
  try {
    const operatorId = req.user._id;
    const {
      vendorName,
      receiptDate,
      totalAmount,
      subtotal,
      tax,
      items,
      category,
      rawOcrText,
      ocrLines,
      tricycleId,
      notes,
      ocrEngine,
      imageBase64
    } = req.body;

    // Upload image to Cloudinary if provided
    let imageUrl = null;
    if (imageBase64) {
      try {
        const uploadResult = await cloudinary.uploader.upload(imageBase64, {
          folder: 'receipts',
          resource_type: 'image',
          transformation: [{ quality: 'auto:good' }]
        });
        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError.message);
        // Continue without image URL
      }
    }

    const receipt = new Receipt({
      operator: operatorId,
      tricycle: tricycleId || null,
      vendorName: vendorName || '',
      receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
      totalAmount: parseFloat(totalAmount) || 0,
      subtotal: subtotal ? parseFloat(subtotal) : null,
      tax: tax ? parseFloat(tax) : null,
      items: items || [],
      category: category || 'other',
      rawOcrText: rawOcrText || '',
      ocrLines: ocrLines || [],
      imageUrl,
      notes: notes || '',
      ocrEngine: ocrEngine || 'unknown'
    });

    await receipt.save();

    res.status(201).json({
      success: true,
      message: 'Receipt saved successfully',
      data: receipt
    });
  } catch (error) {
    console.error('Error saving receipt:', error.message);
    res.status(500).json({ success: false, message: 'Failed to save receipt', error: error.message });
  }
};

// Get all receipts for operator
export const getReceipts = async (req, res) => {
  try {
    const operatorId = req.user._id;
    const { category, tricycleId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = { operator: operatorId };
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (tricycleId) {
      filter.tricycle = tricycleId;
    }
    if (startDate || endDate) {
      filter.receiptDate = {};
      if (startDate) filter.receiptDate.$gte = new Date(startDate);
      if (endDate) filter.receiptDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [receipts, total] = await Promise.all([
      Receipt.find(filter)
        .populate('tricycle', 'plateNumber')
        .sort({ scanDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Receipt.countDocuments(filter)
    ]);

    // Calculate totals by category
    const categoryTotals = await Receipt.aggregate([
      { $match: { operator: operatorId } },
      { 
        $group: { 
          _id: '$category', 
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        } 
      }
    ]);

    res.status(200).json({
      success: true,
      data: receipts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      categoryTotals: categoryTotals.reduce((acc, curr) => {
        acc[curr._id] = { total: curr.total, count: curr.count };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching receipts:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch receipts', error: error.message });
  }
};

// Get single receipt by ID
export const getReceiptById = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const operatorId = req.user._id;

    const receipt = await Receipt.findOne({ _id: receiptId, operator: operatorId })
      .populate('tricycle', 'plateNumber model')
      .lean();

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    res.status(200).json({ success: true, data: receipt });
  } catch (error) {
    console.error('Error fetching receipt:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch receipt', error: error.message });
  }
};

// Update receipt
export const updateReceipt = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const operatorId = req.user._id;
    const updates = req.body;

    // Ensure operator owns this receipt
    const receipt = await Receipt.findOne({ _id: receiptId, operator: operatorId });
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    // Update allowed fields
    const allowedUpdates = ['vendorName', 'receiptDate', 'totalAmount', 'subtotal', 'tax', 'items', 'category', 'tricycle', 'notes'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        receipt[field] = updates[field];
      }
    });

    await receipt.save();

    res.status(200).json({ success: true, message: 'Receipt updated', data: receipt });
  } catch (error) {
    console.error('Error updating receipt:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update receipt', error: error.message });
  }
};

// Delete receipt
export const deleteReceipt = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const operatorId = req.user._id;

    const receipt = await Receipt.findOneAndDelete({ _id: receiptId, operator: operatorId });
    
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    // Optionally delete from Cloudinary
    if (receipt.imageUrl) {
      try {
        const publicId = receipt.imageUrl.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, '');
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryError) {
        console.warn('Failed to delete image from Cloudinary:', cloudinaryError.message);
      }
    }

    res.status(200).json({ success: true, message: 'Receipt deleted' });
  } catch (error) {
    console.error('Error deleting receipt:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete receipt', error: error.message });
  }
};

// Get expense summary for operator
export const getExpenseSummary = async (req, res) => {
  try {
    const operatorId = req.user._id;
    const { startDate, endDate, groupBy = 'category' } = req.query;

    const matchStage = { operator: operatorId };
    if (startDate || endDate) {
      matchStage.receiptDate = {};
      if (startDate) matchStage.receiptDate.$gte = new Date(startDate);
      if (endDate) matchStage.receiptDate.$lte = new Date(endDate);
    }

    let groupId;
    switch (groupBy) {
      case 'month':
        groupId = { year: { $year: '$receiptDate' }, month: { $month: '$receiptDate' } };
        break;
      case 'tricycle':
        groupId = '$tricycle';
        break;
      case 'category':
      default:
        groupId = '$category';
    }

    const summary = await Receipt.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupId,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Get overall totals
    const overallTotals = await Receipt.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          grandTotal: { $sum: '$totalAmount' },
          receiptCount: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        breakdown: summary,
        overall: overallTotals[0] || { grandTotal: 0, receiptCount: 0 }
      }
    });
  } catch (error) {
    console.error('Error fetching expense summary:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch expense summary', error: error.message });
  }
};

// ===================== ADMIN ENDPOINTS =====================

/**
 * Admin: Get all operators with their tricycles and assigned drivers
 */
export const adminGetAllOperators = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search query for operators
    const searchQuery = {
      role: 'operator',
    };

    if (search) {
      searchQuery.$or = [
        { firstname: { $regex: search, $options: 'i' } },
        { lastname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    // Get operators
    const operators = await User.find(searchQuery)
      .select('firstname lastname email phone image username isVerified createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(searchQuery);

    // Get tricycles and drivers for each operator
    const operatorsWithDetails = await Promise.all(
      operators.map(async (operator) => {
        const tricycles = await Tricycle.find({ operator: operator._id })
          .populate('driver', 'firstname lastname email phone image rating numReviews')
          .select('plateNumber bodyNumber model status currentOdometer images driver createdAt');

        // Count stats
        const totalTricycles = tricycles.length;
        const activeTricycles = tricycles.filter(t => t.driver).length;
        const availableTricycles = tricycles.filter(t => t.status === 'available').length;

        // Get unique drivers assigned to this operator's tricycles
        const assignedDriverIds = [...new Set(tricycles.filter(t => t.driver).map(t => t.driver._id.toString()))];
        const driversCount = assignedDriverIds.length;

        return {
          ...operator.toObject(),
          tricycles,
          stats: {
            totalTricycles,
            activeTricycles,
            availableTricycles,
            driversCount,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      operators: operatorsWithDetails,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching operators for admin:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch operators', error: error.message });
  }
};

/**
 * Admin: Get operator details with full tricycle and driver information
 */
export const adminGetOperatorDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const operator = await User.findOne({ _id: id, role: 'operator' })
      .select('-password');

    if (!operator) {
      return res.status(404).json({ success: false, message: 'Operator not found' });
    }

    const tricycles = await Tricycle.find({ operator: id })
      .populate('driver', 'firstname lastname email phone image rating numReviews tripCount isVerified createdAt')
      .populate('schedules.driver', 'firstname lastname')
      .sort({ createdAt: -1 });

    // Get all unique drivers who have ever been assigned to operator's tricycles
    const driverIds = [...new Set(tricycles.filter(t => t.driver).map(t => t.driver._id.toString()))];
    
    res.status(200).json({
      success: true,
      operator,
      tricycles,
      driverCount: driverIds.length,
    });
  } catch (error) {
    console.error('Error fetching operator details:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch operator details', error: error.message });
  }
};

/**
 * Admin: Get operators statistics
 */
export const adminGetOperatorStats = async (req, res) => {
  try {
    const totalOperators = await User.countDocuments({ role: 'operator' });
    const verifiedOperators = await User.countDocuments({ role: 'operator', isVerified: true });
    const totalTricycles = await Tricycle.countDocuments();
    const assignedTricycles = await Tricycle.countDocuments({ driver: { $ne: null } });
    const availableTricycles = await Tricycle.countDocuments({ status: 'available' });
    const totalDrivers = await User.countDocuments({ role: 'driver' });

    // Get operators created in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newOperators = await User.countDocuments({
      role: 'operator',
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalOperators,
        verifiedOperators,
        newOperators,
        totalTricycles,
        assignedTricycles,
        availableTricycles,
        unassignedTricycles: totalTricycles - assignedTricycles,
        totalDrivers,
      }
    });
  } catch (error) {
    console.error('Error fetching operator stats:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch operator stats', error: error.message });
  }
};

/**
 * Admin: Get simple operators list for filter dropdowns
 */
export const adminGetOperatorsList = async (req, res) => {
  try {
    const operators = await User.find({ role: 'operator' })
      .select('firstname lastname email')
      .sort({ lastname: 1, firstname: 1 });

    res.status(200).json({
      success: true,
      operators,
    });
  } catch (error) {
    console.error('Error fetching operators list:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch operators list', error: error.message });
  }
};


