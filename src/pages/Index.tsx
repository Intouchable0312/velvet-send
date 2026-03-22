import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import AccessCodeScreen from "../components/AccessCodeScreen";
import EmailComposer from "../components/EmailComposer";

const Index = () => {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        {!unlocked && (
          <AccessCodeScreen key="lock" onUnlock={() => setUnlocked(true)} />
        )}
      </AnimatePresence>
      {unlocked && <EmailComposer />}
    </div>
  );
};

export default Index;
