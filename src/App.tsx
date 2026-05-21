import { useState, useEffect, useRef, useCallback } from 'react';

interface Tower {
  id: number; x: number; y: number; type: number; lastFired: number;
}
interface Enemy {
  id: number; x: number; y: number; hp: number; maxHp: number; pathIndex: number; speed: number; frozen: number;
}
interface Projectile {
  id: number; x: number; y: number; targetId: number; damage: number;
}
interface Wave {
  enemyCount: number; hp: number; speed: number; reward: number; isBoss: boolean;
}

const TILE = 40;
const COLS = 20;
const ROWS = 12;

const WAVE_DATA: Wave[] = [
  { enemyCount: 6, hp: 40, speed: 1, reward: 10, isBoss: false },
  { enemyCount: 10, hp: 70, speed: 1.2, reward: 15, isBoss: false },
  { enemyCount: 12, hp: 100, speed: 1.3, reward: 20, isBoss: false },
  { enemyCount: 8, hp: 150, speed: 1.5, reward: 25, isBoss: true },
  { enemyCount: 16, hp: 120, speed: 1.6, reward: 25, isBoss: false },
  { enemyCount: 20, hp: 180, speed: 1.8, reward: 30, isBoss: false },
  { enemyCount: 15, hp: 250, speed: 2, reward: 40, isBoss: false },
  { enemyCount: 10, hp: 400, speed: 1.5, reward: 60, isBoss: true },
  { enemyCount: 30, hp: 200, speed: 2.2, reward: 50, isBoss: false },
  { enemyCount: 1, hp: 2000, speed: 0.8, reward: 200, isBoss: true },
];

const PATH: [number, number][] = [
  [0,8],[1,8],[2,8],[3,8],[4,8],[4,7],[4,6],[4,5],[4,4],[4,3],
  [5,3],[6,3],[7,3],[8,3],[8,4],[8,5],[8,6],[8,7],[8,8],[8,9],
  [8,10],[9,10],[10,10],[11,10],[12,10],[12,9],[12,8],[12,7],[12,6],
  [13,6],[14,6],[15,6],[15,5],[15,4],[15,3],[16,3],[17,3],[18,3],[19,3],
];

const TOWER_COSTS = [60, 120, 200];
const TOWER_DAMAGE = [15, 35, 70];
const TOWER_RANGE = [90, 110, 130];
const TOWER_SLOW = [0, 0.5, 0.8];

export default function TowerDefense102() {
  const [gold, setGold] = useState(200);
  const [lives, setLives] = useState(25);
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [selected, setSelected] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const [placing, setPlacing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enemiesRef = useRef(enemies);
  const towersRef = useRef(towers);
  const projectilesRef = useRef(projectiles);

  enemiesRef.current = enemies; towersRef.current = towers; projectilesRef.current = projectiles;

  const isOnPath = useCallback((col: number, row: number) =>
    PATH.some(([pc,pr]) => pc === col && pr === row), []);

  const spawnEnemy = useCallback((waveData: Wave, id: number) => {
    const start = PATH[0];
    setEnemies(prev => [...prev, {
      id, x: start[0]*TILE+TILE/2, y: start[1]*TILE+TILE/2,
      hp: waveData.hp, maxHp: waveData.hp, pathIndex: 0, speed: waveData.speed, frozen: 0,
    }]);
  }, []);

  const startWave = useCallback(() => {
    if (wave >= WAVE_DATA.length) return;
    const data = WAVE_DATA[wave];
    let spawned = 0;
    const delay = data.isBoss ? 0 : 600;
    const interval = setInterval(() => {
      if (spawned >= data.enemyCount) { clearInterval(interval); return; }
      spawnEnemy(data, Date.now()+spawned);
      spawned++;
    }, delay);
  }, [wave, spawnEnemy, spawnEnemy]);

  useEffect(() => {
    if (!started || gameOver || won) return;
    if (enemies.length === 0 && wave < WAVE_DATA.length) {
      const t = setTimeout(startWave, 400);
      return () => clearTimeout(t);
    }
    if (enemies.length === 0 && wave >= WAVE_DATA.length) setWon(true);
  }, [started, enemies.length, wave, gameOver, won, startWave]);

  useEffect(() => {
    if (!started || gameOver || won) return;
    const id = setInterval(() => {
      const now = Date.now();
      const currentEnemies = enemiesRef.current;
      const currentTowers = towersRef.current;
      const newProjectiles: Projectile[] = [];
      const updated: Enemy[] = [];

      currentEnemies.forEach(enemy => {
        let { x, y, pathIndex, hp, speed, frozen } = enemy;
        if (frozen > 0) { frozen--; updated.push({ ...enemy, x, y, pathIndex, frozen }); return; }
        const target = PATH[pathIndex+1];
        if (!target) {
          setLives(l => { const n = l - (enemy.maxHp > 500 ? 10 : 1); if (n <= 0) setGameOver(true); return n; });
          return;
        }
        const tx = target[0]*TILE+TILE/2, ty = target[1]*TILE+TILE/2;
        const dx = tx-x, dy = ty-y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        const move = speed * 1.5;
        if (dist <= move) { x=tx; y=ty; pathIndex++; } else { x += (dx/dist)*move; y += (dy/dist)*move; }
        updated.push({ ...enemy, x, y, pathIndex, frozen });
      });

      currentTowers.forEach(tower => {
        const range = TOWER_RANGE[tower.type];
        const target = currentEnemies.find(e => {
          const dx = e.x-tower.x, dy = e.y-tower.y;
          return Math.sqrt(dx*dx+dy*dy) <= range && e.hp > 0;
        });
        if (target && now - tower.lastFired > 600) {
          newProjectiles.push({ id: now+tower.id, x: tower.x, y: tower.y, targetId: target.id, damage: TOWER_DAMAGE[tower.type] });
          tower.lastFired = now;
        }
      });
      setEnemies(updated); setProjectiles(prev => [...prev, ...newProjectiles]);
    }, 16);
    return () => clearInterval(id);
  }, [started, gameOver, won]);

  useEffect(() => {
    if (projectiles.length === 0) return;
    const id = setInterval(() => {
      const currentProjectiles = projectilesRef.current;
      const currentEnemies = enemiesRef.current;
      const hit: number[] = [];
      currentProjectiles.forEach(p => {
        const target = currentEnemies.find(e => e.id === p.targetId);
        if (!target) return;
        const dx = p.x-target.x, dy = p.y-target.y;
        if (Math.sqrt(dx*dx+dy*dy) < 22) {
          hit.push(p.id);
          const slow = TOWER_SLOW[p.damage > 50 ? 2 : p.damage > 25 ? 1 : 0];
          const newHp = target.hp - p.damage;
          if (newHp <= 0) {
            setGold(g => g + WAVE_DATA[wave]?.reward || 10);
            setScore(s => s + (target.maxHp > 500 ? 100 : 10));
            setEnemies(prev => prev.filter(e => e.id !== target.id));
          } else {
            setEnemies(prev => prev.map(e => e.id === target.id ? { ...e, hp: newHp, frozen: slow > 0 ? 20 : e.frozen } : e));
          }
        } else {
          const dx2 = target.x-p.x, dy2 = target.y-p.y;
          const dist = Math.sqrt(dx2*dx2+dy2*dy2);
          p.x += (dx2/dist)*10; p.y += (dy2/dist)*10;
        }
      });
      setProjectiles(prev => prev.filter(p => !hit.includes(p.id) && p.x > -50 && p.x < COLS*TILE+50 && p.y > -50 && p.y < ROWS*TILE+50));
    }, 16);
    return () => clearInterval(id);
  }, [projectiles.length, wave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const onPath = isOnPath(c, r);
        ctx.fillStyle = onPath ? '#5a6a7a' : '#1a3a4a';
        ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
        if (!onPath) {
          ctx.fillStyle = '#2a5a6a';
          ctx.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4);
        }
      }
    }

    ctx.strokeStyle = '#7a8a9a';
    ctx.lineWidth = TILE * 0.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const pc = PATH.map(([c,r]) => ({x:c*TILE+TILE/2,y:r*TILE+TILE/2}));
    ctx.moveTo(pc[0].x, pc[0].y);
    pc.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    towers.forEach(tower => {
      const colors = ['#00bcd4','#8e44ad','#ff5722'];
      ctx.fillStyle = colors[tower.type];
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 15, 0, Math.PI*2);
      ctx.fill();
      if (tower.type === 1) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, TOWER_RANGE[tower.type], 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(['❄','⚡','🔥'][tower.type], tower.x, tower.y);
    });

    enemies.forEach(enemy => {
      const isBoss = enemy.maxHp > 500;
      const isFrozen = enemy.frozen > 0;
      ctx.fillStyle = isBoss ? '#8e44ad' : isFrozen ? '#00bcd4' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, isBoss ? 16 : 10, 0, Math.PI*2);
      ctx.fill();
      if (isBoss) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', enemy.x, enemy.y - 20);
      }
      ctx.fillStyle = '#333';
      ctx.fillRect(enemy.x-12, enemy.y-18, 24, 4);
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(enemy.x-12, enemy.y-18, 24*(enemy.hp/enemy.maxHp), 4);
    });

    projectiles.forEach(p => {
      const col = p.damage > 50 ? '#ff5722' : p.damage > 25 ? '#8e44ad' : '#00bcd4';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
      ctx.fill();
    });
  }, [towers, enemies, projectiles, isOnPath]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!placing || gameOver || won) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const col = Math.floor((e.clientX - rect.left) / TILE);
    const row = Math.floor((e.clientY - rect.top) / TILE);
    if (isOnPath(col, row)) return;
    const cost = TOWER_COSTS[selected];
    if (gold < cost) return;
    setGold(g => g - cost);
    setTowers(prev => [...prev, { id: Date.now(), x: col*TILE+TILE/2, y: row*TILE+TILE/2, type: selected, lastFired: 0 }]);
  };

  const restart = () => {
    setGold(200); setLives(25); setWave(0); setScore(0);
    setTowers([]); setEnemies([]); setProjectiles([]);
    setGameOver(false); setWon(false); setStarted(false); setPlacing(false);
  };

  if (!started) return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-cyan-400 mb-4">❄️ ICE & FIRE TD ❄️</h1>
      <p className="text-gray-300 text-center max-w-md mb-6">10 waves with BOSS enemies. Ice tower slows, Lightning chain-strikes, Fire deals massive damage. Survive all waves to win!</p>
      <button onClick={() => setStarted(true)} className="px-8 py-4 bg-cyan-600 text-white text-xl font-bold rounded-lg hover:bg-cyan-700">START GAME</button>
    </div>
  );

  if (gameOver) return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-red-500 mb-4">GAME OVER</h1>
      <p className="text-white text-xl mb-2">Score: {score}</p>
      <button onClick={restart} className="px-8 py-4 bg-cyan-600 text-white text-xl font-bold rounded-lg hover:bg-cyan-700">TRY AGAIN</button>
    </div>
  );

  if (won) return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-green-400 mb-4">🎉 VICTORY!</h1>
      <p className="text-white text-xl mb-2">Score: {score}</p>
      <button onClick={restart} className="px-8 py-4 bg-cyan-600 text-white text-xl font-bold rounded-lg hover:bg-cyan-700">PLAY AGAIN</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-2">
      <div className="flex gap-6 mb-2">
        <span className="text-yellow-400 font-bold">💰 {gold}</span>
        <span className="text-red-400 font-bold">❤️ {lives}</span>
        <span className="text-cyan-400 font-bold">🌊 {wave+1}/{WAVE_DATA.length}</span>
        <span className="text-white font-bold">⭐ {score}</span>
      </div>
      <canvas ref={canvasRef} width={COLS*TILE} height={ROWS*TILE} onClick={handleClick} className="border-2 border-cyan-800 rounded cursor-crosshair" />
      <div className="flex gap-2 mt-3">
        {TOWER_COSTS.map((cost, i) => (
          <button key={i} onClick={() => { setSelected(i); setPlacing(true); }} className={`px-4 py-2 rounded font-bold ${selected===i ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
            {['❄ Ice','⚡ Lightning','🔥 Fire'][i]} — {cost}g
          </button>
        ))}
        <button onClick={() => setPlacing(false)} className="px-4 py-2 bg-gray-700 text-gray-300 rounded font-bold">Cancel</button>
      </div>
      {enemies.length === 0 && wave < WAVE_DATA.length && (
        <button onClick={() => setWave(w => w+1)} className="mt-3 px-6 py-2 bg-green-600 text-white font-bold rounded-lg">
          START WAVE {wave+1} {WAVE_DATA[wave]?.isBoss ? '👑 BOSS' : ''}
        </button>
      )}
    </div>
  );
}