import License from "../models/licenseModel.js";
import cloudinary from "../utils/cloudinaryConfig.js";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from 'url';
import { parseLicenseText } from "../utils/licenseParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- OCR HELPERS (Ported from operatorController.js) ---

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

// 1. Parse License (Upload -> OCR -> Return JSON)
export const parseLicense = async (req, res) => {
  const { userId } = req.body;
  const image = req.file;

  if (!userId) return res.status(400).json({ success: false, message: "User ID is required" });
  if (!image) return res.status(400).json({ success: false, message: "Image is required" });

  let tempFilePath = null;

  try {
    // Save buffer to temp file
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `license-${Date.now()}.jpg`);
    await fs.promises.writeFile(tempFilePath, image.buffer);

    // Run OCR (PaddleOCR with Tesseract Fallback)
    console.log("Running OCR on:", tempFilePath);
    let ocrResult = null;
    
    try {
      ocrResult = await runPaddleOcr({ filepath: tempFilePath });
    } catch (error) {
      console.error('PaddleOCR execution failed:', error.message);
    }

    if (!ocrResult) {
        console.log("PaddleOCR failed, trying Tesseract fallback...");
        try {
            ocrResult = await runTesseractFallback(tempFilePath);
        } catch (fallbackError) {
            console.error('Tesseract fallback failed:', fallbackError.message);
            throw new Error("OCR failed on both PaddleOCR and Tesseract");
        }
    }

    console.log("OCR Result:", JSON.stringify(ocrResult, null, 2));

    // Parse OCR Text
    const parsedFields = parseLicenseText(ocrResult);
    console.log("Parsed Fields:", parsedFields);

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "driver_licenses" },
        (error, result) => {
          if (error) reject(new Error("Cloudinary upload failed"));
          else resolve(result);
        }
      );
      stream.end(image.buffer);
    });

    // Cleanup temp file
    try { await fs.promises.unlink(tempFilePath); } catch (e) {}

    // Helper to safely parse dates
    const safeDate = (dateStr) => {
        if (!dateStr) return undefined;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? undefined : d;
    };

    // Save as Draft to DB
    const licenseData = {
        userId,
        ...parsedFields,
        // Map parser fields to schema fields
        expiryDate: safeDate(parsedFields.expiry),
        issuedDate: safeDate(parsedFields.issued),
        birthdate: safeDate(parsedFields.birthdate),
        imageUrl: uploadResult.secure_url,
        rawOcrText: ocrResult,
        isVerified: false
    };

    // Upsert the license (create or update)
    // Note: We use findOneAndUpdate with upsert to handle the case where a license might already exist
    // We disable validation here because OCR might miss fields, and we want to save whatever we got
    const savedLicense = await License.findOneAndUpdate(
        { userId },
        licenseData,
        { new: true, upsert: true, runValidators: false }
    );

    // Return data for user verification
    res.status(200).json({
      success: true,
      message: "License processed and saved as draft. Please verify details.",
      data: {
        ...savedLicense.toObject(),
        parsedFields // Included for compatibility
      }
    });

  } catch (error) {
    if (tempFilePath) { try { await fs.promises.unlink(tempFilePath); } catch (e) {} }
    console.error("Parse License Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Save License (Receive verified data -> Save to DB)
export const saveLicense = async (req, res) => {
    const { 
        userId, 
        licenseNumber, 
        name, 
        birthdate, 
        address, 
        sex, 
        bloodType, 
        restrictions, 
        issuedDate, 
        expiryDate, 
        imageUrl, 
        rawOcrText 
    } = req.body;

    if (!userId || !licenseNumber || !imageUrl) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Ensure user can only update their own license
    if (req.user._id.toString() !== userId) {
        return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    try {
        // Check for duplicate license number (excluding current user's license if updating)
        const existingLicense = await License.findOne({ licenseNumber });
        if (existingLicense && existingLicense.userId.toString() !== userId) {
            return res.status(400).json({ success: false, message: "License number already registered to another user" });
        }

        // Upsert: Update if exists for this user, else create
        const license = await License.findOneAndUpdate(
            { userId },
            {
                userId,
                licenseNumber,
                name,
                birthdate,
                address,
                sex,
                bloodType,
                restrictions,
                issuedDate,
                expiryDate,
                imageUrl,
                rawOcrText,
                isVerified: false // Reset verification on update
            },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "License saved successfully",
            license
        });

    } catch (error) {
        console.error("Save License Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Get License
export const getLicense = async (req, res) => {
    const { userId } = req.params;
    
    if (req.user._id.toString() !== userId) {
        return res.status(403).json({ success: false, message: "Unauthorized access to license" });
    }

    try {
        const license = await License.findOne({ userId });
        if (!license) return res.status(404).json({ success: false, message: "License not found" });

        res.status(200).json({
            success: true,
            license
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
