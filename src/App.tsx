import { useState, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { 
  Swords, History, Play, Pause, Lock, CheckCircle2,
  Crosshair, BrainCircuit, Activity
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Subject = 'physics' | 'chemistry' | 'maths';
type ShiftId = 'SHT_01' | 'SHT_02' | 'SHT_03';

interface ShiftStatus {
  elapsedSeconds: number;
  completed: boolean;
}

const SHIFT_TARGET_SECONDS = 3600; // 1 Hour per shift
const BOSS_FIGHT_TARGET_SECONDS = 3 * 3600; // 3 Hours

const SUBJECT_COLORS = {
  physics: 'bg-yellow-400',
  chemistry: 'bg-cyan-400',
  maths: 'bg-orange-500',
};

const SUBJECT_TEXT_COLORS = {
  physics: 'text-yellow-400',
  chemistry: 'text-cyan-400',
  maths: 'text-orange-500',
};

export default function App() {
  const todayStr = new Date().toDateString();

  // --- PERSISTENT STATE ---
  const [xp, setXp] = useLocalStorage<Record<Subject, number>>('wr-xp', { physics: 0, chemistry: 0, maths: 0 });
  const [subject, setSubject] = useLocalStorage<Subject>('wr-subject', 'physics');
  const [shifts, setShifts] = useLocalStorage<Record<ShiftId, ShiftStatus>>('wr-shifts', {
    SHT_01: { elapsedSeconds: 0, completed: false },
    SHT_02: { elapsedSeconds: 0, completed: false },
    SHT_03: { elapsedSeconds: 0, completed: false },
  });
  const [dailyData, setDailyData] = useLocalStorage('wr-daily', { date: todayStr, bossFightCompleted: false });
  const [bossFightsCount, setBossFightsCount] = useLocalStorage('wr-boss-fights', 0);
  const [streak, setStreak] = useLocalStorage('wr-streak', 0);
  const [lastCompletedDate, setLastCompletedDate] = useLocalStorage('wr-last-date', '');

  // --- SESSION STATE ---
  const [activeTimer, setActiveTimer] = useState<{ type: 'shift' | 'boss'; id?: ShiftId } | null>(null);
  const [bossFightRemaining, setBossFightRemaining] = useState(BOSS_FIGHT_TARGET_SECONDS);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  // Daily Reset Logic
  useEffect(() => {
    if (dailyData.date !== todayStr) {
      setShifts({
        SHT_01: { elapsedSeconds: 0, completed: false },
        SHT_02: { elapsedSeconds: 0, completed: false },
        SHT_03: { elapsedSeconds: 0, completed: false },
      });
      setDailyData({ date: todayStr, bossFightCompleted: false });
    }
  }, [todayStr, dailyData.date, setShifts, setDailyData]);

  // Streak Logic
  useEffect(() => {
    if (
      shifts.SHT_01.completed && 
      shifts.SHT_02.completed && 
      shifts.SHT_03.completed && 
      dailyData.bossFightCompleted
    ) {
      if (lastCompletedDate !== todayStr) {
        setStreak((s: number) => s + 1);
        setLastCompletedDate(todayStr);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#fbbf24', '#22d3ee', '#f97316']
        });
      }
    }
  }, [shifts, dailyData.bossFightCompleted, todayStr, lastCompletedDate, setStreak, setLastCompletedDate]);

  // Doomsday Clock
  useEffect(() => {
    const targetDate = new Date('2026-05-17T00:00:00Z').getTime();
    
    const updateClock = () => {
      const distance = targetDate - new Date().getTime();
      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        });
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 60000);
    return () => clearInterval(interval);
  }, []);

  // Main Timer Loop
  useEffect(() => {
    let interval: number;
    if (activeTimer) {
      interval = window.setInterval(() => {
        if (activeTimer.type === 'shift' && activeTimer.id) {
          setShifts((prev: any) => {
            const shift = prev[activeTimer.id!];
            if (shift.completed) return prev;
            
            const newElapsed = shift.elapsedSeconds + 1;
            const completed = newElapsed >= SHIFT_TARGET_SECONDS;
            
            if (completed) {
               setActiveTimer(null);
               confetti({
                 particleCount: 100,
                 spread: 60,
                 origin: { y: 0.8 },
                 colors: [subject === 'physics' ? '#fbbf24' : subject === 'chemistry' ? '#22d3ee' : '#f97316']
               });
            }
            
            return {
              ...prev,
              [activeTimer.id!]: {
                ...shift,
                elapsedSeconds: newElapsed,
                completed
              }
            };
          });
          
          setXp((prev: any) => ({
             ...prev,
             [subject]: prev[subject] + (10 / 60)
          }));

        } else if (activeTimer.type === 'boss') {
          setBossFightRemaining(prev => {
            if (prev <= 1) {
              setActiveTimer(null);
              setBossFightsCount((c: number) => c + 1);
              setDailyData((d: any) => ({ ...d, bossFightCompleted: true }));
              confetti({
                particleCount: 200,
                spread: 100,
                origin: { y: 0.5 },
                colors: ['#f97316', '#ffffff']
              });
              return BOSS_FIGHT_TARGET_SECONDS;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer, subject, setShifts, setXp, setBossFightsCount, setDailyData]);

  const toggleShiftTimer = (id: ShiftId) => {
    if (activeTimer?.id === id) {
      setActiveTimer(null);
    } else {
      setActiveTimer({ type: 'shift', id });
    }
  };

  const startBossFight = () => {
    setActiveTimer({ type: 'boss' });
  };

  const cancelBossFight = () => {
    setActiveTimer(null);
    setBossFightRemaining(BOSS_FIGHT_TARGET_SECONDS);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const shiftData = [
    { id: 'SHT_01' as ShiftId, title: 'CONCEPTUAL DRILL', isUnlocked: true },
    { id: 'SHT_02' as ShiftId, title: 'PROBLEM SET', isUnlocked: shifts.SHT_01.completed },
    { id: 'SHT_03' as ShiftId, title: 'REVISION', isUnlocked: shifts.SHT_02.completed },
  ];

  const renderBlocks = (elapsed: number, target: number) => {
    const totalBlocks = 12;
    const filledBlocks = Math.floor((elapsed / target) * totalBlocks);
    return (
      <div className="flex gap-1 mt-3">
        {Array.from({ length: totalBlocks }).map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "h-2 flex-1 rounded-sm transition-all duration-300",
              i < filledBlocks ? SUBJECT_COLORS[subject] : "bg-zinc-800"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex flex-col selection:bg-orange-500/30 overflow-x-hidden">
      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
          
          {/* TOP-LEVEL MODULE */}
          <motion.section 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="space-y-4 relative z-10">
              <div className="inline-flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-full">
                <motion.div 
                  animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" 
                />
                <span className="text-[10px] font-bold tracking-widest text-zinc-400">MISSION STATUS: ACTIVE</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white">
                TARGET: 240+ MARKS. <br/><span className="text-zinc-500">REGRET IS NOT AN OPTION.</span>
              </h1>
              
              <div className="flex gap-2">
                {(['physics', 'chemistry', 'maths'] as Subject[]).map(subj => (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    key={subj}
                    onClick={() => setSubject(subj)}
                    className={cn(
                      "px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all border relative",
                      subject === subj 
                        ? cn(SUBJECT_COLORS[subj], "text-zinc-950 border-transparent shadow-[0_0_10px_rgba(0,0,0,0.5)]") 
                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-white"
                    )}
                  >
                    {subj}
                    {subject === subj && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white/20 rounded"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="text-right relative z-10">
              <div className="text-[10px] font-bold tracking-widest text-zinc-500 mb-2 uppercase">Doomsday Protocol</div>
              <div className="text-4xl md:text-5xl font-mono font-bold text-orange-500 tracking-tight text-shadow-neon">
                {String(timeLeft.days).padStart(2, '0')} <span className="text-zinc-700">D</span> : {String(timeLeft.hours).padStart(2, '0')} <span className="text-zinc-700">H</span> : {String(timeLeft.minutes).padStart(2, '0')} <span className="text-zinc-700">M</span>
              </div>
            </div>
          </motion.section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* OPERATIONAL SHIFTS */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-sm font-bold tracking-widest text-white mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  OPERATIONAL SHIFTS
                </h2>
                
                <div className="space-y-4">
                  {shiftData.map((shift, idx) => {
                    const status = shifts[shift.id];
                    const isActive = activeTimer?.id === shift.id;
                    const isLocked = !shift.isUnlocked;

                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={shift.id} 
                        className={cn(
                          "p-5 rounded-xl border transition-all relative overflow-hidden",
                          isLocked ? "bg-zinc-950/50 border-zinc-900 opacity-60" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700/50",
                          isActive && "border-zinc-700 shadow-lg scale-[1.01]"
                        )}
                      >
                        {isActive && (
                          <motion.div 
                            layoutId="activeShift"
                            className={cn("absolute top-0 left-0 w-1 h-full", SUBJECT_COLORS[subject])} 
                          />
                        )}

                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-zinc-500 font-bold">{shift.id}</span>
                            <h3 className={cn("font-black tracking-tight transition-colors", isLocked ? "text-zinc-600" : "text-white")}>
                              {shift.title}
                            </h3>
                          </div>
                          {isLocked ? (
                            <Lock className="w-4 h-4 text-zinc-600" />
                          ) : status.completed ? (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <CheckCircle2 className={cn("w-5 h-5", SUBJECT_TEXT_COLORS[subject])} />
                            </motion.div>
                          ) : (
                            <span className="font-mono text-sm text-zinc-400">
                              {formatTime(status.elapsedSeconds)} / {formatTime(SHIFT_TARGET_SECONDS)}
                            </span>
                          )}
                        </div>

                        {!isLocked && !status.completed && (
                          <div className="mt-4 flex items-center gap-4">
                            <motion.button 
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => toggleShiftTimer(shift.id)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded font-bold text-xs tracking-widest transition-colors",
                                isActive 
                                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" 
                                  : cn(SUBJECT_COLORS[subject], "text-zinc-950 hover:brightness-110")
                              )}
                            >
                              {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              {isActive ? 'PAUSE PROTOCOL' : 'RESUME PROTOCOL'}
                            </motion.button>
                          </div>
                        )}

                        {(!isLocked) && renderBlocks(status.elapsedSeconds, SHIFT_TARGET_SECONDS)}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* PROGRESSION SYSTEM */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <h2 className="text-sm font-bold tracking-widest text-white mb-4 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-yellow-400" />
                  SUBJECT XP CAPACITY
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6 hover:border-zinc-700/50 transition-colors">
                  {(['physics', 'chemistry', 'maths'] as Subject[]).map(subj => {
                    const currentXp = Math.floor(xp[subj]);
                    const percent = Math.min((currentXp / 10000) * 100, 100);
                    
                    return (
                      <div key={subj}>
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                          <span className="text-zinc-400">{subj}</span>
                          <span className={cn("font-mono", SUBJECT_TEXT_COLORS[subj])}>{currentXp} <span className="text-zinc-600">/ 10,000 XP</span></span>
                        </div>
                        <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={cn("h-full", SUBJECT_COLORS[subj])} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>

            {/* THE CRUCIBLE / RIGHT COL */}
            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden group hover:border-zinc-700/50 transition-all"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-500" />
                
                <h2 className="text-sm font-bold tracking-widest text-white mb-6 flex items-center gap-2 relative z-10">
                  <Swords className="w-4 h-4 text-orange-500" />
                  COMBAT_READY_MODULE
                </h2>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startBossFight}
                  className="w-full relative z-10 bg-zinc-950 border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-zinc-950 py-8 rounded-xl font-black text-2xl tracking-tighter transition-all group-hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] mb-6 flex flex-col items-center justify-center gap-2"
                >
                  <Crosshair className="w-8 h-8 mb-2 opacity-80" />
                  BOSS FIGHT
                </motion.button>

                <div className="flex justify-between items-center px-4 py-3 bg-zinc-950 rounded-lg border border-zinc-800">
                  <span className="text-xs font-bold tracking-widest text-zinc-500">DEFEATED</span>
                  <span className="text-xl font-mono font-bold text-orange-500">{bossFightsCount}</span>
                </div>
              </motion.div>

              {/* INTEL SECTION */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700/50 transition-colors"
              >
                <h3 className="text-xs font-bold tracking-widest text-zinc-500 mb-4 uppercase">Operational Intel</h3>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center border border-orange-500/20">
                    <History className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">PERFECT STREAK</div>
                    <div className="text-2xl font-mono font-bold text-orange-500">{streak} <span className="text-sm text-zinc-500">DAYS</span></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] font-bold tracking-widest text-zinc-600">TODAY'S DIRECTIVES</div>
                  {[
                    { label: 'ALL SHIFTS COMPLETED', done: shifts.SHT_01.completed && shifts.SHT_02.completed && shifts.SHT_03.completed },
                    { label: 'BOSS FIGHT DEFEATED', done: dailyData.bossFightCompleted }
                  ].map((req, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <motion.div 
                        animate={{ scale: req.done ? [1, 1.2, 1] : 1 }}
                        className={cn("w-4 h-4 rounded-full flex items-center justify-center border transition-colors", req.done ? "bg-orange-500 border-orange-500" : "bg-zinc-950 border-zinc-700")}
                      >
                        {req.done && <CheckCircle2 className="w-3 h-3 text-zinc-950" />}
                      </motion.div>
                      <span className={cn("font-bold text-xs tracking-wider transition-colors", req.done ? "text-zinc-300" : "text-zinc-600")}>{req.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

            </div>
          </div>
        </div>
      </main>

      {/* BOSS FIGHT OVERLAY */}
      <AnimatePresence>
        {activeTimer?.type === 'boss' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center space-y-8"
            >
              <h2 className="text-6xl font-black tracking-tighter text-orange-500 drop-shadow-[0_0_20px_rgba(249,115,22,0.5)]">
                BOSS FIGHT IN PROGRESS
              </h2>
              <div className="text-9xl font-mono font-bold text-white tracking-tighter">
                {formatTime(bossFightRemaining)}
              </div>
              <div className="flex justify-center gap-4 mt-12">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={cancelBossFight}
                  className="px-8 py-3 rounded-lg border border-zinc-800 text-zinc-500 font-bold tracking-widest text-sm hover:text-white hover:bg-zinc-900 transition-all"
                >
                  ABORT MISSION
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}