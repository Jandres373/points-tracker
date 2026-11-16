import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Lock, Unlock, Minus, Plus, X } from 'lucide-react';

interface PointsState {
  vivi: number;
  andy: number;
}

export default function App() {
  const [points, setPoints] = useState<PointsState>(() => {
    const saved = localStorage.getItem('pts_cache');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { vivi: 0, andy: 0 };
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    localStorage.setItem('pts_cache', JSON.stringify(points));
  }, [points]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // Conexión Cloudflare Pages Functions / WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/points`;

    let ws: WebSocket;
    let reconnectTimeout: any;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SYNC' && data.data) {
              setPoints({
                vivi: Number(data.data.vivi) || 0,
                andy: Number(data.data.andy) || 0,
              });
            } else if (data.type === 'ERROR') {
              showToast(data.message || 'Error en sincronización');
            }
          } catch (err) {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 3500);
        };
      } catch (e) {
        reconnectTimeout = setTimeout(connect, 3500);
      }
    };

    connect();

    // Fallback polling ligero
    const pollInterval = setInterval(async () => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch('/api/points');
          if (res.ok) {
            const data = await res.json();
            if (data.vivi !== undefined && data.andy !== undefined) {
              setPoints({
                vivi: Number(data.vivi) || 0,
                andy: Number(data.andy) || 0,
              });
            }
          }
        } catch (e) {}
      }
    }, 5000);

    return () => {
      clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
      if (ws) ws.close();
    };
  }, []);

  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const next = pinInput + digit;
      setPinInput(next);
      setPinError('');

      if (next.length === 4) {
        if (next === '0000') {
          setIsAuthenticated(true);
          setShowPinModal(false);
          setPinInput('');
          showToast('Edición desbloqueada');
        } else {
          setPinError('Clave incorrecta');
          setTimeout(() => {
            setPinInput('');
            setPinError('');
          }, 800);
        }
      }
    }
  };

  const modifyPoints = async (person: 'vivi' | 'andy', delta: number) => {
    if (!isAuthenticated) {
      setShowPinModal(true);
      return;
    }

    setIsSyncing(true);
    setPoints((prev) => ({
      ...prev,
      [person]: Math.max(0, prev[person] + delta),
    }));

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'UPDATE_POINTS',
          person,
          delta,
          pin: '0000',
        })
      );
      setIsSyncing(false);
      return;
    }

    try {
      await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person, delta, pin: '0000' }),
      });
    } catch (e) {
    } finally {
      setIsSyncing(false);
    }
  };

  // Posiciones de partículas glitter decorativas
  const glitterPoints = [
    { top: '12%', left: '8%', delay: '0s', duration: '3.2s', size: 10 },
    { top: '18%', right: '12%', delay: '1.4s', duration: '2.8s', size: 13 },
    { top: '48%', left: '4%', delay: '0.7s', duration: '3.6s', size: 9 },
    { top: '53%', right: '7%', delay: '2.1s', duration: '4s', size: 11 },
    { top: '84%', left: '14%', delay: '1.8s', duration: '3s', size: 12 },
    { top: '78%', right: '15%', delay: '0.4s', duration: '3.4s', size: 9 },
  ];

  return (
    <div className="relative min-h-[100dvh] flex flex-col justify-between max-w-md mx-auto px-6 py-7 select-none overflow-hidden">
      {/* Grano de papel overlay */}
      <div className="paper-grain" />

      {/* Partículas glitter flotantes sutiles */}
      {glitterPoints.map((pt, i) => (
        <div
          key={i}
          className="glitter-particle text-amber-700/60"
          style={{
            top: pt.top,
            left: pt.left,
            right: pt.right,
            animationDelay: pt.delay,
            animationDuration: pt.duration,
          }}
        >
          <Sparkles style={{ width: pt.size, height: pt.size }} />
        </div>
      ))}

      {/* Notificación Toast minimalista */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1c1917] text-[#f7f4ec] text-xs font-mono tracking-wider py-1.5 px-4 rounded-full shadow-lg border border-stone-800 flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span>{toast}</span>
        </div>
      )}

      {/* Encabezado: Tipografía editorial, sobria, sin cajas */}
      <header className="flex items-center justify-between pt-2 pb-5 border-b border-stone-800/15">
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-cinzel block">
            Registro de Puntos
          </span>
          <h1 className="text-xl font-normal tracking-tight text-stone-900 font-cinzel">
            Vivi & Andy
          </h1>
        </div>

        {/* Botón de bloqueo/desbloqueo minimalista */}
        <button
          onClick={() => {
            if (isAuthenticated) {
              setIsAuthenticated(false);
              showToast('Edición bloqueada');
            } else {
              setShowPinModal(true);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-800/20 hover:border-stone-800 bg-[#f7f4ec]/80 backdrop-blur-xs text-stone-800 text-xs font-mono transition-all active:scale-95 cursor-pointer"
        >
          {isAuthenticated ? (
            <>
              <Unlock className="w-3.5 h-3.5 text-stone-900" />
              <span className="text-[11px] uppercase tracking-wider font-semibold">Editar</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-[11px] uppercase tracking-wider text-stone-500">0000</span>
            </>
          )}
        </button>
      </header>

      {/* Contenido Principal Mobile-First: Formato continuo de pliego/página */}
      <main className="flex-1 flex flex-col justify-center divide-y divide-stone-800/15 py-6">
        
        {/* Sección Vivi */}
        <div className="flex flex-col justify-center py-8">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs uppercase tracking-[0.25em] text-stone-500 font-cinzel">
              I. Vivi
            </span>
            {points.vivi > points.andy && (
              <span className="flex items-center gap-1 text-[11px] tracking-widest uppercase font-mono text-stone-600">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Líder
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="font-mono-num text-7xl font-light text-stone-900 tracking-tighter">
              {String(points.vivi).padStart(2, '0')}
            </div>

            {/* Controles integrados sin cards */}
            <div className="flex items-center gap-3">
              <button
                disabled={isSyncing || points.vivi <= 0}
                onClick={() => modifyPoints('vivi', -1)}
                className="w-12 h-12 rounded-full border border-stone-800/25 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:border-stone-900 active:bg-stone-800 active:text-[#f7f4ec] transition-all disabled:opacity-20 cursor-pointer"
                title="Restar 1"
              >
                <Minus className="w-5 h-5 stroke-[1.5]" />
              </button>
              <button
                disabled={isSyncing}
                onClick={() => modifyPoints('vivi', 1)}
                className="w-12 h-12 rounded-full border border-stone-900 bg-stone-900 text-[#f7f4ec] flex items-center justify-center hover:bg-stone-800 active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Sumar 1"
              >
                <Plus className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* Sección Andy */}
        <div className="flex flex-col justify-center py-8">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs uppercase tracking-[0.25em] text-stone-500 font-cinzel">
              II. Andy
            </span>
            {points.andy > points.vivi && (
              <span className="flex items-center gap-1 text-[11px] tracking-widest uppercase font-mono text-stone-600">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Líder
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="font-mono-num text-7xl font-light text-stone-900 tracking-tighter">
              {String(points.andy).padStart(2, '0')}
            </div>

            {/* Controles integrados sin cards */}
            <div className="flex items-center gap-3">
              <button
                disabled={isSyncing || points.andy <= 0}
                onClick={() => modifyPoints('andy', -1)}
                className="w-12 h-12 rounded-full border border-stone-800/25 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:border-stone-900 active:bg-stone-800 active:text-[#f7f4ec] transition-all disabled:opacity-20 cursor-pointer"
                title="Restar 1"
              >
                <Minus className="w-5 h-5 stroke-[1.5]" />
              </button>
              <button
                disabled={isSyncing}
                onClick={() => modifyPoints('andy', 1)}
                className="w-12 h-12 rounded-full border border-stone-900 bg-stone-900 text-[#f7f4ec] flex items-center justify-center hover:bg-stone-800 active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Sumar 1"
              >
                <Plus className="w-5 h-5 stroke-[1.5]" />
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* Pie de página con textura de grabado sutil */}
      <footer className="pt-4 border-t border-stone-800/15 flex items-center justify-between text-[11px] font-mono text-stone-400">
        <span className="tracking-widest uppercase">Cloudflare Realtime</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-700 inline-block"></span>
          {isAuthenticated ? 'Autorizado' : 'Solo lectura'}
        </span>
      </footer>

      {/* Modal Bottom Sheet / Teclado para PIN '0000' optimizado para Mobile */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-[#1c1917]/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="w-full max-w-md mx-auto bg-[#f7f4ec] border-t border-stone-800/20 px-6 pt-5 pb-8 rounded-t-3xl shadow-2xl relative">
            <button
              onClick={() => {
                setShowPinModal(false);
                setPinInput('');
                setPinError('');
              }}
              className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <span className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-cinzel block mb-1">
                Seguridad
              </span>
              <h3 className="text-lg font-cinzel text-stone-900 font-semibold">
                Ingresa la clave
              </h3>
              <p className="text-xs text-stone-500 font-mono mt-1">
                {pinError ? (
                  <span className="text-stone-900 font-bold">{pinError}</span>
                ) : (
                  'Ingresa 0000 para habilitar la suma o resta'
                )}
              </p>

              {/* Indicadores de 4 dígitos */}
              <div className="flex justify-center gap-3 mt-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                      pinInput.length > idx
                        ? 'bg-stone-900 border-stone-900 scale-110'
                        : 'border-stone-400 bg-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Teclado numérico sobrio */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'].map((key) => {
                if (key === 'C') {
                  return (
                    <button
                      key={key}
                      onClick={() => setPinInput('')}
                      className="h-13 rounded-2xl border border-stone-800/15 text-stone-500 font-mono text-xs font-semibold hover:border-stone-800 active:scale-95 transition cursor-pointer"
                    >
                      CLEAR
                    </button>
                  );
                }
                if (key === '←') {
                  return (
                    <button
                      key={key}
                      onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                      className="h-13 rounded-2xl border border-stone-800/15 text-stone-500 font-mono text-xs font-semibold hover:border-stone-800 active:scale-95 transition cursor-pointer"
                    >
                      DEL
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    onClick={() => handlePinDigit(key)}
                    className="h-13 rounded-2xl border border-stone-800/20 bg-[#f7f4ec] text-stone-900 font-mono-num text-xl hover:border-stone-900 active:bg-stone-900 active:text-[#f7f4ec] active:scale-95 transition cursor-pointer"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
