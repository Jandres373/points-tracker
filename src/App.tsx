import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Lock, 
  Unlock, 
  Plus, 
  Minus, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  AlertCircle,
  RefreshCw,
  Award,
  Flame,
  CheckCircle2
} from 'lucide-react';

interface PointsState {
  vivi: number;
  andy: number;
}

export default function App() {
  const [points, setPoints] = useState<PointsState>(() => {
    // Local storage fallback inicial
    const saved = localStorage.getItem('pts_cache');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { vivi: 0, andy: 0 };
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  // Guardar en cache local ante cada cambio
  useEffect(() => {
    localStorage.setItem('pts_cache', JSON.stringify(points));
  }, [points]);

  // Toast notification helper
  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Conectar con WebSocket / Cloudflare Durable Object
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/points`;

    let ws: WebSocket;
    let reconnectTimeout: any;

    const connectWebSocket = () => {
      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SYNC' && data.data) {
              setPoints({
                vivi: Number(data.data.vivi) || 0,
                andy: Number(data.data.andy) || 0,
              });
            } else if (data.type === 'ERROR') {
              notify(data.message || 'Error en la sincronización');
            }
          } catch (err) {
            console.error('Error parseando mensaje WS', err);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Reintento de reconexión automático
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    // Polling de respaldo en caso de que WS no esté soportado en localhost de Vite o CDN estricta
    const fallbackPoll = setInterval(async () => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        try {
          const res = await fetch('/api/points');
          if (res.ok) {
            const data = await res.json();
            setPoints({
              vivi: Number(data.vivi) || 0,
              andy: Number(data.andy) || 0,
            });
            setIsConnected(true);
          }
        } catch (e) {
          // Servidor local o sin backend levantado
        }
      }
    }, 4000);

    return () => {
      clearTimeout(reconnectTimeout);
      clearInterval(fallbackPoll);
      if (ws) ws.close();
    };
  }, []);

  // Validación de clave 0000
  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput === '0000') {
      setIsAuthenticated(true);
      setPinError('');
      setPinInput('');
      notify('¡Modo de edición activado!');
    } else {
      setPinError('Código incorrecto. Inténtalo de nuevo.');
      setPinInput('');
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      setPinError('');
      if (nextPin.length === 4) {
        if (nextPin === '0000') {
          setIsAuthenticated(true);
          setPinInput('');
          notify('¡Modo de edición activado!');
        } else {
          setPinError('Código incorrecto. Inténtalo de nuevo.');
          setPinInput('');
        }
      }
    }
  };

  // Modificar puntos (solo disponible si isAuthenticated)
  const modifyPoints = async (person: 'vivi' | 'andy', delta: number) => {
    if (!isAuthenticated) {
      notify('Debes ingresar la clave 0000 para editar');
      return;
    }

    setIsUpdating(true);

    // Actualización optimista local
    const targetPerson = person.toLowerCase() as 'vivi' | 'andy';
    setPoints((prev) => ({
      ...prev,
      [targetPerson]: Math.max(0, prev[targetPerson] + delta),
    }));

    // Enviar por WebSocket si está conectado
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'UPDATE_POINTS',
          person,
          delta,
          pin: '0000',
        })
      );
      setIsUpdating(false);
      return;
    }

    // Fallback vía REST API
    try {
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person, delta, pin: '0000' }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Fallo al sincronizar');
      }

      const data = await res.json();
      if (data.vivi !== undefined && data.andy !== undefined) {
        setPoints({ vivi: data.vivi, andy: data.andy });
      }
    } catch (err: any) {
      console.warn('API sync warning:', err.message);
      // Persistido en localStorage automáticamente
    } finally {
      setIsUpdating(false);
    }
  };

  const leader = points.vivi > points.andy ? 'vivi' : points.andy > points.vivi ? 'andy' : 'tie';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col justify-between p-4 sm:p-8">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Sparkles className="w-5 h-5 text-yellow-300" />
          <span className="font-medium text-sm">{notification}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4 py-4 border-b border-indigo-900/40">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-pink-500 to-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/25">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent">
              Points Tracker
            </h1>
            <p className="text-xs sm:text-sm text-indigo-300/70 font-medium">
              Marcador Realtime Cloudflare • Vivi vs Andy
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
            isConnected 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-pulse" />
                <span>Realtime Activo</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Modo Local / Desconectado</span>
              </>
            )}
          </div>

          {/* Auth status badge */}
          {isAuthenticated ? (
            <button
              onClick={() => {
                setIsAuthenticated(false);
                notify('Sesión de edición bloqueada');
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Haz clic para bloquear"
            >
              <Unlock className="w-3.5 h-3.5 text-rose-400" />
              <span>Bloquear</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Protegido con PIN</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center py-8 gap-8">
        {/* Score Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          
          {/* Card Vivi */}
          <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 backdrop-blur-xl border transition-all duration-300 ${
            leader === 'vivi' 
              ? 'bg-gradient-to-b from-pink-950/40 to-slate-900/80 border-pink-500/50 shadow-2xl shadow-pink-500/10 ring-2 ring-pink-500/30' 
              : 'bg-slate-900/60 border-slate-800/80 hover:border-pink-500/30'
          }`}>
            {leader === 'vivi' && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-pink-500/20 text-pink-300 px-3 py-1 rounded-full text-xs font-bold border border-pink-500/40">
                <Flame className="w-3.5 h-3.5 text-pink-400 fill-pink-400 animate-pulse" />
                <span>LIDERANDO</span>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xl font-black text-white shadow-md">
                V
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide">Puntos Vivi</h2>
                <p className="text-xs text-pink-300/60">Puntaje acumulado</p>
              </div>
            </div>

            <div className="my-8 text-center">
              <span className="text-6xl sm:text-7xl font-extrabold bg-gradient-to-br from-pink-300 via-rose-100 to-white bg-clip-text text-transparent font-mono tracking-tight drop-shadow-sm">
                {points.vivi}
              </span>
              <p className="text-xs uppercase tracking-widest text-pink-300/40 mt-1 font-semibold">
                puntos
              </p>
            </div>

            {/* Action buttons (only if authenticated) */}
            {isAuthenticated ? (
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-pink-500/20">
                <button
                  disabled={isUpdating || points.vivi <= 0}
                  onClick={() => modifyPoints('vivi', -1)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 active:scale-95 text-pink-300 font-semibold text-sm transition-all border border-pink-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                  <span>Restar 1</span>
                </button>
                <button
                  disabled={isUpdating}
                  onClick={() => modifyPoints('vivi', 1)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:scale-95 text-white font-semibold text-sm transition-all shadow-lg shadow-pink-600/25 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sumar 1</span>
                </button>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-800 text-center">
                <span className="text-xs text-slate-400 italic">
                  Ingresa la clave abajo para modificar
                </span>
              </div>
            )}
          </div>

          {/* Card Andy */}
          <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 backdrop-blur-xl border transition-all duration-300 ${
            leader === 'andy' 
              ? 'bg-gradient-to-b from-indigo-950/40 to-slate-900/80 border-indigo-500/50 shadow-2xl shadow-indigo-500/10 ring-2 ring-indigo-500/30' 
              : 'bg-slate-900/60 border-slate-800/80 hover:border-indigo-500/30'
          }`}>
            {leader === 'andy' && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold border border-indigo-500/40">
                <Flame className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400 animate-pulse" />
                <span>LIDERANDO</span>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center text-xl font-black text-white shadow-md">
                A
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide">Puntos Andy</h2>
                <p className="text-xs text-indigo-300/60">Puntaje acumulado</p>
              </div>
            </div>

            <div className="my-8 text-center">
              <span className="text-6xl sm:text-7xl font-extrabold bg-gradient-to-br from-cyan-300 via-indigo-100 to-white bg-clip-text text-transparent font-mono tracking-tight drop-shadow-sm">
                {points.andy}
              </span>
              <p className="text-xs uppercase tracking-widest text-indigo-300/40 mt-1 font-semibold">
                puntos
              </p>
            </div>

            {/* Action buttons (only if authenticated) */}
            {isAuthenticated ? (
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-indigo-500/20">
                <button
                  disabled={isUpdating || points.andy <= 0}
                  onClick={() => modifyPoints('andy', -1)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 active:scale-95 text-indigo-300 font-semibold text-sm transition-all border border-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                  <span>Restar 1</span>
                </button>
                <button
                  disabled={isUpdating}
                  onClick={() => modifyPoints('andy', 1)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 active:scale-95 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sumar 1</span>
                </button>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-800 text-center">
                <span className="text-xs text-slate-400 italic">
                  Ingresa la clave abajo para modificar
                </span>
              </div>
            )}
          </div>

        </div>

        {/* PIN Security Section */}
        {!isAuthenticated ? (
          <div className="max-w-md mx-auto w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Clave de Seguridad</h3>
            <p className="text-xs text-slate-400 text-center mb-6">
              Ingresa el código PIN <span className="font-mono text-indigo-300 font-semibold bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-800/40">0000</span> para desbloquear la suma y resta de puntos.
            </p>

            {/* PIN Dots Display */}
            <div className="flex gap-4 mb-6">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    pinInput.length > idx
                      ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-lg shadow-indigo-500/50'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-4 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                <AlertCircle className="w-4 h-4" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Numeric Keypad for fast input */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-xs mb-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].map((key) => {
                if (key === 'C') {
                  return (
                    <button
                      key={key}
                      onClick={() => setPinInput('')}
                      className="h-12 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 font-bold active:scale-95 transition cursor-pointer text-sm"
                    >
                      DEL
                    </button>
                  );
                }
                if (key === '✓') {
                  return (
                    <button
                      key={key}
                      onClick={() => handlePinSubmit()}
                      className="h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold active:scale-95 transition cursor-pointer flex items-center justify-center shadow-md shadow-indigo-600/30"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    onClick={() => handlePinDigit(key)}
                    className="h-12 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 active:bg-indigo-600 font-semibold text-lg text-slate-200 active:scale-95 transition border border-slate-700/40 cursor-pointer"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto w-full bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-300">Modo de edición desbloqueado</p>
                <p className="text-xs text-emerald-400/70">Puedes sumar o restar puntos libremente</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                notify('Sesión de edición bloqueada');
              }}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/30 transition cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-slate-800/60 text-xs text-slate-500">
        Cloudflare Pages & Realtime Durable Objects • Desarrollado para Vivi y Andy
      </footer>
    </div>
  );
}
