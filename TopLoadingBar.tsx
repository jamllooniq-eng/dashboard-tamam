import React, { useState, useEffect, useRef } from 'react';

interface TopLoadingBarProps {
  trigger?: any;
}

export const TopLoadingBar: React.FC<TopLoadingBarProps> = ({ trigger }) => {
  const [progress, setProgress] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(false);
  const isFirstRender = useRef(true);
  const timer1Ref = useRef<NodeJS.Timeout | null>(null);
  const timer2Ref = useRef<NodeJS.Timeout | null>(null);
  const timer3Ref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Skip initial mount so loading bar doesn't flash needlessly on cold load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Clear any previous running timers
    if (timer1Ref.current) clearTimeout(timer1Ref.current);
    if (timer2Ref.current) clearTimeout(timer2Ref.current);
    if (timer3Ref.current) clearTimeout(timer3Ref.current);

    // Step 1: Start at 15% visible immediately
    setProgress(15);
    setVisible(true);

    // Step 2: Animate to ~85% within ~300ms
    timer1Ref.current = setTimeout(() => {
      setProgress(85);
    }, 50);

    // Step 3: Complete to 100% at ~400ms
    timer2Ref.current = setTimeout(() => {
      setProgress(100);
    }, 400);

    // Step 4: Fade out and reset before 700ms total
    timer3Ref.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setProgress(0);
      }, 200);
    }, 600);

    return () => {
      if (timer1Ref.current) clearTimeout(timer1Ref.current);
      if (timer2Ref.current) clearTimeout(timer2Ref.current);
      if (timer3Ref.current) clearTimeout(timer3Ref.current);
    };
  }, [trigger]);

  if (!visible && progress === 0) {
    return null;
  }

  return (
    <div
      id="top-loading-bar-container"
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[3px] overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease-out',
      }}
    >
      <div
        id="top-loading-bar-indicator"
        className="h-full bg-[#22A39E] shadow-[0_0_8px_#22A39E]"
        style={{
          width: `${progress}%`,
          transition: progress === 0 ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  );
};

export default TopLoadingBar;
