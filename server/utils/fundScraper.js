import axios from 'axios';
import * as cheerio from 'cheerio';

export const getFundPriceBizportal = async (fundNumber) => {
  const url = `https://www.bizportal.co.il/mutualfunds/quote/generalview/${fundNumber}`;
  try {
    // הוספת User-Agent כדי שהאתר לא יזהה אותנו כבוט ויחסום
    const { data } = await axios.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    
    // ניסיון למצוא את המחיר ב-class הראשי
    let priceText = $("div.num").first().text().trim();
    
    // אם לא מצאנו, ננסה לחפש לפי הקשר (ליד הכיתוב "שער אחרון")
    if (!priceText) {
        priceText = $("li:contains('שער אחרון') .num").text().trim();
    }

    if (priceText) {
      // ניקוי פסיקים ותווים לא רצויים מהמספר
      const cleanPrice = priceText.replace(/,/g, '').replace(/[^\d.]/g, '');
      const priceAgorot = parseFloat(cleanPrice);
      
      if (!isNaN(priceAgorot)) {
        return priceAgorot / 100.0; // המרה מאגורות לשקלים
      }
    }
    return 0.0;
  } catch (error) {
    console.error(`Failed to fetch price for fund ${fundNumber}:`, error.message);
    return 0.0;
  }
};