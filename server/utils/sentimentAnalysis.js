/**
 * Sentiment Analysis Utility using Hugging Face API
 * 
 * Uses Hugging Face's free inference API for sentiment analysis
 * to help validate and prioritize complaints based on emotional content.
 * 
 * Supports Taglish (Tagalog-English) for Filipino users using
 * multilingual XLM-RoBERTa model trained on Twitter data.
 */

// Multilingual model that supports Filipino/Tagalog/Taglish
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/cardiffnlp/twitter-xlm-roberta-base-sentiment';

// Backup model for English-only fallback
const HUGGINGFACE_BACKUP_URL = 'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english';

/**
 * Common Taglish negative words/phrases for additional detection
 * This helps improve accuracy for Filipino context
 */
const TAGLISH_NEGATIVE_INDICATORS = [
  // Strong negative
  'bastos', 'gago', 'bobo', 'tanga', 'putang', 'puta', 'tangina', 'leche',
  'bwisit', 'peste', 'hayop', 'animal', 'ulol', 'tarantado', 'gunggong',
  'pakyu', 'shit', 'shet', 'bullshit', 'wtf', 'amp', 'punyeta', 'pakshet',
  // Moderate negative  
  'nakakainis', 'nakakabwisit', 'nakakagalit', 'nakakatakot', 'nakakalungkot',
  'sobrang pangit', 'pangit', 'masama', 'masamang', 'malupit', 'grabe',
  'hindi maganda', 'walang kwenta', 'walang modo', 'walang galang',
  'di maganda', 'ang pangit', 'napaka pangit', 'sobrang sama',
  // Complaint-specific
  'overcharge', 'sobrang mahal', 'ang mahal', 'niloko', 'linoko', 'niloloko',
  'nagmura', 'minura', 'sinigaw', 'sinigawan', 'nagsigaw', 'nagalit',
  'lasing', 'lango', 'amoy alak', 'drunk', 'reckless', 'mabilis', 'sobrang bilis',
  'delikado', 'dangerous', 'takot', 'natakot', 'kinabahan', 'nakakatakot',
  'bastos na salita', 'masama ang loob', 'galit na galit', 'init ng ulo',
  'hindi professional', 'unprofessional', 'rude', 'disrespectful',
  'ayaw magbigay ng sukli', 'walang resibo', 'no receipt', 'di nagbigay',
];

const TAGLISH_POSITIVE_INDICATORS = [
  'maganda', 'magaling', 'mabait', 'maayos', 'goods', 'nice', 'okay lang',
  'salamat', 'thank you', 'thanks', 'appreciate', 'masaya', 'happy',
  'satisfied', 'good', 'great', 'excellent', 'best', 'helpful',
];

/**
 * Detect if text contains Taglish (mixed Tagalog-English)
 */
const detectTaglish = (text) => {
  const tagalogWords = [
    'ang', 'ng', 'sa', 'ko', 'ako', 'siya', 'niya', 'nya', 'kami', 'tayo', 'sila',
    'na', 'pa', 'lang', 'din', 'rin', 'ba', 'po', 'opo', 'hindi', 'oo', 'wala',
    'may', 'mga', 'yung', 'ung', 'yun', 'yan', 'ito', 'dito', 'dun', 'don',
    'kasi', 'kaya', 'pero', 'at', 'o', 'dahil', 'para', 'pag', 'kapag', 'kung',
    'talaga', 'sobra', 'grabe', 'naman', 'daw', 'raw', 'eh', 'ano', 'sino',
    'saan', 'kailan', 'paano', 'bakit', 'ganun', 'ganon', 'ganito', 'tapos',
  ];
  
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  const tagalogCount = words.filter(word => tagalogWords.includes(word)).length;
  
  return {
    isTaglish: tagalogCount >= 2 || tagalogCount / words.length > 0.1,
    tagalogWordCount: tagalogCount,
    totalWords: words.length,
  };
};

/**
 * Enhanced local sentiment analysis for Taglish
 */
const analyzeTaglishSentiment = (text) => {
  const lowerText = text.toLowerCase();
  
  let negativeScore = 0;
  let positiveScore = 0;
  let matchedNegative = [];
  let matchedPositive = [];
  
  // Check for negative indicators
  for (const indicator of TAGLISH_NEGATIVE_INDICATORS) {
    if (lowerText.includes(indicator)) {
      negativeScore += indicator.length > 5 ? 2 : 1; // Longer phrases = stronger signal
      matchedNegative.push(indicator);
    }
  }
  
  // Check for positive indicators
  for (const indicator of TAGLISH_POSITIVE_INDICATORS) {
    if (lowerText.includes(indicator)) {
      positiveScore += 1;
      matchedPositive.push(indicator);
    }
  }
  
  // Check for intensifiers (Tagalog)
  const intensifiers = ['sobra', 'grabe', 'napaka', 'todo', 'super', 'very', 'really', 'extremely'];
  const hasIntensifier = intensifiers.some(i => lowerText.includes(i));
  if (hasIntensifier) {
    negativeScore *= 1.5;
    positiveScore *= 1.5;
  }
  
  // Check for exclamation marks (emotional intensity)
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount >= 2) {
    negativeScore *= 1.2;
  }
  
  return {
    negativeScore,
    positiveScore,
    matchedNegative,
    matchedPositive,
    hasIntensifier,
    exclamationCount,
  };
};

/**
 * Analyze sentiment of text using Hugging Face API
 * @param {string} text - The text to analyze
 * @param {string} apiKey - Hugging Face API key (optional, uses free tier if not provided)
 * @returns {Promise<Object>} Sentiment analysis result
 */
export const analyzeSentiment = async (text, apiKey = null) => {
  try {
    // Truncate text if too long (model has token limit)
    const truncatedText = text.substring(0, 500);
    
    // Detect if text is Taglish
    const languageInfo = detectTaglish(truncatedText);
    
    // Run local Taglish analysis
    const taglishAnalysis = analyzeTaglishSentiment(truncatedText);
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add API key if provided (for higher rate limits)
    if (apiKey || process.env.HUGGINGFACE_API_KEY) {
      headers['Authorization'] = `Bearer ${apiKey || process.env.HUGGINGFACE_API_KEY}`;
    }
    
    // Try multilingual model first
    let response = await fetch(HUGGINGFACE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: truncatedText }),
    });
    
    // Fallback to English model if multilingual fails
    if (!response.ok && response.status !== 503) {
      console.log('🔄 Falling back to English model...');
      response = await fetch(HUGGINGFACE_BACKUP_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: truncatedText }),
      });
    }
    
    if (!response.ok) {
      // Handle rate limiting or model loading
      if (response.status === 503) {
        console.log('🔄 Model is loading, using local Taglish analysis');
        return getLocalAnalysisResult(taglishAnalysis, languageInfo);
      }
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Handle model loading response
    if (result.error && result.error.includes('loading')) {
      return getLocalAnalysisResult(taglishAnalysis, languageInfo);
    }
    
    // Parse the result from XLM-RoBERTa (format: [[{label: "negative", score: 0.99}, ...]])
    if (result && Array.isArray(result) && result[0]) {
      const sentiments = result[0];
      const scores = {};
      
      sentiments.forEach(item => {
        // XLM-RoBERTa uses lowercase labels: negative, neutral, positive
        const normalizedLabel = item.label.toUpperCase();
        scores[normalizedLabel] = item.score;
      });
      
      // Combine API results with local Taglish analysis for better accuracy
      let apiNegative = scores.NEGATIVE || scores.NEG || 0;
      let apiPositive = scores.POSITIVE || scores.POS || 0;
      let apiNeutral = scores.NEUTRAL || scores.NEU || 0;
      
      // Boost scores based on local Taglish analysis
      if (taglishAnalysis.negativeScore > 0) {
        const boost = Math.min(taglishAnalysis.negativeScore * 0.1, 0.3);
        apiNegative = Math.min(apiNegative + boost, 1);
        apiPositive = Math.max(apiPositive - boost * 0.5, 0);
      }
      
      // Determine primary sentiment
      let primarySentiment = 'neutral';
      let confidence = apiNeutral;
      
      if (apiNegative > apiPositive && apiNegative > apiNeutral) {
        primarySentiment = 'negative';
        confidence = apiNegative;
      } else if (apiPositive > apiNegative && apiPositive > apiNeutral) {
        primarySentiment = 'positive';
        confidence = apiPositive;
      }
      
      // Override with strong local signals
      if (taglishAnalysis.negativeScore >= 3 && primarySentiment !== 'negative') {
        primarySentiment = 'negative';
        confidence = Math.max(confidence, 0.75);
      }
      
      return {
        success: true,
        sentiment: primarySentiment,
        confidence,
        scores: {
          POSITIVE: apiPositive,
          NEGATIVE: apiNegative,
          NEUTRAL: apiNeutral,
        },
        isTaglish: languageInfo.isTaglish,
        taglishIndicators: {
          negativeWords: taglishAnalysis.matchedNegative,
          positiveWords: taglishAnalysis.matchedPositive,
        },
        isModelLoading: false,
      };
    }
    
    throw new Error('Unexpected API response format');
  } catch (error) {
    console.error('Sentiment analysis error:', error.message);
    // Return local analysis on error to not block complaint submission
    const languageInfo = detectTaglish(text);
    const taglishAnalysis = analyzeTaglishSentiment(text);
    return getLocalAnalysisResult(taglishAnalysis, languageInfo, error.message);
  }
};

/**
 * Get sentiment result from local Taglish analysis (fallback)
 */
const getLocalAnalysisResult = (taglishAnalysis, languageInfo, error = null) => {
  const { negativeScore, positiveScore } = taglishAnalysis;
  
  let sentiment = 'neutral';
  let confidence = 0.5;
  
  if (negativeScore > positiveScore && negativeScore >= 1) {
    sentiment = 'negative';
    confidence = Math.min(0.5 + negativeScore * 0.1, 0.9);
  } else if (positiveScore > negativeScore && positiveScore >= 1) {
    sentiment = 'positive';
    confidence = Math.min(0.5 + positiveScore * 0.1, 0.9);
  }
  
  return {
    success: !error,
    sentiment,
    confidence,
    scores: {
      POSITIVE: sentiment === 'positive' ? confidence : (1 - confidence) / 2,
      NEGATIVE: sentiment === 'negative' ? confidence : (1 - confidence) / 2,
      NEUTRAL: sentiment === 'neutral' ? confidence : 0.1,
    },
    isTaglish: languageInfo.isTaglish,
    taglishIndicators: {
      negativeWords: taglishAnalysis.matchedNegative,
      positiveWords: taglishAnalysis.matchedPositive,
    },
    isModelLoading: true,
    usedLocalAnalysis: true,
    error: error || null,
  };
};

/**
 * Calculate complaint severity based on sentiment and category
 * @param {Object} sentimentResult - Result from analyzeSentiment
 * @param {string} category - Complaint category
 * @returns {Object} Severity assessment
 */
export const calculateComplaintSeverity = (sentimentResult, category) => {
  // Base severity from category
  const categorySeverity = {
    harassment: 5,
    intoxicated_driving: 5,
    discrimination: 5,
    unsafe_driving: 4,
    overcharging: 3,
    rude_behavior: 3,
    refusal_of_service: 3,
    route_deviation: 2,
    vehicle_condition: 2,
    other: 2,
  };
  
  let baseScore = categorySeverity[category] || 2;
  let sentimentModifier = 0;
  
  // Adjust based on sentiment
  if (sentimentResult.sentiment === 'negative') {
    // High confidence negative sentiment increases severity
    sentimentModifier = sentimentResult.confidence >= 0.9 ? 1.5 : 
                        sentimentResult.confidence >= 0.7 ? 1 : 0.5;
  }
  
  const finalScore = Math.min(baseScore + sentimentModifier, 5);
  
  // Determine urgency level
  let urgency = 'normal';
  if (finalScore >= 4.5) urgency = 'critical';
  else if (finalScore >= 3.5) urgency = 'high';
  else if (finalScore >= 2.5) urgency = 'medium';
  else urgency = 'low';
  
  // Flags for potential issues
  const flags = {
    highlyNegative: sentimentResult.sentiment === 'negative' && sentimentResult.confidence >= 0.85,
    mayRequireImmediateAttention: finalScore >= 4,
    emotionallyCharged: sentimentResult.confidence >= 0.9,
  };
  
  return {
    severityScore: finalScore,
    maxScore: 5,
    urgency,
    categorySeverity: baseScore,
    sentimentImpact: sentimentModifier,
    flags,
    recommendation: getRecommendation(urgency, sentimentResult),
  };
};

/**
 * Get recommendation based on severity assessment
 */
const getRecommendation = (urgency, sentimentResult) => {
  const recommendations = {
    critical: 'IMMEDIATE ACTION REQUIRED: This complaint requires urgent admin attention. The emotional intensity and category suggest a serious incident.',
    high: 'HIGH PRIORITY: Review within 24 hours. The complaint indicates significant distress and potential safety concerns.',
    medium: 'STANDARD PRIORITY: Process within normal review timeline (48-72 hours).',
    low: 'LOW PRIORITY: Review as time permits. May be suitable for batch processing.',
    normal: 'NORMAL PROCESSING: Follow standard complaint review procedures.',
  };
  
  return recommendations[urgency] || recommendations.normal;
};

/**
 * Validate complaint description quality
 * Enhanced for Taglish/Filipino users
 * @param {string} description - Complaint description
 * @param {Object} sentimentResult - Sentiment analysis result
 * @returns {Object} Validation result
 */
export const validateComplaintDescription = (description, sentimentResult) => {
  const issues = [];
  const suggestions = [];
  let qualityScore = 100;
  
  // Check length
  if (description.length < 50) {
    issues.push('Description is too short');
    suggestions.push('Magdagdag pa ng detalye tungkol sa nangyari (Please provide more details about the incident)');
    qualityScore -= 30;
  } else if (description.length < 100) {
    suggestions.push('Mas mainam kung magdagdag ka pa ng konteksto (Consider adding more context about what happened)');
    qualityScore -= 10;
  }
  
  // Check for specific details (dates, times, locations) - including Tagalog patterns
  const hasTimeReference = /\d{1,2}:\d{2}|morning|afternoon|evening|night|around \d|umaga|hapon|gabi|tanghali|alas|ala-|mga \d|bandang \d/i.test(description);
  const hasLocationReference = /at|near|along|in front|beside|corner|street|road|barangay|brgy|sa may|sa tapat|sa gilid|sa likod|sa harap|kanto|kalsada|daan/i.test(description);
  
  if (!hasTimeReference) {
    suggestions.push('Isama ang oras ng pangyayari (Include the approximate time of the incident)');
  }
  
  if (!hasLocationReference) {
    suggestions.push('Isama kung saan ito nangyari (Add location details to strengthen your complaint)');
  }
  
  // Check sentiment coherence with complaint
  if (sentimentResult.sentiment === 'positive' && sentimentResult.confidence > 0.8) {
    issues.push('The tone of your description seems inconsistent with a complaint');
    suggestions.push('Siguraduhing tama ang pagkakasulat ng reklamo (Please ensure your description accurately reflects the incident)');
    qualityScore -= 20;
  }
  
  // Check for all caps (shouting)
  const capsRatio = (description.match(/[A-Z]/g) || []).length / description.length;
  if (capsRatio > 0.5 && description.length > 20) {
    suggestions.push('Iwasan ang paggamit ng lahat ng capital letters (Please avoid using all capital letters)');
    qualityScore -= 5;
  }
  
  // Check for excessive punctuation
  const excessivePunctuation = /[!?]{3,}/.test(description);
  if (excessivePunctuation) {
    qualityScore -= 5;
  }
  
  // Bonus for providing good Taglish details
  if (sentimentResult.isTaglish && sentimentResult.taglishIndicators?.negativeWords?.length > 0) {
    // They're expressing themselves in their native language - that's good
    qualityScore = Math.min(qualityScore + 5, 100);
  }
  
  return {
    isValid: issues.length === 0,
    qualityScore: Math.max(0, qualityScore),
    issues,
    suggestions,
    hasGoodDetails: hasTimeReference && hasLocationReference,
    isTaglish: sentimentResult.isTaglish || false,
  };
};

/**
 * Full sentiment analysis for complaints
 * Combines sentiment analysis, severity calculation, and validation
 */
export const analyzeComplaint = async (description, category) => {
  // Run sentiment analysis
  const sentimentResult = await analyzeSentiment(description);
  
  // Calculate severity
  const severityAssessment = calculateComplaintSeverity(sentimentResult, category);
  
  // Validate description
  const validationResult = validateComplaintDescription(description, sentimentResult);
  
  return {
    sentiment: sentimentResult,
    severity: severityAssessment,
    validation: validationResult,
    summary: {
      overallUrgency: severityAssessment.urgency,
      requiresImmediateAttention: severityAssessment.flags.mayRequireImmediateAttention,
      descriptionQuality: validationResult.qualityScore >= 70 ? 'good' : validationResult.qualityScore >= 40 ? 'fair' : 'poor',
    },
  };
};

export default {
  analyzeSentiment,
  calculateComplaintSeverity,
  validateComplaintDescription,
  analyzeComplaint,
};
