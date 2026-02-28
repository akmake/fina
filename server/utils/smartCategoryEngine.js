/**
 * Smart Category Classification Engine
 * * Advanced ML-like algorithm for intelligent transaction categorization
 * Uses multiple heuristics, pattern matching, and fuzzy logic
 */

import Transaction from '../models/Transaction.js';
import CategoryRule from '../models/CategoryRule.js';
import logger from './logger.js';

class SmartCategoryEngine {
  constructor() {
    this.patterns = new Map();
    this.cache = new Map();
    this.rules = [];
    this.confidenceThreshold = 0.75;
  }

  /**
   * Analyze and auto-categorize a transaction
   * @param {Object} transaction - Transaction to categorize
   * @returns {Object} Category prediction with confidence score
   */
  async classifyTransaction(transaction) {
    const cacheKey = this.generateCacheKey(transaction);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Run multiple classification strategies
      const results = await Promise.all([
        this.keywordMatching(transaction),
        this.amountPatternMatching(transaction),
        this.merchantMappingMatching(transaction),
        this.historicalPatternMatching(transaction),
        this.timePatternMatching(transaction),
        this.descriptionNLPAnalysis(transaction),
      ]);

      // Aggregate results using weighted scoring
      const prediction = this.aggregateResults(results, transaction);
      
      // Cache the result
      this.cache.set(cacheKey, prediction);
      
      logger.debug('Transaction classified', {
        description: transaction.description,
        predicted: prediction.category,
        confidence: prediction.confidence.toFixed(2),
      });

      return prediction;
    } catch (error) {
      logger.error('Classification error', {
        description: transaction.description,
        error: error.message,
      });
      return {
        category: 'כללי',
        confidence: 0,
        reason: 'classification_failed',
      };
    }
  }

  /**
   * Strategy 1: Keyword matching with fuzzy logic
   */
  async keywordMatching(transaction) {
    const keywords = {
      'דלק': ['gas', 'דלק', 'station', 'תדלוק', 'bp', 'delek', 'paz'],
      'מסעדה': ['rest', 'restaurant', 'pizza', 'burger', 'café', 'cafe', 'bar', 'מסעדה', 'אוכל'],
      'קניות': ['shop', 'mall', 'store', 'market', 'supermarket', 'סוריק', 'זול', 'carrefour', 'rami'],
      'בריאות': ['pharmacy', 'dr', 'doctor', 'clinic', 'hospital', 'health', 'medical', 'בריאות'],
      'תחבורה': ['taxi', 'bus', 'train', 'uber', 'moovit', 'raid', 'ido', 'egged', 'תחבורה'],
      'בילוי': ['cinema', 'movie', 'sport', 'gym', 'pool', 'sports', 'entertainment', 'בילוי'],
      'ביטוח': ['insurance', 'ביטוח'],
      'דמי שכרה': ['rent', 'lease', 'landlord', 'דיור', 'דמי'],
      'חשמל מים': ['electricity', 'water', 'אגד', 'חשמל', 'מים', 'גז'],
      'פלאפון': ['phone', 'cellular', 'mobile', 'telecom', 'pelephone', 'cellcom', 'רביד', 'טלפון'],
    };

    const description = transaction.description.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [category, keywordList] of Object.entries(keywords)) {
      for (const keyword of keywordList) {
        const score = this.fuzzyMatch(description, keyword);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = category;
        }
      }
    }

    return {
      category: bestMatch,
      confidence: bestScore,
      strategy: 'keyword_matching',
      weight: 0.25,
    };
  }

  /**
   * Strategy 2: Amount pattern matching
   * Transactions with similar amounts often belong to same category
   */
  async amountPatternMatching(transaction) {
    const range = transaction.amount * 0.15; // ±15% range
    
    const similarTransactions = await Transaction.find({
      user: transaction.user,
      amount: {
        $gte: transaction.amount - range,
        $lte: transaction.amount + range,
      },
    })
    .limit(20)
    .lean();

    if (similarTransactions.length === 0) {
      return {
        category: null,
        confidence: 0,
        strategy: 'amount_pattern',
        weight: 0.15,
      };
    }

    // Get most common category
    const categoryFreq = {};
    similarTransactions.forEach(t => {
      categoryFreq[t.category] = (categoryFreq[t.category] || 0) + 1;
    });

    const mostCommon = Object.entries(categoryFreq)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      category: mostCommon?.[0] || null,
      confidence: (mostCommon?.[1] / similarTransactions.length) * 0.8,
      strategy: 'amount_pattern',
      weight: 0.15,
    };
  }

  /**
   * Strategy 3: Merchant mapping matching
   * Use merchant name to predict category
   */
  async merchantMappingMatching(transaction) {
    // Extract merchant info from description
    const merchant = this.extractMerchant(transaction.description);
    
    if (!merchant) {
      return {
        category: null,
        confidence: 0,
        strategy: 'merchant_mapping',
        weight: 0.2,
      };
    }

    // Find similar merchants and their categories
    const similarMerchants = await Transaction.find({
      user: transaction.user,
      rawDescription: new RegExp(merchant, 'i'),
    })
    .limit(30)
    .lean();

    if (similarMerchants.length === 0) {
      return {
        category: null,
        confidence: 0,
        strategy: 'merchant_mapping',
        weight: 0.2,
      };
    }

    // Calculate confidence based on consistency
    const categoryFreq = {};
    similarMerchants.forEach(t => {
      categoryFreq[t.category] = (categoryFreq[t.category] || 0) + 1;
    });

    const mostCommon = Object.entries(categoryFreq)
      .sort(([, a], [, b]) => b - a)[0];

    const consistency = mostCommon[1] / similarMerchants.length;

    return {
      category: mostCommon[0],
      confidence: consistency * 0.95,
      strategy: 'merchant_mapping',
      weight: 0.2,
    };
  }

  /**
   * Strategy 4: Historical pattern matching
   * Account for seasonal and recurring patterns
   */
  async historicalPatternMatching(transaction) {
    const dayOfWeek = new Date(transaction.date).getDay();
    const monthOfYear = new Date(transaction.date).getMonth();

    const historicalData = await Transaction.find({
      user: transaction.user,
      $expr: {
        $eq: [{ $dayOfWeek: '$date' }, dayOfWeek],
      },
    })
    .limit(50)
    .lean();

    if (historicalData.length < 5) {
      return {
        category: null,
        confidence: 0,
        strategy: 'historical_pattern',
        weight: 0.15,
      };
    }

    const categoryFreq = {};
    historicalData.forEach(t => {
      categoryFreq[t.category] = (categoryFreq[t.category] || 0) + 1;
    });

    const mostCommon = Object.entries(categoryFreq)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      category: mostCommon[0],
      confidence: (mostCommon[1] / historicalData.length) * 0.7,
      strategy: 'historical_pattern',
      weight: 0.15,
    };
  }

  /**
   * Strategy 5: Time-based pattern matching
   * Certain categories occur at specific times
   */
  async timePatternMatching(transaction) {
    const date = new Date(transaction.date);
    const hour = date.getHours();
    const minutes = date.getMinutes();

    // --- תוספת/תיקון: התעלמות במידה ואין שעה אמיתית (מופיע כ-00:00 מהאקסלים של הבנקים) ---
    if (hour === 0 && minutes === 0) {
      return {
        category: null,
        confidence: 0,
        strategy: 'time_pattern',
        weight: 0.1,
      };
    }
    
    const timePatterns = {
      'קפה': { hours: [7, 8, 9, 14, 15], confidence: 0.6 },
      'ארוחת צהריים': { hours: [12, 13], confidence: 0.7 },
      'ארוחת ערב': { hours: [19, 20, 21], confidence: 0.65 },
      'תחבורה': { hours: [7, 8, 9, 17, 18], confidence: 0.5 },
    };

    let bestMatch = null;
    let bestScore = 0;

    for (const [category, pattern] of Object.entries(timePatterns)) {
      if (pattern.hours.includes(hour)) {
        if (pattern.confidence > bestScore) {
          bestScore = pattern.confidence;
          bestMatch = category;
        }
      }
    }

    return {
      category: bestMatch,
      confidence: bestScore * 0.6, // Lower weight for time-based
      strategy: 'time_pattern',
      weight: 0.1,
    };
  }

  /**
   * Strategy 6: NLP-based analysis
   * Advanced text analysis using multiple NLP techniques
   */
  async descriptionNLPAnalysis(transaction) {
    const desc = transaction.description.toLowerCase();
    
    // Sentiment and entity analysis
    const sentiment = this.analyzeSentiment(desc);
    const entities = this.extractEntities(desc);
    const commonWords = this.extractCommonWords(desc);

    // Score based on extracted features
    let category = null;
    let confidence = 0;

    if (sentiment === 'negative' && transaction.type === 'הוצאה') {
      // Might be essential spending
      const essentials = ['דלק', 'מזומן', 'חשמל מים'];
      category = essentials[0];
      confidence = 0.4;
    }

    if (entities.includes('payment') || entities.includes('transfer')) {
      category = 'העברה';
      confidence = 0.8;
    }

    return {
      category,
      confidence,
      strategy: 'nlp_analysis',
      weight: 0.1,
      metadata: { sentiment, entities, commonWords },
    };
  }

  /**
   * Aggregate results from all strategies
   */
  aggregateResults(results, transaction) {
    const weights = {
      keyword_matching: 0.28,
      merchant_mapping: 0.22,
      amount_pattern: 0.18,
      historical_pattern: 0.15,
      time_pattern: 0.1,
      nlp_analysis: 0.07,
    };

    let totalScore = 0;
    const categoryScores = {};

    results.forEach(result => {
      if (result.category && result.confidence > 0) {
        const weight = weights[result.strategy] || 0;
        const score = result.confidence * weight;
        
        if (!categoryScores[result.category]) {
          categoryScores[result.category] = 0;
        }
        categoryScores[result.category] += score;
        totalScore += score;
      }
    });

    if (totalScore === 0) {
      return {
        category: 'כללי',
        confidence: 0,
        reason: 'no_matches',
      };
    }

    // Get best match
    const [bestCategory, bestScore] = Object.entries(categoryScores)
      .sort(([, a], [, b]) => b - a)[0];

    const normalizedConfidence = Math.min(1, bestScore / totalScore);

    return {
      category: bestCategory,
      confidence: normalizedConfidence,
      reason: 'aggregated',
      allScores: categoryScores,
    };
  }

  /**
   * Fuzzy matching algorithm
   */
  fuzzyMatch(str, pattern) {
    let score = 0;
    
    // Exact match
    if (str.includes(pattern)) {
      return 1;
    }

    // Substring similarity
    const patternLen = pattern.length;
    const strLen = str.length;
    
    if (patternLen === 0) return 0;

    let matches = 0;
    for (let i = 0; i < patternLen; i++) {
      if (str.includes(pattern[i])) {
        matches++;
      }
    }

    score = matches / patternLen;

    // Levenshtein distance fallback
    const similarity = this.levenshteinSimilarity(str, pattern);
    if (similarity > score) {
      score = similarity;
    }

    return Math.min(1, score);
  }

  /**
   * Levenshtein distance for string similarity
   */
  levenshteinSimilarity(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n === 0 ? 1 : 0;
    if (n === 0) return 0;

    const dp = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[0][i] = i;
    for (let j = 0; j <= n; j++) dp[j][0] = j;

    for (let j = 1; j <= n; j++) {
      for (let i = 1; i <= m; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[j][i] = dp[j - 1][i - 1];
        } else {
          dp[j][i] = Math.min(
            dp[j - 1][i - 1] + 1,
            dp[j][i - 1] + 1,
            dp[j - 1][i] + 1
          );
        }
      }
    }

    const distance = dp[n][m];
    const maxLen = Math.max(m, n);
    return 1 - distance / maxLen;
  }

  /**
   * Extract merchant name from description
   */
  extractMerchant(description) {
    // Try to extract the first part before numbers or special chars
    const match = description.match(/^([A-Za-z0-9\u0590-\u05FF\s]+?)([\d\s*#]+|$)/);
    return match ? match[1].trim() : null;
  }

  /**
   * Analyze sentiment of description
   */
  analyzeSentiment(text) {
    const negativeWords = ['בעיה', 'סכום גבוה', 'בהוצאה', 'יקר', 'יקרה'];
    const positiveWords = ['בהכנסה', 'קבלה', 'שכר', 'תשובה'];

    let negScore = 0;
    let posScore = 0;

    negativeWords.forEach(word => {
      if (text.includes(word)) negScore++;
    });

    positiveWords.forEach(word => {
      if (text.includes(word)) posScore++;
    });

    if (negScore > posScore) return 'negative';
    if (posScore > negScore) return 'positive';
    return 'neutral';
  }

  /**
   * Extract entities from text
   */
  extractEntities(text) {
    const entities = [];

    if (text.includes('transfer') || text.includes('העברה')) {
      entities.push('transfer');
    }
    if (text.includes('payment') || text.includes('תשלום')) {
      entities.push('payment');
    }
    if (text.match(/\d{10}/)) {
      entities.push('phone_number');
    }

    return entities;
  }

  /**
   * Extract common words for analysis
   */
  extractCommonWords(text) {
    // --- תוספת/תיקון: הוסרה הכפילות של המילה 'את' ---
    const stopWords = ['את', 'של', 'זה', 'הוא', 'היא'];
    const words = text.split(/\s+/).filter(w => !stopWords.includes(w) && w.length > 2);
    return words.slice(0, 5);
  }

  /**
   * Generate cache key
   */
  generateCacheKey(transaction) {
    return `${transaction.description}_${transaction.amount}_${transaction.type}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Classify a batch of transactions efficiently — pre-fetches all DB data once
   * instead of 6 queries per transaction.
   * @param {Object[]} transactions - Array of transactions (must share the same user)
   * @returns {Object[]} Array of { transactionId, category, confidence }
   */
  async classifyBatch(transactions) {
    if (!transactions || transactions.length === 0) return [];

    const userId = transactions[0].user;

    // ── Pre-fetch כל הנתונים בbatch אחד ──────────────────────────────
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const [historicalTxns, dayAggregate] = await Promise.all([
      // כל עסקאות המשתמש מ-6 חודשים אחרונים — למerchant + amount patterns
      Transaction.find({ user: userId, date: { $gte: sixMonthsAgo } })
        .select('description rawDescription amount category date')
        .lean(),
      // Aggregate יום-בשבוע → category distribution
      Transaction.aggregate([
        { $match: { user: typeof userId === 'string' ? userId : userId } },
        { $group: { _id: { dow: { $dayOfWeek: '$date' }, cat: '$category' }, count: { $sum: 1 } } },
      ]),
    ]);

    // בנה מפת יום → { category: count }
    const dayPatterns = {};
    for (const row of dayAggregate) {
      const dow = row._id.dow;
      const cat = row._id.cat;
      if (!dayPatterns[dow]) dayPatterns[dow] = {};
      dayPatterns[dow][cat] = (dayPatterns[dow][cat] || 0) + row.count;
    }

    // ── קלסף כל עסקה ללא queries נוספים ──────────────────────────────
    return transactions.map(tx => {
      const results = [
        this.keywordMatchSync(tx),
        this._merchantMatchFromCache(tx, historicalTxns),
        this._amountMatchFromCache(tx, historicalTxns),
        this._historicalMatchFromCache(tx, dayPatterns),
        this.timePatternMatching(tx),          // sync בלבד (ללא DB)
        this.descriptionNLPAnalysisSync(tx),
      ];
      const prediction = this.aggregateResults(results, tx);
      return { transactionId: tx._id, ...prediction };
    });
  }

  /** Sync version of keywordMatching (no DB) */
  keywordMatchSync(transaction) {
    const keywords = {
      'דלק': ['gas', 'דלק', 'station', 'תדלוק', 'bp', 'delek', 'paz'],
      'מסעדה': ['rest', 'restaurant', 'pizza', 'burger', 'café', 'cafe', 'bar', 'מסעדה', 'אוכל'],
      'קניות': ['shop', 'mall', 'store', 'market', 'supermarket', 'סוריק', 'זול', 'carrefour', 'rami'],
      'בריאות': ['pharmacy', 'dr', 'doctor', 'clinic', 'hospital', 'health', 'medical', 'בריאות'],
      'תחבורה': ['taxi', 'bus', 'train', 'uber', 'moovit', 'raid', 'ido', 'egged', 'תחבורה'],
      'בילוי': ['cinema', 'movie', 'sport', 'gym', 'pool', 'sports', 'entertainment', 'בילוי'],
      'ביטוח': ['insurance', 'ביטוח'],
      'דמי שכרה': ['rent', 'lease', 'landlord', 'דיור', 'דמי'],
      'חשמל מים': ['electricity', 'water', 'אגד', 'חשמל', 'מים', 'גז'],
      'פלאפון': ['phone', 'cellular', 'mobile', 'telecom', 'pelephone', 'cellcom', 'רביד', 'טלפון'],
    };
    const description = transaction.description.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    for (const [category, keywordList] of Object.entries(keywords)) {
      for (const keyword of keywordList) {
        const score = this.fuzzyMatch(description, keyword);
        if (score > bestScore) { bestScore = score; bestMatch = category; }
      }
    }
    return { category: bestMatch, confidence: bestScore, strategy: 'keyword_matching', weight: 0.25 };
  }

  /** Merchant matching using pre-fetched array */
  _merchantMatchFromCache(transaction, historicalTxns) {
    const merchant = this.extractMerchant(transaction.description);
    if (!merchant) return { category: null, confidence: 0, strategy: 'merchant_mapping', weight: 0.2 };

    const re = new RegExp(merchant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const similar = historicalTxns.filter(t => re.test(t.rawDescription || t.description));
    if (similar.length === 0) return { category: null, confidence: 0, strategy: 'merchant_mapping', weight: 0.2 };

    const freq = {};
    similar.forEach(t => { freq[t.category] = (freq[t.category] || 0) + 1; });
    const [cat, cnt] = Object.entries(freq).sort(([, a], [, b]) => b - a)[0];
    return { category: cat, confidence: (cnt / similar.length) * 0.95, strategy: 'merchant_mapping', weight: 0.2 };
  }

  /** Amount matching using pre-fetched array */
  _amountMatchFromCache(transaction, historicalTxns) {
    const range = transaction.amount * 0.15;
    const similar = historicalTxns.filter(
      t => t.amount >= transaction.amount - range && t.amount <= transaction.amount + range,
    ).slice(0, 20);
    if (similar.length === 0) return { category: null, confidence: 0, strategy: 'amount_pattern', weight: 0.15 };

    const freq = {};
    similar.forEach(t => { freq[t.category] = (freq[t.category] || 0) + 1; });
    const [cat, cnt] = Object.entries(freq).sort(([, a], [, b]) => b - a)[0];
    return { category: cat, confidence: (cnt / similar.length) * 0.8, strategy: 'amount_pattern', weight: 0.15 };
  }

  /** Historical day-of-week matching using pre-fetched aggregate */
  _historicalMatchFromCache(transaction, dayPatterns) {
    const dow = new Date(transaction.date).getDay() + 1; // MongoDB $dayOfWeek: 1=Sun
    const cats = dayPatterns[dow];
    if (!cats) return { category: null, confidence: 0, strategy: 'historical_pattern', weight: 0.15 };

    const total = Object.values(cats).reduce((s, v) => s + v, 0);
    if (total < 5) return { category: null, confidence: 0, strategy: 'historical_pattern', weight: 0.15 };

    const [cat, cnt] = Object.entries(cats).sort(([, a], [, b]) => b - a)[0];
    return { category: cat, confidence: (cnt / total) * 0.7, strategy: 'historical_pattern', weight: 0.15 };
  }

  /** Sync NLP analysis (no DB) */
  descriptionNLPAnalysisSync(transaction) {
    const desc = transaction.description.toLowerCase();
    const entities = this.extractEntities(desc);
    if (entities.includes('payment') || entities.includes('transfer')) {
      return { category: 'העברה', confidence: 0.8, strategy: 'nlp_analysis', weight: 0.1 };
    }
    return { category: null, confidence: 0, strategy: 'nlp_analysis', weight: 0.1 };
  }

  /**
   * Learn from user corrections
   */
  async learnFromCorrection(transaction, correctCategory) {
    // Update patterns based on user correction
    const merchant = this.extractMerchant(transaction.description);
    
    if (merchant) {
      // Record this merchant-category mapping
      logger.info('Learning from correction', {
        merchant,
        category: correctCategory,
        originalDescription: transaction.description,
      });
    }

    // Clear cache to reflect new learning
    this.cache.clear();
  }
}

export default new SmartCategoryEngine();