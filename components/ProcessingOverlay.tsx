import React from 'react';
import { motion } from 'framer-motion';
import { Binary, Cpu, FileCode2, ShieldCheck } from 'lucide-react';

interface ProcessingOverlayProps {
  progress: number;
  status: string;
}

const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ progress, status }) => {
  const steps = [
    { label: 'ingest', icon: FileCode2, threshold: 0, next: 35 },
    { label: 'parse', icon: Binary, threshold: 35, next: 70 },
    { label: 'repair', icon: ShieldCheck, threshold: 70, next: 101 }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-zinc-100 p-6 text-center">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#d4d4d8_1px,transparent_1px),linear-gradient(to_bottom,#d4d4d8_1px,transparent_1px)] bg-[size:28px_28px] opacity-50" />
      <div className="absolute inset-x-0 top-0 h-1 bg-zinc-300">
        <motion.div
          className="h-full bg-teal-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-xl border-2 border-zinc-900 bg-white p-6 shadow-[12px_12px_0_#18181b]"
      >
        <div className="mb-6 flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-red-500" />
            <span className="h-2.5 w-2.5 bg-amber-400" />
            <span className="h-2.5 w-2.5 bg-teal-500" />
          </div>
          <span className="font-mono text-[10px] font-black uppercase tracking-widest text-zinc-400">pipeline.log</span>
        </div>

        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center border-2 border-zinc-900 bg-zinc-950 text-teal-300 shadow-[6px_6px_0_#14b8a6]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <Cpu className="h-12 w-12" />
          </motion.div>
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-end justify-center gap-2 font-mono">
            <span className="text-6xl font-black tracking-tighter text-zinc-950">{Math.round(progress)}</span>
            <span className="pb-2 text-xl font-black text-teal-700">%</span>
          </div>
          <p className="mx-auto min-h-10 max-w-md font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
            {status}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {steps.map(step => {
            const isActive = progress >= step.threshold && progress < step.next;
            const isDone = progress >= step.next;
            return (
              <div
                key={step.label}
                className={`border p-4 transition-colors ${
                  isActive
                    ? 'border-teal-500 bg-teal-50 text-teal-800'
                    : isDone
                      ? 'border-zinc-900 bg-zinc-950 text-teal-300'
                      : 'border-zinc-200 bg-white text-zinc-400'
                }`}
              >
                <step.icon className="mx-auto mb-3 h-5 w-5" />
                <span className="font-mono text-[10px] font-black uppercase tracking-widest">{step.label}</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default ProcessingOverlay;
