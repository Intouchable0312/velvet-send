import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";

const ACCESS_CODE = "0312";

interface AccessCodeScreenProps {
  onUnlock: () => void;
}

const AccessCodeScreen = ({ onUnlock }: AccessCodeScreenProps) => {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return;
      const newDigits = [...digits];
      newDigits[index] = value;
      setDigits(newDigits);
      setError(false);

      if (value && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newDigits.every((d) => d.length === 1)) {
        const code = newDigits.join("");
        if (code === ACCESS_CODE) {
          setTimeout(onUnlock, 300);
        } else {
          setError(true);
          setShaking(true);
          setTimeout(() => {
            setShaking(false);
            setDigits(["", "", "", ""]);
            inputRefs.current[0]?.focus();
          }, 600);
        }
      }
    },
    [digits, onUnlock]
  );

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (paste.length === 4) {
      const newDigits = paste.split("");
      setDigits(newDigits);
      if (paste === ACCESS_CODE) {
        setTimeout(onUnlock, 300);
      } else {
        setError(true);
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setDigits(["", "", "", ""]);
          inputRefs.current[0]?.focus();
        }, 600);
      }
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4"
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-card relative w-full max-w-sm p-8 sm:p-10 text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"
        >
          <Lock className="w-7 h-7 text-primary" />
        </motion.div>

        <h1 className="font-display text-2xl font-bold text-foreground mb-2">
          Accès sécurisé
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          Entrez le code d'accès pour continuer
        </p>

        {/* Code inputs */}
        <motion.div
          className="flex justify-center gap-3 mb-6"
          animate={shaking ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          onPaste={handlePaste}
        >
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`code-input ${error ? "border-destructive focus:border-destructive focus:ring-destructive/30" : ""}`}
              autoFocus={i === 0}
            />
          ))}
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center justify-center gap-2 text-destructive text-sm mb-4"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Code incorrect, réessayez</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground/60 text-xs mt-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Connexion sécurisée</span>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AccessCodeScreen;
