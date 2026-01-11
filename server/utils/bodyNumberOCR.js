/**
 * Body Number OCR Detection Utility
 * Extracts tricycle body numbers from images using PaddleOCR
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Pattern for Philippine tricycle body numbers (typically 3-4 digits)
const BODY_NUMBER_PATTERNS = [
  /^(\d{4})$/,           // Exactly 4 digits (e.g., 0001, 1234)
  /^(\d{3})$/,           // Exactly 3 digits (e.g., 001, 123)
  /^(\d{1,2})$/,         // 1-2 digits for smaller fleets
  /^[0O]?(\d{3,4})$/,    // Leading O (often confused with 0)
  /^(\d{3,4})[A-Z]?$/,   // Body number with optional suffix letter
];

// OCR often confuses these characters
const OCR_CORRECTIONS = {
  'O': '0',
  'o': '0',
  'l': '1',
  'I': '1',
  'Z': '2',
  'S': '5',
  'B': '8',
  'G': '6',
};

/**
 * Clean and normalize OCR text for body number extraction
 */
const normalizeOCRText = (text) => {
  if (!text) return '';
  
  let cleaned = text.toString().trim().toUpperCase();
  
  // Apply OCR corrections
  for (const [wrong, correct] of Object.entries(OCR_CORRECTIONS)) {
    cleaned = cleaned.replace(new RegExp(wrong, 'g'), correct);
  }
  
  // Remove common noise characters
  cleaned = cleaned.replace(/[^0-9A-Z]/g, '');
  
  return cleaned;
};

/**
 * Extract potential body numbers from OCR results
 */
const extractBodyNumbers = (ocrResult) => {
  const candidates = [];
  
  // Get all text lines from OCR result
  const lines = [];
  
  if (ocrResult?.lines) {
    ocrResult.lines.forEach(line => {
      const text = line.text || line.raw || '';
      const confidence = line.confidence || 0;
      if (text) {
        lines.push({ text, confidence });
      }
    });
  }
  
  // Also check raw texts array if available
  if (ocrResult?.texts) {
    ocrResult.texts.forEach(text => {
      if (typeof text === 'string') {
        lines.push({ text, confidence: 0.5 });
      } else if (text?.text) {
        lines.push({ text: text.text, confidence: text.confidence || 0.5 });
      }
    });
  }
  
  // Process each line
  for (const line of lines) {
    const normalized = normalizeOCRText(line.text);
    
    // Skip if too long (body numbers are typically short)
    if (normalized.length > 6) continue;
    
    // Check against body number patterns
    for (const pattern of BODY_NUMBER_PATTERNS) {
      const match = normalized.match(pattern);
      if (match) {
        const bodyNumber = match[1] || match[0];
        
        // Pad to 4 digits if 3 digits
        const paddedNumber = bodyNumber.padStart(4, '0');
        
        candidates.push({
          value: paddedNumber,
          original: line.text,
          confidence: line.confidence,
          pattern: pattern.toString()
        });
      }
    }
  }
  
  // Sort by confidence (highest first)
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  // Remove duplicates (keep highest confidence)
  const seen = new Set();
  const unique = candidates.filter(c => {
    if (seen.has(c.value)) return false;
    seen.add(c.value);
    return true;
  });
  
  return unique;
};

/**
 * Resolve the path to the OCR Python script
 */
const resolveOcrScriptPath = () => {
  const scriptCandidates = [
    path.join(process.cwd(), 'ocr', 'paddle_scan.py'),
    path.join(process.cwd(), 'server', 'ocr', 'paddle_scan.py'),
    path.join(process.cwd(), '..', 'server', 'ocr', 'paddle_scan.py'),
  ];

  for (const candidate of scriptCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (error) {
      // ignore fs permission errors and continue
    }
  }

  return null;
};

/**
 * Run PaddleOCR on an image file
 */
const runOCR = async (imagePath) => {
  const scriptPath = resolveOcrScriptPath();
  
  if (!scriptPath) {
    throw new Error('OCR script not found on server');
  }
  
  const isWindows = process.platform === 'win32';
  const pythonCommands = isWindows 
    ? ['py', 'python', 'python3'] 
    : ['python3', 'python'];
  
  // Check for virtual environment
  const venvPaths = [
    path.join(process.cwd(), '.venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
    path.join(process.cwd(), 'venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
  ];
  
  for (const vp of venvPaths) {
    if (fs.existsSync(vp)) {
      pythonCommands.unshift(vp);
      break;
    }
  }
  
  const trySpawn = (cmd) => new Promise((resolve, reject) => {
    const args = [scriptPath, imagePath, '--lang', 'en'];
    
    let proc;
    try {
      proc = spawn(cmd, args, { shell: false, cwd: process.cwd() });
    } catch (error) {
      return reject({ code: 'spawn_error', error });
    }
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    
    const timeout = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      reject({ code: 'timeout', error: new Error('OCR timed out') });
    }, 30000);
    
    proc.on('error', (error) => {
      clearTimeout(timeout);
      reject({ code: 'spawn_error', error });
    });
    
    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr, cmd });
    });
  });
  
  let result = null;
  
  for (const cmd of pythonCommands) {
    try {
      const attempt = await trySpawn(cmd);
      if (attempt.code === 0 && attempt.stdout) {
        result = attempt;
        break;
      }
      if (!result && attempt.stdout) {
        result = attempt;
      }
    } catch (err) {
      // Try next command
    }
  }
  
  if (!result || !result.stdout) {
    throw new Error('Failed to execute OCR');
  }
  
  return JSON.parse(result.stdout);
};

/**
 * Detect body number from an image
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<{success: boolean, bodyNumber?: string, confidence?: number, candidates?: Array, error?: string}>}
 */
export const detectBodyNumber = async (imagePath) => {
  try {
    // Verify image exists
    if (!fs.existsSync(imagePath)) {
      return {
        success: false,
        error: 'Image file not found'
      };
    }
    
    // Run OCR
    const ocrResult = await runOCR(imagePath);
    
    if (ocrResult.error) {
      return {
        success: false,
        error: ocrResult.error
      };
    }
    
    // Extract body numbers
    const candidates = extractBodyNumbers(ocrResult);
    
    if (candidates.length === 0) {
      return {
        success: false,
        error: 'No body number detected in image',
        rawText: ocrResult?.lines?.map(l => l.text || l.raw).join(' ') || ''
      };
    }
    
    // Return best match
    const best = candidates[0];
    
    return {
      success: true,
      bodyNumber: best.value,
      confidence: Math.round(best.confidence * 100),
      original: best.original,
      candidates: candidates.slice(0, 5), // Return top 5 candidates
      rawText: ocrResult?.lines?.map(l => l.text || l.raw).join(' ') || ''
    };
    
  } catch (error) {
    console.error('Body number detection error:', error);
    return {
      success: false,
      error: error.message || 'Failed to detect body number'
    };
  }
};

/**
 * Validate a body number format
 * @param {string} bodyNumber - The body number to validate
 * @returns {boolean}
 */
export const isValidBodyNumber = (bodyNumber) => {
  if (!bodyNumber) return false;
  const normalized = normalizeOCRText(bodyNumber);
  return BODY_NUMBER_PATTERNS.some(pattern => pattern.test(normalized));
};

/**
 * Format body number to standard 4-digit format
 * @param {string} bodyNumber - The body number to format
 * @returns {string}
 */
export const formatBodyNumber = (bodyNumber) => {
  if (!bodyNumber) return '';
  const normalized = normalizeOCRText(bodyNumber);
  // Extract only digits
  const digits = normalized.replace(/\D/g, '');
  // Pad to 4 digits
  return digits.padStart(4, '0');
};

export default {
  detectBodyNumber,
  isValidBodyNumber,
  formatBodyNumber
};
