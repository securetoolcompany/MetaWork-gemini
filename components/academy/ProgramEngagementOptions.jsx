'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  DollarSign,
  Laptop,
  MapPin,
  Users,
} from 'lucide-react';

function DetailRow({ icon: Icon, label, value, colorClass }) {
  return (
    <div className="flex gap-3 border-l-2 border-white/10 py-2 pl-3">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${colorClass}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-sm leading-5 text-slate-200">{value}</p>
      </div>
    </div>
  );
}

export default function ProgramEngagementOptions({
  formats,
  accentPrimary = '#22D3EE',
  accentSecondary = '#2563EB',
}) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="mt-10 grid gap-5 lg:grid-cols-3">
      {formats.map((format, index) => {
        const isOpen = openIndex === index;

        return (
          <article
            key={format.label}
            className={`relative overflow-hidden border bg-[#09090B] shadow-xl shadow-black/20 transition ${
              isOpen
                ? 'border-cyan-400/55'
                : 'border-white/10 hover:border-cyan-400/30'
            }`}
          >
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{
                background: `linear-gradient(90deg, ${accentPrimary}, ${accentSecondary})`,
              }}
            />

            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="group flex w-full items-start justify-between gap-4 p-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset"
              aria-expanded={isOpen}
            >
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-md font-mono text-[10px] font-bold"
                    style={{
                      backgroundColor: `${accentPrimary}22`,
                      color: accentPrimary,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <p
                    className="font-mono text-[10px] font-medium uppercase tracking-[0.2em]"
                    style={{ color: accentPrimary }}
                  >
                    Starting option
                  </p>
                </div>

                <h3 className="mt-5 text-2xl font-black italic uppercase leading-none tracking-[-0.04em] text-slate-50">
                  {format.label}
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  {format.detail}
                </p>
              </div>

              <span
                className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition ${
                  isOpen
                    ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 group-hover:border-cyan-400/35 group-hover:text-cyan-200'
                }`}
              >
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="border-t border-white/10 bg-[#131722]/70 p-6">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
                    Program details
                  </p>

                  <div className="mt-5 space-y-2">
                    <DetailRow
                      icon={Clock3}
                      label="Typical duration"
                      value={format.duration || 'Defined during the planning conversation'}
                      colorClass="bg-cyan-400/10 text-cyan-200"
                    />

                    <DetailRow
                      icon={Users}
                      label="Recommended group"
                      value={format.groupSize || 'Sized to fit your program and learning goals'}
                      colorClass="bg-blue-500/10 text-blue-200"
                    />

                    <DetailRow
                      icon={format.deliveryMode === 'On-site' ? MapPin : Laptop}
                      label="Delivery"
                      value={format.deliveryMode || 'Virtual, on-site, or hybrid options'}
                      colorClass="bg-emerald-400/10 text-emerald-200"
                    />

                    <DetailRow
                      icon={CheckCircle2}
                      label="What you need"
                      value={format.requirements || 'A planning contact, learner group, and shared program goals'}
                      colorClass="bg-amber-400/10 text-amber-100"
                    />

                    <DetailRow
                      icon={DollarSign}
                      label="Investment"
                      value={format.pricing || 'Customized based on scope, group size, and delivery needs'}
                      colorClass="bg-violet-400/10 text-violet-200"
                    />
                  </div>

                  {format.includes?.length > 0 && (
                    <div className="mt-6 border-t border-white/10 pt-5">
                      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-300">
                        Includes
                      </p>

                      <ul className="mt-4 space-y-3">
                        {format.includes.map((item) => (
                          <li
                            key={item}
                            className="flex gap-3 text-sm leading-6 text-slate-300"
                          >
                            <CheckCircle2
                              className="mt-0.5 h-4 w-4 shrink-0"
                              style={{ color: accentPrimary }}
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <a
                    href="#start-a-conversation"
                    className="group mt-7 inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-extrabold italic uppercase tracking-wide text-white transition hover:bg-blue-500"
                  >
                    Ask about this option
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}