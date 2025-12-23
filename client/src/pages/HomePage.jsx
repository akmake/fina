/*  client/src/pages/HomePage.jsx  */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-6 text-center">
      {/* ── Hero ── */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-4xl sm:text-5xl font-extrabold mb-6 leading-tight text-gray-800"
      >
        ברוכים הבאים לאתר&nbsp;
        <span className="text-primary-600">ניהול פיננסי אישי מקיף</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="text-lg sm:text-xl text-gray-600 max-w-2xl mb-10"
      >
        ניהול הוצאות והכנסות בקלות כולל עבודות קבלן מתועדות
        <br />
        לחצו על הכפתור ותעברו לטופס ההזמנה תוך שניות.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Button asChild size="lg">
          <Link to="/tzitzit">התחל הזמנה</Link>
        </Button>
      </motion.div>
    </main>
  );
}
