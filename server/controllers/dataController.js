import DataRecord from "../models/DataRecordModel.js";

// @desc   שמירת רשומת נתונים חדשה
// @route  POST /api/data/save
// @access Private
export const saveDataRecord = async (req, res) => {
  try {
    const { value1, value2 } = req.body;

    // התיקון: שימוש ב-req.user._id (עם קו תחתון) ובדיקה שהוא קיים
    const userId = req.user?._id;

    // בדיקה שמזהה המשתמש אכן קיים בבקשה
    if (!userId) {
      // אם המזהה חסר, זה מצביע על בעיה ב-middleware של האימות
      console.error("Error: User ID is missing from the request after authentication.");
      return res.status(401).json({ message: "לא ניתן לזהות את המשתמש מהבקשה." });
    }

    // בדיקה שהערכים שהתקבלו הם אכן מספרים
    if (typeof value1 !== "number" || typeof value2 !== "number") {
      return res.status(400).json({ message: "יש לספק ערכים מספריים" });
    }

    // יצירת הרשומה החדשה במסד הנתונים
    const newRecord = await DataRecord.create({
      user: userId,
      value1,
      value2,
    });

    // אם ההצלחה, החזרת הודעה מתאימה
    res.status(201).json({ message: "הנתונים נשמרו בהצלחה!" });

  } catch (error) {
    // במקרה של שגיאה, רישום מלא שלה בקונסול של השרת לצורכי דיבאגינג
    console.error("Error in saveDataRecord controller:", error);
    res.status(500).json({ message: "שגיאת שרת פנימית", error: error.message });
  }
};