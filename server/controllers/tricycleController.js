import mongoose from "mongoose";
import Tricycle from "../models/tricycleModel.js";
import User from "../models/userModel.js";
import cloudinary from "../utils/cloudinaryConfig.js";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { parseCRDocument, parseORDocument, validateDocuments } from "../utils/documentParser.js";

// Cloudinary upload function 
const uploadToCloudinary = (buffer, folder = "tricycles") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// --- OCR HELPERS ---
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
      }, 60000);

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
        result = attempt;
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
      if (parseErr.message && parseErr.meta) throw parseErr;
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

// ==================== GET ALL TRICYCLES ====================
export const getTricycles = async (req, res) => {
  try {
    const { search, status } = req.query;

    const query = {};
    if (search) query.plateNumber = { $regex: search, $options: "i" };
    if (status) query.status = status;

    // If user is authenticated and is an operator, only show their tricycles
    if (req.user && req.user.role === 'operator') {
      query.operator = req.user.id;
    } else if (req.user && req.user.role === 'driver') {
      query.$or = [
        { driver: req.user.id },
        { 'schedules.driver': req.user.id }
      ];
    }

    const tricycles = await Tricycle.find(query)
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image")
      .populate("schedules.driver", "firstname lastname username email phone image");

    res.status(200).json({
      success: true,
      count: tricycles.length,
      data: tricycles,
    });
  } catch (error) {
    console.error("Error fetching tricycles:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== GET SINGLE TRICYCLE ====================
export const getTricycle = async (req, res) => {
  const { id } = req.params;

  try {
    const tricycle = await Tricycle.findById(id)
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image")
      .populate("schedules.driver", "firstname lastname username email phone image");

    if (!tricycle)
      return res.status(404).json({ success: false, message: "Tricycle not found" });

    res.status(200).json({ success: true, data: tricycle });
  } catch (error) {
    console.error("Error fetching tricycle:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== CREATE TRICYCLE ====================
export const createTricycle = async (req, res) => {
  try {
    const { plateNumber, bodyNumber, model, driver, status, currentOdometer, codingDay } = req.body;

    // Validate required fields (bodyNumber is optional)
    if (!plateNumber || !model) {
      return res.status(400).json({
        success: false,
        message: "Plate number and model are required.",
      });
    }

    // Validate coding day if provided
    if (codingDay !== undefined && codingDay !== null) {
      const codingDayNum = parseInt(codingDay, 10);
      if (isNaN(codingDayNum) || codingDayNum < 0 || codingDayNum > 6) {
        return res.status(400).json({
          success: false,
          message: "Coding day must be a number between 0 (Sunday) and 6 (Saturday).",
        });
      }
    }

    // Get operator from authenticated user (if available) or from request body
    const operatorId = req.user?.id || req.body.operator;
    
    if (!operatorId) {
      return res.status(400).json({
        success: false,
        message: "Operator is required. Please login or provide operator ID.",
      });
    }

    // Validate operator existence and role
    const operatorExists = await User.findById(operatorId);
    if (!operatorExists) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }

    // If user is authenticated, verify they are an operator
    if (req.user && req.user.role !== 'operator') {
      return res.status(403).json({
        success: false,
        message: "Only operators can create tricycles",
      });
    }

    // Upload multiple images to Cloudinary
    let imageLinks = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer);
          imageLinks.push({ public_id: result.public_id, url: result.secure_url });
        } catch (error) {
          console.error("Cloudinary upload error:", error.message);
          return res.status(500).json({
            success: false,
            message: "Image upload failed. Please try again.",
          });
        }
      }
    }

    // Create new tricycle
    const newTricycle = new Tricycle({
      plateNumber,
      bodyNumber,
      model,
      operator: operatorId,
      driver: driver || null,
      status: status || "unavailable",
      currentOdometer: currentOdometer || 0,
      codingDay: codingDay !== undefined && codingDay !== null ? parseInt(codingDay, 10) : null,
      images: imageLinks,
    });

    await newTricycle.save();

    // Populate operator and driver before returning
    const populatedTricycle = await Tricycle.findById(newTricycle._id)
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image");

    res.status(201).json({
      success: true,
      message: "Tricycle added successfully",
      data: populatedTricycle,
    });
  } catch (error) {
    console.error("Error creating tricycle:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== UPDATE TRICYCLE ====================
export const updateTricycle = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).send(`No Tricycle with id: ${id}`);

  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle) {
      return res.status(404).json({ success: false, message: "Tricycle not found" });
    }

    // If user is authenticated and is an operator, verify ownership
    if (req.user && req.user.role === 'operator') {
      if (tricycle.operator.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own tricycles",
        });
      }
    }

    const { plateNumber, bodyNumber, model, operator, driver, status, existingImages = [], codingDay } = req.body;

    // Validate coding day if provided
    if (codingDay !== undefined && codingDay !== null && codingDay !== '') {
      const codingDayNum = parseInt(codingDay, 10);
      if (isNaN(codingDayNum) || codingDayNum < 0 || codingDayNum > 6) {
        return res.status(400).json({
          success: false,
          message: "Coding day must be a number between 0 (Sunday) and 6 (Saturday).",
        });
      }
    }

    // Upload new images to Cloudinary (if any)
    let newImageLinks = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        newImageLinks.push({ public_id: result.public_id, url: result.secure_url });
      }
    }

    // Delete images that are not in the existingImages list
    await Promise.all(
      tricycle.images.map(async (img) => {
        if (!existingImages.includes(img.url)) {
          await cloudinary.uploader.destroy(img.public_id);
        }
      })
    );

    // Merge retained + newly uploaded images
    const updatedImages = [
      ...tricycle.images.filter((img) => existingImages.includes(img.url)),
      ...newImageLinks,
    ];

    // Handle coding day - allow setting to null to remove the restriction
    let codingDayValue = tricycle.codingDay;
    if (codingDay !== undefined) {
      if (codingDay === null || codingDay === '' || codingDay === 'null') {
        codingDayValue = null;
      } else {
        codingDayValue = parseInt(codingDay, 10);
      }
    }

    const updatedData = {
      plateNumber: plateNumber || tricycle.plateNumber,
      bodyNumber: bodyNumber || tricycle.bodyNumber,
      model: model || tricycle.model,
      // Operators cannot change the operator field - it's always their own
      operator: (req.user && req.user.role === 'operator') ? req.user.id : (operator || tricycle.operator),
      driver: driver || tricycle.driver,
      status: status || tricycle.status,
      codingDay: codingDayValue,
      images: updatedImages,
    };

    const updatedTricycle = await Tricycle.findByIdAndUpdate(id, updatedData, {
      new: true,
    })
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image");

    res.status(200).json({ success: true, data: updatedTricycle });
  } catch (error) {
    console.error("Error updating tricycle:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== DELETE TRICYCLE ====================
export const deleteTricycle = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).send(`No Tricycle with id: ${id}`);

  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle)
      return res.status(404).json({ success: false, message: "Tricycle not found" });

    // If user is authenticated and is an operator, verify ownership
    if (req.user && req.user.role === 'operator') {
      if (tricycle.operator.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own tricycles",
        });
      }
    }

    // Delete Cloudinary images
    if (tricycle.images && tricycle.images.length > 0) {
      await Promise.all(
        tricycle.images.map(async (img) => {
          await cloudinary.uploader.destroy(img.public_id);
        })
      );
    }

    await Tricycle.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Tricycle deleted successfully" });
  } catch (error) {
    console.error("Error deleting tricycle:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== ADD MAINTENANCE LOG ====================
export const addMaintenanceLog = async (req, res) => {
  const { id } = req.params;
  const { itemKey, lastServiceKm, notes } = req.body;

  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle) {
      return res.status(404).json({ success: false, message: "Tricycle not found" });
    }

    const newLog = {
      itemKey,
      lastServiceKm,
      completedBy: req.user ? req.user.id : null,
      completedAt: new Date(),
      notes
    };

    tricycle.maintenanceHistory.push(newLog);
    
    // Update odometer if the service km is higher than current
    if (lastServiceKm > (tricycle.currentOdometer || 0)) {
        tricycle.currentOdometer = lastServiceKm;
    }

    await tricycle.save();

    res.status(200).json({ success: true, data: tricycle });
  } catch (error) {
    console.error("Error adding maintenance log:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== GET MAINTENANCE HISTORY ====================
export const getMaintenanceHistory = async (req, res) => {
  const { id } = req.params;
  const { category, dateFrom, dateTo, sortBy = 'newest', limit } = req.query;

  try {
    const tricycle = await Tricycle.findById(id)
      .populate('maintenanceHistory.completedBy', 'firstname lastname')
      .select('plateNumber model bodyNumber maintenanceHistory currentOdometer');
    
    if (!tricycle) {
      return res.status(404).json({ success: false, message: "Tricycle not found" });
    }

    let history = [...(tricycle.maintenanceHistory || [])];

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      history = history.filter(h => new Date(h.completedAt) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      history = history.filter(h => new Date(h.completedAt) <= toDate);
    }

    // Sort
    history.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.completedAt) - new Date(a.completedAt);
      if (sortBy === 'oldest') return new Date(a.completedAt) - new Date(b.completedAt);
      if (sortBy === 'km_high') return (b.lastServiceKm || 0) - (a.lastServiceKm || 0);
      if (sortBy === 'km_low') return (a.lastServiceKm || 0) - (b.lastServiceKm || 0);
      return 0;
    });

    // Limit results
    if (limit) {
      history = history.slice(0, parseInt(limit));
    }

    // Calculate statistics
    const stats = {
      totalServices: tricycle.maintenanceHistory?.length || 0,
      filteredCount: history.length,
      lastServiceDate: history.length > 0 ? history[0].completedAt : null,
      currentOdometer: tricycle.currentOdometer || 0,
    };

    res.status(200).json({
      success: true,
      tricycle: {
        _id: tricycle._id,
        plateNumber: tricycle.plateNumber,
        model: tricycle.model,
        bodyNumber: tricycle.bodyNumber,
      },
      history,
      stats,
    });
  } catch (error) {
    console.error("Error getting maintenance history:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== UPDATE ODOMETER ====================
export const updateOdometer = async (req, res) => {
  const { id } = req.params;
  const { odometer } = req.body;

  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle) {
      return res.status(404).json({ success: false, message: "Tricycle not found" });
    }

    // Allow driver or operator to update
    // (Add more strict checks if needed, e.g. only assigned driver)

    tricycle.currentOdometer = odometer;
    await tricycle.save();

    res.status(200).json({ success: true, data: tricycle });
  } catch (error) {
    console.error("Error updating odometer:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== ASSIGN DRIVER ====================
export const assignDriver = async (req, res) => {
  const { id } = req.params;
  const { driverId, schedule } = req.body;

  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle) {
      return res.status(404).json({ success: false, message: "Tricycle not found" });
    }

    // Verify operator ownership
    if (req.user && req.user.role === 'operator' && tricycle.operator.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (schedule) {
        // Shared assignment: Add to schedules
        // Check if driver is already in schedule
        const existingIndex = tricycle.schedules.findIndex(s => s.driver.toString() === driverId);
        if (existingIndex >= 0) {
            tricycle.schedules[existingIndex] = { driver: driverId, ...schedule };
        } else {
            tricycle.schedules.push({ driver: driverId, ...schedule });
        }
        // If switching to shared mode, we might want to clear the exclusive driver
        // or keep it as a fallback. Let's clear it to avoid ambiguity.
        tricycle.driver = null;
    } else {
        // Exclusive assignment
        tricycle.driver = driverId;
        // Clear schedules if exclusive assignment is made
        tricycle.schedules = []; 
    }
    
    await tricycle.save();
    
    const updatedTricycle = await Tricycle.findById(id)
        .populate("operator", "firstname lastname username email")
        .populate("driver", "firstname lastname username email phone image")
        .populate("schedules.driver", "firstname lastname username email");

    res.status(200).json({ success: true, data: updatedTricycle });
  } catch (error) {
    console.error("Error assigning driver:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== UPDATE SCHEDULE ====================
export const updateSchedule = async (req, res) => {
  const { id } = req.params;
  const { schedules } = req.body; // Array of schedule objects

  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle) {
      return res.status(404).json({ success: false, message: "Tricycle not found" });
    }

    // Verify operator ownership
    if (req.user && req.user.role === 'operator' && tricycle.operator.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    tricycle.schedules = schedules;
    
    await tricycle.save();

    const updatedTricycle = await Tricycle.findById(id)
        .populate("operator", "firstname lastname username email")
        .populate("driver", "firstname lastname username email phone image")
        .populate("schedules.driver", "firstname lastname username email");

    res.status(200).json({ success: true, data: updatedTricycle });
  } catch (error) {
    console.error("Error updating schedule:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== SCAN CR DOCUMENT (OCR) ====================
export const scanCRDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    // Save temp file for OCR
    const tempDir = os.tmpdir();
    const tempFilename = `cr_scan_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const tempFilepath = path.join(tempDir, tempFilename);
    
    fs.writeFileSync(tempFilepath, req.file.buffer);

    try {
      // Run OCR
      const ocrResult = await runPaddleOcr({ filepath: tempFilepath, langArg: 'en', noClsFlag: true });
      
      // Parse CR document
      const crData = parseCRDocument(ocrResult);
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilepath);
      } catch (_) {}

      res.status(200).json({
        success: true,
        data: {
          crData,
          rawOcr: ocrResult,
        }
      });
    } catch (ocrError) {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilepath);
      } catch (_) {}
      
      throw ocrError;
    }
  } catch (error) {
    console.error("Error scanning CR document:", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to scan CR document",
      meta: error.meta || {}
    });
  }
};

// ==================== SCAN OR DOCUMENT (OCR) ====================
export const scanORDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    // Save temp file for OCR
    const tempDir = os.tmpdir();
    const tempFilename = `or_scan_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const tempFilepath = path.join(tempDir, tempFilename);
    
    fs.writeFileSync(tempFilepath, req.file.buffer);

    try {
      // Run OCR
      const ocrResult = await runPaddleOcr({ filepath: tempFilepath, langArg: 'en', noClsFlag: true });
      
      // Parse OR document
      const orData = parseORDocument(ocrResult);
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilepath);
      } catch (_) {}

      res.status(200).json({
        success: true,
        data: {
          orData,
          rawOcr: ocrResult,
        }
      });
    } catch (ocrError) {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilepath);
      } catch (_) {}
      
      throw ocrError;
    }
  } catch (error) {
    console.error("Error scanning OR document:", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to scan OR document",
      meta: error.meta || {}
    });
  }
};

// ==================== VALIDATE CR AND OR DOCUMENTS ====================
export const validateCRORDocuments = async (req, res) => {
  try {
    const { crData, orData } = req.body;
    
    if (!crData || !orData) {
      return res.status(400).json({ 
        success: false, 
        message: "Both CR and OR data are required for validation" 
      });
    }
    
    const validationResult = validateDocuments(crData, orData);
    
    res.status(200).json({
      success: true,
      data: validationResult
    });
  } catch (error) {
    console.error("Error validating documents:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== UPDATE TRICYCLE CR/OR DATA ====================
export const updateTricycleDocuments = async (req, res) => {
  const { id } = req.params;
  
  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle) {
      return res.status(404).json({ success: false, message: "Tricycle not found" });
    }

    // Verify operator ownership
    if (req.user && req.user.role === 'operator') {
      if (tricycle.operator.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own tricycles",
        });
      }
    }

    const { crData, orData, documentValidation } = req.body;
    
    // Handle CR image upload
    if (req.files) {
      const crImage = req.files.find(f => f.fieldname === 'crImage');
      const orImage = req.files.find(f => f.fieldname === 'orImage');
      
      if (crImage) {
        // Delete old CR image if exists
        if (tricycle.crData?.crImage?.public_id) {
          try {
            await cloudinary.uploader.destroy(tricycle.crData.crImage.public_id);
          } catch (_) {}
        }
        const result = await uploadToCloudinary(crImage.buffer, "tricycle_documents");
        if (!tricycle.crData) tricycle.crData = {};
        tricycle.crData.crImage = { public_id: result.public_id, url: result.secure_url };
      }
      
      if (orImage) {
        // Delete old OR image if exists
        if (tricycle.orData?.orImage?.public_id) {
          try {
            await cloudinary.uploader.destroy(tricycle.orData.orImage.public_id);
          } catch (_) {}
        }
        const result = await uploadToCloudinary(orImage.buffer, "tricycle_documents");
        if (!tricycle.orData) tricycle.orData = {};
        tricycle.orData.orImage = { public_id: result.public_id, url: result.secure_url };
      }
    }
    
    // Update CR data
    if (crData) {
      tricycle.crData = {
        ...tricycle.crData,
        ...crData,
        crImage: tricycle.crData?.crImage // Preserve the image
      };
      
      // Update plate number if extracted from CR
      if (crData.plateNumber) {
        tricycle.plateNumber = crData.plateNumber.toUpperCase();
      }
      
      // Update model if extracted
      if (crData.vehicleMake && crData.vehicleSeries) {
        tricycle.model = `${crData.vehicleMake} ${crData.vehicleSeries}`;
      }
    }
    
    // Update OR data
    if (orData) {
      tricycle.orData = {
        ...tricycle.orData,
        ...orData,
        orImage: tricycle.orData?.orImage // Preserve the image
      };
    }
    
    // Update validation status
    if (documentValidation) {
      tricycle.documentValidation = {
        ...tricycle.documentValidation,
        ...documentValidation,
        validatedAt: new Date()
      };
    }
    
    await tricycle.save();
    
    const updatedTricycle = await Tricycle.findById(id)
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image");
    
    res.status(200).json({
      success: true,
      message: "Tricycle documents updated successfully",
      data: updatedTricycle
    });
  } catch (error) {
    console.error("Error updating tricycle documents:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== ADMIN: GET ALL TRICYCLES WITH CODING INFO ====================
export const adminGetCodingData = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', operatorId = '', codingDay = '' } = req.query;

    const query = {};

    // Filter by search (plate number or body number)
    if (search) {
      query.$or = [
        { plateNumber: { $regex: search, $options: 'i' } },
        { bodyNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by operator
    if (operatorId) {
      query.operator = operatorId;
    }

    // Filter by coding day
    if (codingDay !== '' && codingDay !== undefined && codingDay !== 'all') {
      if (codingDay === 'none') {
        query.codingDay = null;
      } else {
        query.codingDay = parseInt(codingDay, 10);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tricycles = await Tricycle.find(query)
      .populate('operator', 'firstname lastname username email phone image')
      .populate('driver', 'firstname lastname username email phone image')
      .sort({ 'operator.lastname': 1, plateNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tricycle.countDocuments(query);

    res.status(200).json({
      success: true,
      tricycles,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching coding data:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ==================== ADMIN: UPDATE TRICYCLE CODING DAY ====================
export const adminUpdateCodingDay = async (req, res) => {
  try {
    const { id } = req.params;
    const { codingDay } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Invalid tricycle ID' });
    }

    const tricycle = await Tricycle.findById(id);
    if (!tricycle) {
      return res.status(404).json({ success: false, message: 'Tricycle not found' });
    }

    // Validate coding day - allow null to remove restriction
    let codingDayValue = null;
    if (codingDay !== null && codingDay !== undefined && codingDay !== '' && codingDay !== 'null') {
      const codingDayNum = parseInt(codingDay, 10);
      if (isNaN(codingDayNum) || codingDayNum < 0 || codingDayNum > 6) {
        return res.status(400).json({
          success: false,
          message: 'Coding day must be a number between 0 (Sunday) and 6 (Saturday).',
        });
      }
      codingDayValue = codingDayNum;
    }

    tricycle.codingDay = codingDayValue;
    await tricycle.save();

    const updatedTricycle = await Tricycle.findById(id)
      .populate('operator', 'firstname lastname username email phone image')
      .populate('driver', 'firstname lastname username email phone image');

    res.status(200).json({
      success: true,
      message: 'Coding day updated successfully',
      tricycle: updatedTricycle,
    });
  } catch (error) {
    console.error('Error updating coding day:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ==================== ADMIN: GET CODING STATISTICS ====================
export const adminGetCodingStats = async (req, res) => {
  try {
    const today = new Date().getDay();

    // Aggregate statistics
    const [totalTricycles, codingDayStats, operatorStats] = await Promise.all([
      Tricycle.countDocuments({}),
      Tricycle.aggregate([
        {
          $group: {
            _id: '$codingDay',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Tricycle.aggregate([
        {
          $group: {
            _id: '$operator',
            tricycleCount: { $sum: 1 },
            withCoding: {
              $sum: { $cond: [{ $ne: ['$codingDay', null] }, 1, 0] },
            },
            withoutCoding: {
              $sum: { $cond: [{ $eq: ['$codingDay', null] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    // Calculate how many tricycles have coding today
    const codingToday = codingDayStats.find(s => s._id === today)?.count || 0;

    // Calculate tricycles with/without coding
    const withCoding = codingDayStats
      .filter(s => s._id !== null)
      .reduce((acc, s) => acc + s.count, 0);
    const withoutCoding = codingDayStats.find(s => s._id === null)?.count || 0;

    // Distribution by day
    const dayDistribution = {};
    for (let i = 0; i <= 6; i++) {
      const stat = codingDayStats.find(s => s._id === i);
      dayDistribution[i] = stat?.count || 0;
    }

    res.status(200).json({
      success: true,
      stats: {
        totalTricycles,
        withCoding,
        withoutCoding,
        codingToday,
        todayDay: today,
        dayDistribution,
        operatorCount: operatorStats.length,
      },
    });
  } catch (error) {
    console.error('Error fetching coding stats:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
