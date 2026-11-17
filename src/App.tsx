import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Minus, Plus, X, Check, Edit2 } from 'lucide-react';

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

  // Acceso protegido: inicia siempre bloqueado hasta que ingrese el PIN 0000
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  // Estado para la edición manual directa del número
  const [manualModal, setManualModal] = useState<{ person: 'vivi' | 'andy'; value: string } | null>(null);

  // Cola y debounce para evitar race-conditions al pulsar rápido
  const pendingUpdatesRef = useRef<{ vivi?: number; andy?: number }>({});
  const debounceTimerRef = useRef<{ vivi?: any; andy?: any }>({});
  const isEditingRef = useRef<boolean>(false);

  useEffect(() => {
    localStorage.setItem('pts_cache', JSON.stringify(points));
  }, [points]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // Obtener puntos del servidor
  const fetchPoints = async () => {
    if (isEditingRef.current || pendingUpdatesRef.current.vivi !== undefined || pendingUpdatesRef.current.andy !== undefined) {
      return;
    }

    try {
      const res = await fetch('/api/points', { cache: 'no-store' });
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
  };

  useEffect(() => {
    fetchPoints();
    const interval = setInterval(fetchPoints, 3000);
    return () => clearInterval(interval);
  }, []);

  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const next = pinInput + digit;
      setPinInput(next);
      setPinError('');

      if (next.length === 4) {
        if (next === '0000') {
          setIsAuthenticated(true);
          setPinInput('');
          showToast('Bienvenido');
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

  // Enviar valor consolidado a Cloudflare
  const sendFinalUpdate = async (person: 'vivi' | 'andy', exactVal: number) => {
    try {
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person, exactValue: exactVal, pin: '0000' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Error al guardar');
      }
    } catch (e) {
      showToast('Error de conexión');
    } finally {
      delete pendingUpdatesRef.current[person];
      isEditingRef.current = false;
    }
  };

  // Modificar puntos por botones con debounce para toques rápidos
  const modifyPoints = (person: 'vivi' | 'andy', delta: number) => {
    if (!isAuthenticated) return;

    isEditingRef.current = true;

    setPoints((prev) => {
      const currentVal = prev[person];
      const newVal = Math.max(0, Math.round((currentVal + delta) * 10) / 10);
      pendingUpdatesRef.current[person] = newVal;

      if (debounceTimerRef.current[person]) {
        clearTimeout(debounceTimerRef.current[person]);
      }

      debounceTimerRef.current[person] = setTimeout(() => {
        sendFinalUpdate(person, newVal);
      }, 500);

      return {
        ...prev,
        [person]: newVal,
      };
    });
  };

  // Guardar edición manual directa del número
  const handleSaveManual = async () => {
    if (!manualModal || !isAuthenticated) return;
    const parsed = parseFloat(manualModal.value);
    if (isNaN(parsed) || parsed < 0) {
      showToast('Ingresa un número válido');
      return;
    }

    const finalVal = Math.round(parsed * 10) / 10;
    const person = manualModal.person;

    setPoints((prev) => ({
      ...prev,
      [person]: finalVal,
    }));

    setManualModal(null);
    await sendFinalUpdate(person, finalVal);
    showToast(`Puntaje de ${person === 'vivi' ? 'Vivi' : 'Andy'} actualizado`);
  };

  const handleOpenManual = (person: 'vivi' | 'andy') => {
    if (!isAuthenticated) return;
    setManualModal({
      person,
      value: points[person].toString(),
    });
  };

  const formatPoints = (val: number) => {
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  };

  // Puntos luminosos de glitter sutil
  const glitterDots = [
    { top: '10%', left: '12%', delay: '0s', duration: '3.4s', size: 3 },
    { top: '16%', right: '14%', delay: '1.2s', duration: '2.6s', size: 4 },
    { top: '38%', left: '7%', delay: '0.8s', duration: '3.8s', size: 3 },
    { top: '44%', right: '9%', delay: '2.2s', duration: '4s', size: 4.5 },
    { top: '72%', left: '11%', delay: '1.6s', duration: '3.2s', size: 3.5 },
    { top: '82%', right: '12%', delay: '0.4s', duration: '3.5s', size: 4 },
  ];

  return (
    <div className="relative min-h-[100dvh] flex flex-col justify-between max-w-md mx-auto px-6 py-6 select-none overflow-hidden">
      {/* Grano de papel overlay */}
      <div className="paper-grain" />

      {/* Puntos luminosos de glitter sutil */}
      {glitterDots.map((pt, i) => (
        <div
          key={i}
          className="glitter-dot"
          style={{
            top: pt.top,
            left: pt.left,
            right: pt.right,
            width: `${pt.size}px`,
            height: `${pt.size}px`,
            animationDelay: pt.delay,
            animationDuration: pt.duration,
          }}
        />
      ))}

      {/* Notificación Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1c1917] text-[#f7f4ec] text-xs font-mono tracking-wider py-1.5 px-4 rounded-full shadow-lg border border-stone-800 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span>{toast}</span>
        </div>
      )}

      {/* CONTENIDO DE LA APP: Se aplica blur completo e interactividad nula si no está autenticado */}
      <div className={`flex flex-col flex-1 justify-between transition-all duration-500 ${
        !isAuthenticated ? 'filter blur-md opacity-30 pointer-events-none select-none scale-[0.98]' : 'filter-none opacity-100 scale-100'
      }`}>
        {/* Encabezado */}
        <header className="flex items-center justify-between pt-2 pb-5 border-b border-stone-800/15">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-cinzel block">
              Registro de Puntos
            </span>
            <h1 className="text-xl font-normal tracking-tight text-stone-900 font-cinzel">
              Vivi & Andy
            </h1>
          </div>

          {/* Botón para bloquear y volver al PIN */}
          <button
            onClick={() => {
              setIsAuthenticated(false);
              showToast('Sesión bloqueada');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-800/20 hover:border-stone-800 bg-[#f7f4ec]/80 backdrop-blur-xs text-stone-800 text-xs font-mono transition-all active:scale-95 cursor-pointer"
            title="Bloquear acceso"
          >
            <Unlock className="w-3.5 h-3.5 text-stone-900" />
            <span className="text-[11px] uppercase tracking-wider font-semibold">Bloquear</span>
          </button>
        </header>

        {/* Contenido Principal Mobile: Secciones con números editables */}
        <main className="flex-1 flex flex-col justify-center divide-y divide-stone-800/15 py-4">
          
          {/* Sección Vivi */}
          <div className="flex flex-col justify-center py-6">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs uppercase tracking-[0.25em] text-stone-500 font-cinzel">
                I. Vivi
              </span>
              <span className="text-[10px] uppercase font-mono text-stone-400 tracking-wider">
                Toca el número para editar
              </span>
            </div>

            <div className="flex items-center justify-between">
              {/* Número con click/tap directo para modificar */}
              <button
                onClick={() => handleOpenManual('vivi')}
                className="text-left group cursor-pointer active:scale-98 transition flex items-baseline gap-2"
                title="Toca para ingresar el número manualmente"
              >
                <span className="font-mono-num text-6xl sm:text-7xl font-light text-stone-900 tracking-tighter group-hover:text-stone-700">
                  {formatPoints(points.vivi)}
                </span>
                <Edit2 className="w-3.5 h-3.5 text-stone-400 opacity-40 group-hover:opacity-100 transition" />
              </button>

              {/* Botones de acción (+0.5, +1, -0.5, -1) */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1.5">
                  <button
                    disabled={points.vivi < 0.5}
                    onClick={() => modifyPoints('vivi', -0.5)}
                    className="px-2.5 py-1 rounded-full border border-stone-800/25 text-[11px] font-mono text-stone-700 hover:text-stone-900 hover:border-stone-900 active:bg-stone-800 active:text-[#f7f4ec] transition-all disabled:opacity-20 cursor-pointer"
                    title="Restar 0.5"
                  >
                    -0.5
                  </button>
                  <button
                    disabled={points.vivi < 1}
                    onClick={() => modifyPoints('vivi', -1)}
                    className="w-10 h-10 rounded-full border border-stone-800/25 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:border-stone-900 active:bg-stone-800 active:text-[#f7f4ec] transition-all disabled:opacity-20 cursor-pointer"
                    title="Restar 1"
                  >
                    <Minus className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => modifyPoints('vivi', 0.5)}
                    className="px-2.5 py-1 rounded-full border border-stone-900 bg-stone-900 text-[#f7f4ec] text-[11px] font-mono hover:bg-stone-800 active:scale-95 transition-all cursor-pointer shadow-xs"
                    title="Sumar 0.5"
                  >
                    +0.5
                  </button>
                  <button
                    onClick={() => modifyPoints('vivi', 1)}
                    className="w-10 h-10 rounded-full border border-stone-900 bg-stone-900 text-[#f7f4ec] flex items-center justify-center hover:bg-stone-800 active:scale-95 transition-all cursor-pointer shadow-xs"
                    title="Sumar 1"
                  >
                    <Plus className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sección Andy */}
          <div className="flex flex-col justify-center py-6">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs uppercase tracking-[0.25em] text-stone-500 font-cinzel">
                II. Andy
              </span>
              <span className="text-[10px] uppercase font-mono text-stone-400 tracking-wider">
                Toca el número para editar
              </span>
            </div>

            <div className="flex items-center justify-between">
              {/* Número con click/tap directo para modificar */}
              <button
                onClick={() => handleOpenManual('andy')}
                className="text-left group cursor-pointer active:scale-98 transition flex items-baseline gap-2"
                title="Toca para ingresar el número manualmente"
              >
                <span className="font-mono-num text-6xl sm:text-7xl font-light text-stone-900 tracking-tighter group-hover:text-stone-700">
                  {formatPoints(points.andy)}
                </span>
                <Edit2 className="w-3.5 h-3.5 text-stone-400 opacity-40 group-hover:opacity-100 transition" />
              </button>

              {/* Botones de acción (+0.5, +1, -0.5, -1) */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1.5">
                  <button
                    disabled={points.andy < 0.5}
                    onClick={() => modifyPoints('andy', -0.5)}
                    className="px-2.5 py-1 rounded-full border border-stone-800/25 text-[11px] font-mono text-stone-700 hover:text-stone-900 hover:border-stone-900 active:bg-stone-800 active:text-[#f7f4ec] transition-all disabled:opacity-20 cursor-pointer"
                    title="Restar 0.5"
                  >
                    -0.5
                  </button>
                  <button
                    disabled={points.andy < 1}
                    onClick={() => modifyPoints('andy', -1)}
                    className="w-10 h-10 rounded-full border border-stone-800/25 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:border-stone-900 active:bg-stone-800 active:text-[#f7f4ec] transition-all disabled:opacity-20 cursor-pointer"
                    title="Restar 1"
                  >
                    <Minus className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => modifyPoints('andy', 0.5)}
                    className="px-2.5 py-1 rounded-full border border-stone-900 bg-stone-900 text-[#f7f4ec] text-[11px] font-mono hover:bg-stone-800 active:scale-95 transition-all cursor-pointer shadow-xs"
                    title="Sumar 0.5"
                  >
                    +0.5
                  </button>
                  <button
                    onClick={() => modifyPoints('andy', 1)}
                    className="w-10 h-10 rounded-full border border-stone-900 bg-stone-900 text-[#f7f4ec] flex items-center justify-center hover:bg-stone-800 active:scale-95 transition-all cursor-pointer shadow-xs"
                    title="Sumar 1"
                  >
                    <Plus className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </main>

        {/* Pie de página */}
        <footer className="pt-4 border-t border-stone-800/15 flex items-center justify-between text-[11px] font-mono text-stone-400">
          <span className="tracking-widest uppercase">Cloudflare Realtime</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-700 inline-block"></span>
            Autorizado
          </span>
        </footer>
      </div>

      {/* BLOQUEO TOTAL / PANTALLA DE ACCESO CON BLUR SI NO ESTÁ AUTENTICADO */}
      {!isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#f7f4ec]/60 backdrop-blur-xl">
          <div className="w-full max-w-xs text-center flex flex-col items-center">
            
            <div className="w-12 h-12 rounded-full border border-stone-800/20 bg-[#f7f4ec] flex items-center justify-center text-stone-800 mb-4 shadow-sm">
              <Lock className="w-5 h-5 stroke-[1.5]" />
            </div>

            <span className="text-[10px] uppercase tracking-[0.3em] text-stone-500 font-cinzel block mb-1">
              Registro Privado
            </span>
            <h2 className="text-xl font-cinzel text-stone-900 font-semibold tracking-tight mb-2">
              Vivi & Andy
            </h2>
            <p className="text-xs text-stone-500 font-mono mb-6">
              {pinError ? (
                <span className="text-rose-700 font-semibold">{pinError}</span>
              ) : (
                'Ingresa la clave para acceder'
              )}
            </p>

            {/* Indicadores de 4 dígitos */}
            <div className="flex justify-center gap-3.5 mb-8">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                    pinInput.length > idx
                      ? 'bg-stone-900 border-stone-900 scale-110 shadow-xs'
                      : 'border-stone-400 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {/* Teclado numérico sobrio */}
            <div className="grid grid-cols-3 gap-2.5 w-full">
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
                    className="h-13 rounded-2xl border border-stone-800/20 bg-[#f7f4ec] text-stone-900 font-mono-num text-xl hover:border-stone-900 active:bg-stone-900 active:text-[#f7f4ec] active:scale-95 transition cursor-pointer shadow-xs"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Modificar Número Manualmente */}
      {manualModal && (
        <div className="fixed inset-0 z-50 bg-[#1c1917]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#f7f4ec] border border-stone-800/20 p-6 rounded-3xl shadow-2xl relative">
            <button
              onClick={() => setManualModal(null)}
              className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-cinzel block mb-1">
              Editar Puntaje
            </span>
            <h3 className="text-base font-cinzel text-stone-900 font-semibold mb-4">
              Puntos de {manualModal.person === 'vivi' ? 'Vivi' : 'Andy'}
            </h3>

            <div className="relative mb-5">
              <input
                type="number"
                step="0.5"
                min="0"
                autoFocus
                value={manualModal.value}
                onChange={(e) => setManualModal({ ...manualModal, value: e.target.value })}
                className="w-full text-center text-4xl font-mono-num py-3 px-4 rounded-2xl bg-white border border-stone-800/20 text-stone-900 focus:outline-none focus:border-stone-900 font-light"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setManualModal(null)}
                className="flex-1 py-3 rounded-xl border border-stone-800/20 text-stone-600 font-mono text-xs hover:border-stone-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveManual}
                className="flex-1 py-3 rounded-xl bg-stone-900 text-[#f7f4ec] font-mono text-xs font-semibold hover:bg-stone-800 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
