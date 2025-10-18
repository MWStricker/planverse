import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationConfettiProps {
  show: boolean;
}

export const CelebrationConfetti = ({ show }: CelebrationConfettiProps) => {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number; color: string }>>([]);

  useEffect(() => {
    if (show) {
      // Generate 20 confetti particles
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100, // Random x position (0-100%)
        delay: Math.random() * 0.2, // Random delay (0-0.2s)
        color: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'][Math.floor(Math.random() * 5)],
      }));
      setParticles(newParticles);

      // Auto-hide after 2 seconds
      const timer = setTimeout(() => {
        setParticles([]);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute top-0 w-2 h-2 rounded-full"
              style={{
                left: `${particle.x}%`,
                backgroundColor: particle.color,
              }}
              initial={{ y: -20, opacity: 1, scale: 1 }}
              animate={{
                y: window.innerHeight + 20,
                opacity: 0,
                scale: 0,
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 1.8,
                delay: particle.delay,
                ease: 'easeIn',
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};
