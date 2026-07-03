# Fina Android

קליינט Android Native ב־Kotlin ו־Jetpack Compose עבור שרת Fina.

## הרצה

1. פתחו את התיקייה `android` ב־Android Studio.
2. הריצו את `app` על Android Emulator או מכשיר פיזי.
3. ברירת המחדל היא שרת הייצור: `https://ziporiteem.com/api/`.

כדי לעבוד מול שרת מקומי או שרת אחר, הוסיפו ל־`~/.gradle/gradle.properties`:

```properties
FINA_API_URL=https://your-server.example/api/
```

כתובת ה־API חייבת להסתיים ב־`/`. שימוש ב־HTTP פתוח רק עבור localhost וה־emulator; שרתים חיצוניים צריכים HTTPS.
