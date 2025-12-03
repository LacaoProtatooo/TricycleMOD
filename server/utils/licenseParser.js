/**
 * Parses raw OCR text lines into structured license fields.
 * This is a heuristic parser based on typical LTO Driver's License format.
 */
export const parseLicenseText = (ocrResult) => {
    // Flatten the OCR result if it's nested
    let lines = [];
    if (ocrResult && typeof ocrResult === 'object') {
        if (ocrResult.lines && Array.isArray(ocrResult.lines)) {
             lines = ocrResult.lines.map(l => l.text);
        } else if (Array.isArray(ocrResult)) {
             lines = ocrResult.map(item => {
                 if (typeof item === 'string') return item;
                 if (item.text) return item.text;
                 if (Array.isArray(item) && item.length > 1 && Array.isArray(item[1])) {
                     return item[1][0];
                 }
                 return '';
             });
        }
    }

    const data = {
        licenseNumber: '',
        name: '',
        birthdate: '',
        address: '',
        sex: '',
        bloodType: '',
        restrictions: '',
        issued: '',
        expiry: ''
    };

    // Helper to clean text
    const clean = (str) => str ? str.trim() : '';

    // Regex patterns
    // License: L02-12-123456 (Letter, 2 digits, dash, 2 digits, dash, 6 digits)
    // Allow for missing dashes or spaces
    const licensePattern = /([A-Z])\s?(\d{2})[\s-]?(\d{2})[\s-]?(\d{6})/;
    
    // Date: YYYY/MM/DD or YYYY-MM-DD
    const datePattern = /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/;
    
    // Iterate lines to find patterns
    for (let i = 0; i < lines.length; i++) {
        const line = clean(lines[i]);
        const lowerLine = line.toLowerCase();
        
        // License Number
        // Look for "License No" label
        if (!data.licenseNumber) {
            if (lowerLine.includes('license no') || lowerLine.includes('lic no')) {
                // Check same line
                let match = line.match(licensePattern);
                if (match) {
                    data.licenseNumber = `${match[1]}${match[2]}-${match[3]}-${match[4]}`;
                } else if (lines[i+1]) {
                    // Check next line
                    match = lines[i+1].match(licensePattern);
                    if (match) {
                        data.licenseNumber = `${match[1]}${match[2]}-${match[3]}-${match[4]}`;
                    }
                }
            }
            // Fallback: just regex
            if (!data.licenseNumber) {
                const match = line.match(licensePattern);
                if (match) {
                    data.licenseNumber = `${match[1]}${match[2]}-${match[3]}-${match[4]}`;
                }
            }
        }

        // Dates (Expiry, Birth, Issued)
        if (lowerLine.includes('expiration') || lowerLine.includes('exp')) {
             const match = line.match(datePattern);
             if (match) data.expiry = match[0];
             else if (lines[i+1]) {
                 const nextMatch = lines[i+1].match(datePattern);
                 if (nextMatch) data.expiry = nextMatch[0];
             }
        }
        
        if (lowerLine.includes('birth') || lowerLine.includes('dob')) {
             const match = line.match(datePattern);
             if (match) data.birthdate = match[0];
             else if (lines[i+1]) {
                 const nextMatch = lines[i+1].match(datePattern);
                 if (nextMatch) data.birthdate = nextMatch[0];
             }
        }

        // Issued Date (often near Agency or just "Date Issued")
        // Note: This is harder to distinguish from other dates if not labeled clearly
        /* 
        if (!data.issued && (lowerLine.includes('issued') || lowerLine.includes('date issued'))) {
             const match = line.match(datePattern);
             if (match) data.issued = match[0];
             else if (lines[i+1]) {
                 const nextMatch = lines[i+1].match(datePattern);
                 if (nextMatch) data.issued = nextMatch[0];
             }
        }
        */

        // Sex / Gender
        if (!data.sex) {
            if (lowerLine.includes('sex') || lowerLine.includes('gender')) {
                if (line.match(/\b(M|Male)\b/i)) data.sex = 'M';
                else if (line.match(/\b(F|Female)\b/i)) data.sex = 'F';
                else if (lines[i+1]) {
                    if (lines[i+1].match(/\b(M|Male)\b/i)) data.sex = 'M';
                    else if (lines[i+1].match(/\b(F|Female)\b/i)) data.sex = 'F';
                }
            } else if (line === 'M' || line === 'F') {
                data.sex = line;
            }
        }

        // Blood Type
        if (!data.bloodType && lowerLine.includes('blood')) {
             // Check same line
             // Matches A, B, AB, O with optional + or - (including en-dash/em-dash)
             const bloodRegex = /\b(A|B|AB|O)\s?[\+\-−]?\b/i;
             let match = line.match(bloodRegex);
             if (match) {
                 data.bloodType = match[0].replace(/\s/g, '').toUpperCase();
             } else if (lines[i+1]) {
                 // Check next line
                 match = lines[i+1].match(bloodRegex);
                 if (match) {
                     data.bloodType = match[0].replace(/\s/g, '').toUpperCase();
                 }
             }
        }

        // Restrictions / DL Codes
        if (!data.restrictions && (lowerLine.includes('restrictions') || lowerLine.includes('dl codes') || lowerLine.includes('conditions'))) {
             // Look for alphanumeric codes (e.g., 1, 2, A, B, A1, etc.)
             // Usually short codes separated by commas or spaces. 
             // We look for a sequence of 1-2 alphanumeric chars, separated by comma/space
             const codeRegex = /\b([A-Z0-9]{1,2}(?:[\s,]+[A-Z0-9]{1,2})*)\b/;
             
             // Check if value is on the same line after the label
             const parts = line.split(/restrictions|dl codes|conditions/i);
             if (parts[1] && parts[1].trim().length > 0) {
                 const val = parts[1].replace(/[:\.]/g, '').trim();
                 // Validate it looks like codes
                 if (val.match(codeRegex)) {
                     data.restrictions = val;
                 }
             } 
             
             if (!data.restrictions && lines[i+1]) {
                 // Check next line
                 const nextLine = clean(lines[i+1]);
                 // It shouldn't be a date or another label
                 if (!nextLine.match(datePattern) && !nextLine.toLowerCase().includes('conditions')) {
                     // Try to extract just the codes if there's noise
                     const match = nextLine.match(codeRegex);
                     if (match) {
                         data.restrictions = match[0];
                     } else {
                         // Fallback: take the whole line if it's short enough
                         if (nextLine.length < 20) data.restrictions = nextLine;
                     }
                 }
             }
        }

        // Name
        // Strategy: Look for "Last Name, First Name" format (comma separated)
        // Or look for "Name" label
        if (!data.name) {
            // Ignore placeholder text
            if (lowerLine.includes('last name') && lowerLine.includes('first name')) {
                continue; 
            }

            if (line.includes(',')) {
                // Check if it looks like a name (no numbers, not an address)
                // LTO names are usually uppercase: SURNAME, GIVEN NAME
                if (!lowerLine.includes('city') && !lowerLine.includes('street') && !line.match(/\d/) && line === line.toUpperCase()) {
                    data.name = line;
                }
            } else if (lowerLine.startsWith('name')) {
                // If "Name" label is found, look at next line
                if (lines[i+1]) {
                    const nextLine = clean(lines[i+1]);
                    if (!nextLine.toLowerCase().includes('last name')) {
                         data.name = nextLine;
                    }
                }
            }
        }
        
        // Address
        if (!data.address) {
            if (lowerLine.includes('address')) {
                 if (lines[i+1]) data.address = lines[i+1];
                 // Sometimes address spans multiple lines
                 if (lines[i+2] && !lines[i+2].match(datePattern) && !lines[i+2].toLowerCase().includes('license')) {
                     data.address += ' ' + lines[i+2];
                 }
            }
        }
    }

    // Remove issued date logic as requested
    delete data.issued;

    return data;
};

