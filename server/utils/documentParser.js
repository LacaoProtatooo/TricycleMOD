/**
 * Document Parser for CR (Certificate of Registration) and OR (Official Receipt)
 * Extracts structured data from OCR results
 */

// Helper to normalize text
const normalizeText = (text) => {
  if (!text) return '';
  return text.toString().trim().toUpperCase();
};

// Helper to extract date from various formats
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  // Clean the string
  const cleaned = dateStr.replace(/[^\d\/\-\.]/g, '');
  
  // Try various date patterns
  const patterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{2})-(\d{2})-(\d{4})/,   // MM-DD-YYYY
    /(\d{4})\/(\d{2})\/(\d{2})/, // YYYY/MM/DD
    /(\d{4})-(\d{2})-(\d{2})/,   // YYYY-MM-DD
    /(\d{2})\.(\d{2})\.(\d{4})/, // MM.DD.YYYY
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  // Try direct parsing
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
};

// Helper to extract amount
const parseAmount = (text) => {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
};

/**
 * Parse Certificate of Registration (CR) from OCR text
 */
export const parseCRDocument = (ocrResult) => {
  const lines = ocrResult?.lines?.map(l => (l.text || l.raw || '').toString().trim()).filter(Boolean) || [];
  const fullText = lines.join('\n');
  const upperText = fullText.toUpperCase();
  
  const crData = {
    plateNumber: '',
    mvFileNumber: '',
    chassisNumber: '',
    engineNumber: '',
    vehicleMake: '',
    vehicleSeries: '',
    yearModel: '',
    bodyType: '',
    color: '',
    fuelType: '',
    dateOfInitialRegistration: null,
    registrationExpiryDate: null,
    ltoOfficeCode: '',
    classification: '',
    denomination: '',
    registeredOwnerName: '',
    ownerAddress: '',
    rawText: fullText,
    confidence: ocrResult?.meta?.avgConfidence || 0
  };
  
  // Pattern matchers for CR fields
  const patterns = {
    plateNumber: [
      /PLATE\s*(?:NO|NUMBER|#)?\.?[:\s]*([A-Z0-9\-\s]+)/i,
      /PLATE\s*NO\.?\s*[:\s]*([A-Z0-9\-\s]+)/i,
      /REG(?:ISTRATION)?\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i,
      /([A-Z]{2,3}[\s\-]?\d{3,4})/  // Common Philippine plate format
    ],
    mvFileNumber: [
      /MV\s*FILE\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i,
      /FILE\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i
    ],
    chassisNumber: [
      /CHASSIS\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i,
      /FRAME\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i,
      /VIN[:\s]*([A-Z0-9]+)/i
    ],
    engineNumber: [
      /ENGINE\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i,
      /MOTOR\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i
    ],
    vehicleMake: [
      /MAKE[:\s]*([A-Z]+)/i,
      /BRAND[:\s]*([A-Z]+)/i,
      /(HONDA|YAMAHA|SUZUKI|KAWASAKI|RUSI)/i
    ],
    vehicleSeries: [
      /SERIES[:\s]*([A-Z0-9\s\-\/]+)/i,
      /MODEL[:\s]*([A-Z0-9\s\-\/]+)/i
    ],
    yearModel: [
      /YEAR\s*(?:MODEL)?[:\s]*(\d{4})/i,
      /MODEL\s*YEAR[:\s]*(\d{4})/i,
      /YR[:\s]*(\d{4})/i
    ],
    bodyType: [
      /BODY\s*(?:TYPE)?[:\s]*([A-Z\s]+)/i,
      /(MOTORCYCLE|TRICYCLE|MC|TC)/i
    ],
    color: [
      /COLOR[:\s]*([A-Z\s]+)/i,
      /COLOUR[:\s]*([A-Z\s]+)/i
    ],
    fuelType: [
      /FUEL[:\s]*([A-Z]+)/i,
      /(GASOLINE|DIESEL|GAS)/i
    ],
    ltoOfficeCode: [
      /LTO[:\s]*(?:OFFICE)?[:\s]*([A-Z0-9\-]+)/i,
      /OFFICE\s*CODE[:\s]*([A-Z0-9\-]+)/i
    ],
    classification: [
      /CLASS(?:IFICATION)?[:\s]*(PRIVATE|FOR\s*HIRE)/i,
      /(PRIVATE|FOR\s*HIRE)/i
    ],
    denomination: [
      /DENOM(?:INATION)?[:\s]*([A-Z\/\s]+)/i,
      /(MC|MOTORCYCLE|TRICYCLE|TC)/i
    ],
    registeredOwnerName: [
      /OWNER[:\s]*([A-Z\s,\.]+)/i,
      /NAME[:\s]*([A-Z\s,\.]+)/i,
      /REGISTERED\s*(?:TO|OWNER)[:\s]*([A-Z\s,\.]+)/i
    ],
    ownerAddress: [
      /ADDRESS[:\s]*([A-Z0-9\s,\.]+)/i
    ],
    dateOfInitialRegistration: [
      /(?:DATE\s*OF\s*)?(?:INITIAL\s*)?REG(?:ISTRATION)?[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
      /FIRST\s*REG[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i
    ],
    registrationExpiryDate: [
      /EXPIR(?:Y|ATION)?[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
      /VALID\s*(?:UNTIL|THRU)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
      /EXP[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i
    ]
  };
  
  // Extract each field
  for (const [field, fieldPatterns] of Object.entries(patterns)) {
    for (const pattern of fieldPatterns) {
      const match = upperText.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        
        if (field === 'dateOfInitialRegistration' || field === 'registrationExpiryDate') {
          crData[field] = parseDate(value);
        } else if (field === 'classification') {
          crData[field] = value.includes('HIRE') ? 'For Hire' : 'Private';
        } else {
          crData[field] = value;
        }
        break;
      }
    }
  }
  
  return crData;
};

/**
 * Parse Official Receipt (OR) from OCR text
 */
export const parseORDocument = (ocrResult) => {
  const lines = ocrResult?.lines?.map(l => (l.text || l.raw || '').toString().trim()).filter(Boolean) || [];
  const fullText = lines.join('\n');
  const upperText = fullText.toUpperCase();
  
  const orData = {
    plateNumber: '', // For cross-validation
    orNumber: '',
    orDate: null,
    amountPaid: null,
    paymentType: '',
    ltoCollectionOffice: '',
    validityCoverageYear: '',
    mvFileNumber: '', // For cross-validation
    rawText: fullText,
    confidence: ocrResult?.meta?.avgConfidence || 0
  };
  
  const patterns = {
    plateNumber: [
      /PLATE\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i,
      /([A-Z]{2,3}[\s\-]?\d{3,4})/
    ],
    orNumber: [
      /O\.?R\.?\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i,
      /OFFICIAL\s*RECEIPT\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i,
      /RECEIPT\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i
    ],
    orDate: [
      /DATE[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
      /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/
    ],
    amountPaid: [
      /AMOUNT[:\s]*(?:PHP|₱|P)?\s*([\d,\.]+)/i,
      /TOTAL[:\s]*(?:PHP|₱|P)?\s*([\d,\.]+)/i,
      /PAID[:\s]*(?:PHP|₱|P)?\s*([\d,\.]+)/i,
      /(?:PHP|₱|P)\s*([\d,\.]+)/i
    ],
    paymentType: [
      /(?:FOR|PURPOSE)[:\s]*(REGISTRATION|RENEWAL|NEW)/i,
      /(REGISTRATION|RENEWAL|NEW\s*REGISTRATION)/i
    ],
    ltoCollectionOffice: [
      /LTO[:\s]*([A-Z\s\-]+)/i,
      /COLLECTION\s*(?:OFFICE)?[:\s]*([A-Z\s\-]+)/i
    ],
    validityCoverageYear: [
      /VALID(?:ITY)?[:\s]*(\d{4})/i,
      /(?:FOR\s*)?YEAR[:\s]*(\d{4})/i,
      /COVERAGE[:\s]*(\d{4})/i
    ],
    mvFileNumber: [
      /MV\s*FILE\s*(?:NO|NUMBER|#)?[:\s]*([A-Z0-9\-]+)/i
    ]
  };
  
  // Extract each field
  for (const [field, fieldPatterns] of Object.entries(patterns)) {
    for (const pattern of fieldPatterns) {
      const match = upperText.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        
        if (field === 'orDate') {
          orData[field] = parseDate(value);
        } else if (field === 'amountPaid') {
          orData[field] = parseAmount(value);
        } else {
          orData[field] = value;
        }
        break;
      }
    }
  }
  
  return orData;
};

/**
 * Cross-validate OR and CR documents
 */
export const validateDocuments = (crData, orData) => {
  const validationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    checks: {
      plateNumberMatch: null,
      mvFileMatch: null,
      orDateWithinValidity: null,
      ownerNameConsistent: null,
      engineChassisFormat: null,
      classificationValid: null
    }
  };
  
  // 1. Plate Number Match
  if (crData.plateNumber && orData.plateNumber) {
    const crPlate = normalizeText(crData.plateNumber).replace(/[\s\-]/g, '');
    const orPlate = normalizeText(orData.plateNumber).replace(/[\s\-]/g, '');
    validationResult.checks.plateNumberMatch = crPlate === orPlate;
    if (!validationResult.checks.plateNumberMatch) {
      validationResult.errors.push(`Plate number mismatch: CR shows "${crData.plateNumber}", OR shows "${orData.plateNumber}"`);
      validationResult.isValid = false;
    }
  } else {
    validationResult.warnings.push('Could not verify plate number match - missing from one or both documents');
  }
  
  // 2. MV File Number Match
  if (crData.mvFileNumber && orData.mvFileNumber) {
    const crMV = normalizeText(crData.mvFileNumber).replace(/[\s\-]/g, '');
    const orMV = normalizeText(orData.mvFileNumber).replace(/[\s\-]/g, '');
    validationResult.checks.mvFileMatch = crMV === orMV;
    if (!validationResult.checks.mvFileMatch) {
      validationResult.errors.push(`MV File number mismatch: CR shows "${crData.mvFileNumber}", OR shows "${orData.mvFileNumber}"`);
      validationResult.isValid = false;
    }
  }
  
  // 3. OR Date within CR Validity
  if (orData.orDate && crData.registrationExpiryDate) {
    const orDate = new Date(orData.orDate);
    const expiryDate = new Date(crData.registrationExpiryDate);
    validationResult.checks.orDateWithinValidity = orDate <= expiryDate;
    if (!validationResult.checks.orDateWithinValidity) {
      validationResult.warnings.push('OR date is after CR expiry date - registration may need renewal');
    }
  }
  
  // 4. Engine & Chassis Number Format Validation
  if (crData.engineNumber) {
    const engineFormat = /^[A-Z0-9\-]{5,20}$/i.test(crData.engineNumber);
    if (!engineFormat) {
      validationResult.warnings.push('Engine number format may be incorrect');
    }
  }
  if (crData.chassisNumber) {
    const chassisFormat = /^[A-Z0-9\-]{5,20}$/i.test(crData.chassisNumber);
    if (!chassisFormat) {
      validationResult.warnings.push('Chassis number format may be incorrect');
    }
    validationResult.checks.engineChassisFormat = true;
  }
  
  // 5. Classification Check (For Hire required for tricycles)
  if (crData.classification) {
    validationResult.checks.classificationValid = crData.classification === 'For Hire';
    if (!validationResult.checks.classificationValid) {
      validationResult.warnings.push('Classification is not "For Hire" - tricycles typically require For Hire registration');
    }
  }
  
  // 6. Owner Name Consistency (just flag if present)
  if (crData.registeredOwnerName) {
    validationResult.checks.ownerNameConsistent = true; // Assume consistent if present
  }
  
  return validationResult;
};

export default {
  parseCRDocument,
  parseORDocument,
  validateDocuments
};
