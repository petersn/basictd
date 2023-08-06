import React from 'react';
import ReactDOM from 'react-dom';
import { ILayoutResult, Rescaler } from './Rescaler';
import { Point, interpolate, dist, rotate, turnTowards } from './Interpolate';

const VERSION = 'v0.12';
const WIDTH = 1600;
const HEIGHT = 1000;
const CELL_SIZE = 50;
const CELL_COUNT_X = 24;
const CELL_COUNT_Y = 18;
const EDITOR = false;
const SELL_FRACTION = 0.8;

const SMALL_OFFSETS: Point[] = [
  [ -20.0, -20.0 ],
  [ -20.0,  20.0 ],
  [  20.0, -20.0 ],
  [  20.0,  20.0 ],
];

// const PATH: Point[] = [
//   [ 250.0, -10.0 ],
//   [ 250.0,  250.0 ],
//   [ 1320.0, 150.0 ],
//   [ 1320.0, 450.0 ],
//   [ 250.0, 450.0 ],
//   [ 300.0, 300.0 ],
//   [ 50.0,  300.0 ],
//   [ 50.0,  360.0 ],
//   [ 360.0, 360.0 ],
//   [ 360.0, 600.0 ],
// ];

const PATH: Point[] = [
  //[250,-10],[250,250],[1320,150],[1371,484],[593,794],[638,634],[1053,367],[146,543],[1269,755],[1460,931],
  [188, -10], [188, 250], [990, 150], [1028, 484], [445, 794], [478, 634], [790, 367], [110, 543], [952, 755], [1095, 931],
];

type GameState = 'wave' | 'build' | 'dead';

type TurretType = 'basic' | 'slow' | 'splash' | 'zapper' | 'fire' | 'laser' | 'wall' | 'repair';
const TURRET_TYPES: TurretType[] = [ 'basic', 'slow', 'splash', 'zapper', 'fire', 'laser', 'wall', 'repair' ];

interface Upgrade {
  name: string;
  description: string;
  cost: number;
}

interface TurretData {
  name: string;
  description: string;
  icon: string;
  cost: number;
  hp: number;
  range: number;
  minRange: number;
  damage: number;
  cooldown: number;
  maxUpgrades: number;
  upgrades: Upgrade[];
}

const TURRET_DATA: { [key in TurretType]: TurretData } = {
  basic: {
    name: 'Gun Turret',
    description: 'Shoots a 1 damage bullet every second.',
    icon: '🔫',
    cost: 100,
    hp: 5,
    range: 3.0,
    minRange: 0.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 4,
    upgrades: [
      {
        name: 'Range',
        description: 'Increases range by 3 tiles.',
        cost: 65,
      },
      {
        name: 'Velocity',
        description: 'Increases bullet velocity to 3x.',
        cost: 85,
      },
      {
        name: 'Rapid Fire',
        description: 'Doubles rate of fire.',
        cost: 280,
      },
      {
        name: 'Piercing',
        description: 'Bullets can hit one additional enemy.',
        cost: 240,
      },
      {
        name: 'Damage',
        description: 'Increases damage from 1 to 2.',
        cost: 160,
      },
      {
        name: 'Trishot',
        description: 'Shoots three bullets in a small spread.',
        cost: 300,
      },
    ],
  },
  slow: {
    name: 'Snow Machine',
    description: 'Slows enemy movement and attacks for 3 seconds, once every 5 seconds. Cancels out being on fire.',
    icon: '❄️',
    cost: 150,
    hp: 5,
    range: 1.5,
    minRange: 0.0,
    damage: 0,
    cooldown: 5.0,
    maxUpgrades: 2,
    upgrades: [
      {
        name: 'Deep Freeze',
        description: 'Increases slow duration to 6 seconds.',
        cost: 185,
      },
      {
        name: 'Blizzard',
        description: 'Increases range by 1 tile.',
        cost: 250,
      },
      {
        name: 'Rapid Fire',
        description: 'Doubles rate of fire.',
        cost: 275,
      },
    ],
  },
  splash: {
    name: 'Cannon',
    description: 'Shoots an explosive every 8 seconds, dealing 3 damage to up to 10 units.',
    icon: '💣', // 💥
    cost: 200,
    hp: 5,
    range: 4.5,
    minRange: 3.0,
    damage: 3,
    cooldown: 8.0,
    maxUpgrades: 4,
    upgrades: [
      {
        name: 'Distant Bombardment',
        description: 'Increase min and max range by 2 tiles.',
        cost: 75,
      },
      {
        name: 'Missiles',
        description: 'Increases projectile velocity to 3x.',
        cost: 120,
      },
      {
        name: 'Large Area',
        description: 'Increases explosion radius by 70%.',
        cost: 275,
      },
      {
        name: 'High Explosives',
        description: 'Doubles damage.',
        cost: 300,
      },
      {
        name: 'Very High Explosives',
        description: 'Doubles damage again.',
        cost: 450,
      },
      {
        name: 'Rapid Fire',
        description: 'Doubles rate of fire.',
        cost: 500,
      },
      {
        name: 'Cluster Bomb',
        description: 'Can damage up to 30 units.',
        cost: 850,
      },
    ],
  },
  zapper: {
    name: 'Zapper',
    description: 'Charges up every 2 seconds, and deals n² damage when released. Max charge: 3.',
    icon: '⚡',
    cost: 115,
    hp: 5,
    range: 3.0,
    minRange: 0.0,
    damage: 0,
    cooldown: 0.0, // Cooldown is controlled by recharging.
    maxUpgrades: 4,
    upgrades: [
      {
        name: 'Capacitors',
        description: 'Increases max charge by 3.',
        cost: 75,
      },
      {
        name: 'Batteries',
        description: 'Increases max charge by another 3.',
        cost: 95,
      },
      {
        name: 'Range',
        description: 'Increases range by 3 tiles.',
        cost: 125,
      },
      {
        name: 'Superconductors',
        description: 'Doubles recharge rate.',
        cost: 150,
      },
      {
        name: 'Targeting Computer',
        description: 'Never fires at enemies with <4 HP.',
        cost: 185,
      },
      {
        name: 'Chain Lightning',
        description: 'Lightning bounces to another enemy.',
        cost: 200,
      },
      {
        name: 'Lightning Storm',
        description: 'Lightning bounces to yet another enemy.',
        cost: 300,
      },
    ],
  },
  fire: {
    name: 'Flamethrower',
    description: 'Lights enemies on fire, damaging them, and making them move faster. Cancels out cold.',
    icon: '🔥',
    cost: 280,
    hp: 5,
    range: 2.5,
    minRange: 1.5,
    damage: 0,
    cooldown: 6.0,
    maxUpgrades: 3,
    upgrades: [
      {
        name: 'Napalm',
        description: 'Doubles fire damage (but over a longer time).',
        cost: 300,
      },
      {
        name: 'Rapid Fire',
        description: 'Doubles rate of fire.',
        cost: 450,
      },
    ],
  },
  laser: {
    name: 'Laser',
    description: 'Rotates very slowly towards the target enemy, and shoots forward, dealing 4 damage per second.',
    icon: '📡',
    cost: 400,
    hp: 5,
    range: 3.5,
    minRange: 0.0,
    damage: 1,
    cooldown: 0.0,
    maxUpgrades: 4,
    upgrades: [
      {
        name: 'Lubricant',
        description: 'Doubles swivel speed.',
        cost: 200,
      },
      {
        name: 'Range',
        description: 'Increases range by 3 tiles.',
        cost: 400,
      },
      {
        name: 'Better Optics',
        description: 'Doubles damage per second.',
        cost: 450,
      },
      {
        name: 'Best Optics',
        description: 'Doubles damage per second again.',
        cost: 900,
      },
      {
        name: 'X-ray Beam',
        description: 'Can pass through an enemy, damaging a second.',
        cost: 1150,
      },
      {
        name: 'Sweeper',
        description: 'Simply always swivels clockwise, but quadruples damage per second.',
        cost: 1500,
      },
    ],
  },
  wall: {
    name: 'Wall',
    description: 'Blocks enemy attacks.',
    icon: '🧱',
    cost: 20,
    hp: 10,
    range: 0,
    minRange: 0.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 0,
    upgrades: [

    ],
  },
  repair: {
    name: 'Repair Station',
    description: 'Repairs nearby turrets.',
    icon: '🔧',
    cost: 350,
    hp: 5,
    range: 3.0,
    minRange: 0.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 2,
    upgrades: [
      {
        name: 'Repair Capacity',
        description: 'Triples the storage of repair charges.',
        cost: 150,
      },
      {
        name: 'Repair Range',
        description: 'Increases range by 2 tiles.',
        cost: 220,
      },
      {
        name: 'Repair Speed',
        description: 'Doubles repair speed.',
        cost: 395,
      },
    ],
  },
};

class Turret {
  hp: number;
  maxHp: number;
  dead: boolean = false;
  type: TurretType;
  cooldown: number;
  upgrades: string[];
  investedGold: number = 0;
  zapCharge: number = 0;
  heading: number = 2 * Math.PI * Math.random();
  laserDamageAccumulator: number = 0;

  constructor(type: TurretType) {
    const data = TURRET_DATA[type];
    this.hp = data.hp;
    this.maxHp = data.hp;
    this.type = type;
    this.cooldown = 0;
    this.upgrades = [];
    this.investedGold = data.cost;
  }
}

interface CellContents {
  blocked: boolean;
  turret: Turret | null;
}

class Enemy {
  id: string;
  t: number = 0;
  pos: Point = [ 0, 0 ];
  speed: number;
  hp: number;
  gold: number;
  color: string;
  size: number;
  cold: number = 0.0;
  burning: number = 0.0;
  scratch: number = 0;
  shootCooldown: number = 0;
  maxShootCooldown: number = 0;
  shootDamage: number = 0;

  constructor(speed: number, hp: number, gold: number, color: string, size: number) {
    this.id = Math.random().toString() + Math.random().toString();
    this.speed = speed;
    this.hp = hp;
    this.gold = gold;
    this.color = color;
    this.size = size;
  }

  update(app: App, dt: number) {
    // Never slow down to less than 25% speed.
    const coldFactor = 1.0 / Math.min(3.0, 1.0 + this.cold)
    let thisFrameSpeed = this.speed * coldFactor;
    if (this.burning > 0.2)
      thisFrameSpeed *= 1.65;
    if (this.cold > 0.1 && Math.random() < Math.min(0.2, this.cold / 5.0)) {
      const frost = new GroundEffect([
        this.pos[0] + (Math.random() - 0.5) * 10,
        this.pos[1] + (Math.random() - 0.5) * 10,
      ], 15.0, -10, '#aaf');
      frost.dropRate = 20.0 + 10 * Math.random();
      app.effects.push(frost);
    }
    this.t += dt * thisFrameSpeed * 0.01;
    this.cold = Math.min(Math.max(0, this.cold - dt), 30.0);
    this.pos = interpolate(app.level.linearPoints, this.t);
    if (this.t >= 1) {
      app.hp -= Math.max(0, Math.round(this.hp));
      this.hp = 0;
      // Enemies that cross the finish don't give gold.
      this.gold = 0;
    }
    if (this.burning > 0.2) {
      const burnRate = this.burning / 6.0;
      this.burning -= burnRate * dt;
      this.hp = accountDamage(this.hp, 'fire', burnRate * dt);
      for (const col of [ '#f00', '#ff0' ])
        if (Math.random() < 0.2)
          app.effects.push(new GroundEffect([
            this.pos[0] + (Math.random() - 0.5) * 10,
            this.pos[1] + (Math.random() - 0.5) * 10,
          ], 15.0, -20, col));
    }
    if (this.shootDamage > 0) {
      this.shootCooldown -= dt * coldFactor;
      if (this.shootCooldown <= 0) {
        this.shootCooldown = this.maxShootCooldown;
        const b = new EnemyBullet(this.pos, 300.0, this.shootDamage);
        b.size *= Math.sqrt(this.shootDamage);
        app.enemyBullets.push(b);
      }
    }
    // if (Math.random() < 0.05) {
    //   app.enemyBullets.push(new EnemyBullet(this.pos, 300.0, 1.0));
    // }
  }
}

const damageAttribution: { [key: string]: number } = {};
for (const type of TURRET_TYPES)
  damageAttribution[type] = 0;

function accountDamage(hp: number, type: string, amount: number) {
  damageAttribution[type] += Math.max(0, Math.min(hp, amount));
  return hp - amount;
}

class GroundEffect {
  id: string;
  pos: Point = [ 0, 0 ];
  size: number = 0;
  dsizedt: number = 0;
  dropRate: number = 0;
  color: string = 'white';
  opacity: number = 0.3;

  constructor(pos: Point, size: number, dsizedt: number, color: string) {
    this.id = Math.random().toString() + Math.random().toString();
    this.pos = [pos[0], pos[1]];
    this.size = size;
    this.dsizedt = dsizedt;
    this.color = color;
  }

  update(dt: number) {
    this.size = Math.max(0, this.size + dt * this.dsizedt);
    this.pos[1] += dt * this.dropRate;
  }

  render(): React.ReactNode {
    return (
      <div
        key={this.id}
        style={{
          position: 'absolute',
          left: this.pos[0] - this.size,
          top: this.pos[1] - this.size,
          width: 2 * this.size,
          height: 2 * this.size,
          borderRadius: '100%',
          backgroundColor: this.color,
          opacity: this.opacity,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />
    );
  }
}

interface BombDesc {
  radius: number;
  maximumEnemies: number;
  damage: number;
  trail: boolean;
}

class Bullet {
  id: string;
  pos: Point = [ 0, 0 ];
  speed: number;
  targetPos: Point;
  targetDelta: Point = [ 0, 0 ];
  targetEnemy: Enemy | null = null;
  size: number = 5.0;
  damage: number = 1;
  hp: number = 1;
  color: string = 'yellow';
  bombDesc: BombDesc | null = null;
  alreadyHit: Enemy[] = [];
  laser: number = 0;
  fire: number = 0;
  fireDistance: number = 0;
  counterName: TurretType;

  constructor(
    pos: Point,
    targetPos: Point,
    targetEnemy: Enemy | null,
    speed: number,
    counterName: TurretType,
  ) {
    this.id = Math.random().toString() + Math.random().toString();
    this.pos = [pos[0], pos[1]];
    this.speed = speed;
    this.counterName = counterName;
    this.targetPos = [targetPos[0], targetPos[1]];
    const dx = targetPos[0] - pos[0];
    const dy = targetPos[1] - pos[1];
    const d = dist(pos, targetPos) + 1e-6;
    this.targetDelta = [ speed * dx / d, speed * dy / d ];
    this.targetEnemy = targetEnemy;
  }

  update(app: App, dt: number) {
    // FIXME: I can adjust this 300 to trade off speed.
    let substeps = Math.max(1, Math.round(this.speed / 300.0));
    if (this.bombDesc?.trail && Math.random() < 0.4)
      app.effects.push(new GroundEffect(this.pos, 10.0, -20, '#aaa'));
    if (this.fire) {
      for (const col of [ '#f00', '#ff0' ])
        if (Math.random() < 0.1)
          app.effects.push(new GroundEffect(this.pos, 12.0, -25, col));
      this.fireDistance -= dt * this.speed;
      if (this.fireDistance <= 0)
        this.hp = 0;
    }
    if (this.laser) {
      substeps = this.laser / this.size;
      dt = this.laser;
    }
    for (let substep = 0; substep < substeps; substep++) {
      this.pos[0] += this.targetDelta[0] * dt / substeps;
      this.pos[1] += this.targetDelta[1] * dt / substeps;
      if (this.laser) {
        app.effects.push(new GroundEffect([this.pos[0], this.pos[1]], this.size, -100, '#0f0'));
      }
      // Try to find an enemy to hit, if we're not a bomb.
      if (this.bombDesc === null) {
        for (const enemy of app.enemies) {
          if (dist(this.pos, enemy.pos) <= enemy.size + this.size) {
            if (this.alreadyHit.includes(enemy))
              continue;
            enemy.hp = accountDamage(enemy.hp, this.counterName, this.damage);
            enemy.burning += this.fire;
            if (this.fire > 0)
              enemy.cold = 0;
            this.hp -= 1;
            this.alreadyHit.push(enemy);
            break;
          }
        }
      } else {
        // If we are a bomb, check if we're close enough to explode.
        if (dist(this.pos, this.targetPos) <= this.size) {
          this.hp = 0;
          let hitsRemaining = this.bombDesc.maximumEnemies;
          for (const enemy of app.enemies) {
            if (dist(this.pos, enemy.pos) <= enemy.size + this.bombDesc.radius) {
              console.log('hit', this.bombDesc);
              enemy.hp = accountDamage(enemy.hp, this.counterName, this.bombDesc.damage);
              hitsRemaining--;
              if (hitsRemaining === 0)
                break;
            }
          }
          for (let i = 0; i < 12; i++) {
            const r = this.bombDesc.radius;
            let center: Point = [
              this.pos[0] + (Math.random() - 0.5) * r,
              this.pos[1] + (Math.random() - 0.5) * r,
            ];
            app.effects.push(new GroundEffect(center, r * 0.6, -r*1.5, 'red'));
            app.effects.push(new GroundEffect(center, r * 0.6 / 2, -r*0.75, 'yellow'));
          }
        }
      }
      if (this.hp === 0)
        break;
      // If we're out of bounds, then disappear.
      if (this.pos[0] < 0 || this.pos[0] > WIDTH - 400 || this.pos[1] < 0 || this.pos[1] > HEIGHT - 100) {
        this.hp = 0;
      }
    }
    if (this.laser)
      this.hp = 0;
  }
}

class EnemyBullet {
  id: string;
  pos: Point;
  size: number = 5.0;
  targetDelta: Point;
  damage: number;

  constructor(pos: Point, speed: number, damage: number) {
    this.id = Math.random().toString() + Math.random().toString();
    this.pos = [pos[0], pos[1]];
    const heading = Math.random() * Math.PI * 2;
    this.targetDelta = [ speed * Math.cos(heading), speed * Math.sin(heading) ];
    this.damage = damage;
  }

  update(app: App, dt: number) {
    this.pos[0] += this.targetDelta[0] * dt;
    this.pos[1] += this.targetDelta[1] * dt;
    const cellX = Math.floor(this.pos[0] / CELL_SIZE);
    const cellY = Math.floor(this.pos[1] / CELL_SIZE);
    if (cellX < 0 || cellX >= CELL_COUNT_X || cellY < 0 || cellY >= CELL_COUNT_Y) {
      this.damage = 0;
      return;
    }
    const cell = app.level.grid[cellY][cellX];
    if (cell.turret !== null && !cell.turret.dead) {
      let d = this.damage;
      if (cell.turret.type === 'wall')
        d *= 0.9;
      cell.turret.hp -= d;
      this.damage = 0;
    }
  }

  render(): React.ReactNode {
    return (
      <div
        key={this.id}
        style={{
          position: 'absolute',
          left: this.pos[0] - this.size,
          top: this.pos[1] - this.size,
          width: 2 * this.size,
          height: 2 * this.size,
          borderRadius: '100%',
          backgroundColor: '#000',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />
    );
  }
}

class Level {
  path: Point[];
  linearPoints: Point[];
  grid: CellContents[][];
  svgPath: string;

  constructor(path: Point[]) {
    this.path = path;
    this.grid = [];
    for (let y = 0; y < CELL_COUNT_Y; y++) {
      const row = [];
      for (let x = 0; x < CELL_COUNT_X; x++) {
        row.push({ blocked: false, turret: null });
      }
      this.grid.push(row);
    }
    // Compute blocked cells.
    for (let i = 0; i <= 2000; i++) {
      const t = i / 2000;
      const p = interpolate(PATH, t);
      for (const offset of SMALL_OFFSETS) {
        const x = Math.floor((p[0] + offset[0]) / CELL_SIZE);
        const y = Math.floor((p[1] + offset[1]) / CELL_SIZE);
        if (x < 0 || x >= this.grid[0].length || y < 0 || y >= this.grid.length) {
          continue;
        }
        this.grid[y][x].blocked = true;
      }
    }
    // Compute SVG path.
    this.svgPath = '';
    for (let i = 0; i <= 500; i++) {
      const t = i / 500;
      const p = interpolate(PATH, t);
      if (i === 0) {
        this.svgPath += `M${p[0]} ${p[1]}`;
      } else {
        this.svgPath += `L${p[0]} ${p[1]}`;
      }
    }
    // We now compute a linearly spaced set of points along the path.
    this.linearPoints = [ PATH[0] ];
    let candidatePoint = PATH[0];
    let t = 0;
    while (t < 1) {
      while (dist(candidatePoint, this.linearPoints[this.linearPoints.length - 1]) < 10 && t < 1) {
        t += 1e-5;
        candidatePoint = interpolate(PATH, t);
      }
      t = Math.min(t, 1);
      this.linearPoints.push(candidatePoint);
    }
  }
}

interface IAppProps {
  layout: ILayoutResult;
  rescaler: Rescaler;
}

class App extends React.PureComponent<IAppProps> {
  path: Point[] = [];
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  enemyBullets: EnemyBullet[] = [];
  effects: GroundEffect[] = [];
  level: Level;
  gold: number = 200;
  wave: number = 1;
  hp: number = 100;
  fastMode: boolean = false;
  waveTimer: number = 0;
  waveTimerMax: number = 1;
  selectedTurretType: TurretType | null = null;
  hoveredCell: CellContents | null = null;
  selectedCell: CellContents | null = null;
  enemySchedule: [number, Enemy][] = [];
  gameState: GameState = 'build';
  lastRafTime: number = 0;
  mousePos: Point = [ 0, 0 ];
  rafLoopHandle: number | null = null;

  // Handle editing.
  clickedKnot: {
    index: number;
  } | null = null;

  constructor(props: IAppProps) {
    super(props);
    this.path = PATH.slice();
    this.level = new Level(PATH);
  }

  componentDidMount() {
    document.getElementById('version')!.textContent = VERSION;
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.rafLoopHandle = requestAnimationFrame(this.rafLoop);
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    if (this.rafLoopHandle !== null) {
      cancelAnimationFrame(this.rafLoopHandle);
    }
  }

  onMouseMove = (e: MouseEvent) => {
    this.mousePos = this.props.rescaler.remapClientCoords( e.clientX, e.clientY );
  }

  onMouseUp = (e: MouseEvent) => {
    this.clickedKnot = null;
  }

  startWave = () => {
    if (this.gameState !== 'build')
      return;
    this.gold += 45;
    this.gameState = 'wave';
    this.waveTimerMax = 15 + 2.0 * Math.pow(this.wave, 0.6);
    this.waveTimer = 0;
    this.enemySchedule = [];
    let enemyDensity = 1.0 + Math.sqrt(this.wave / 2.0);
    //const enemyCount = this.waveTimerMax * enemyDensity;

    const fastWave = this.wave > 10 && (this.wave % 5 === 3);
    const shootyWave = this.wave > 15 && (this.wave % 7 === 1 || this.wave % 7 === 2 || this.wave % 7 === 5);
    const hordeWave = this.wave > 30 && (this.wave % 11 === 0);
    if (hordeWave) {
      enemyDensity *= 3.0;
    }

    let t = 0;
    let enemySizeBias = 0;
    let counter = 0;
    let enemyIndex = 0;
    while (t < this.waveTimerMax) {
      let enemyCost = 1.0;
      let speed = 2.0;
      let biasAdder = Math.pow(this.wave, 0.65);
      if (fastWave) {
        biasAdder *= 0.5;
        speed *= 2.0;
      }
      if (hordeWave) {
        biasAdder /= 1.5;
      }
      const enemyTypes: [string, number, number, number, number, number][] = [
        ['red',      1,    1,     1, 1.0,  14],
        ['blue',     2,    2,   1.8, 1.0,  16],
        ['green',    4,    5,   2.2, 1.0,  18],
        ['yellow',  12,   20,     4, 1.0,  20],
        ['black',   60,  100,    18, 0.75, 22],
        ['pink',   400, 1000,   150, 0.5,  24],
      ];
      let index = Math.floor(Math.pow(Math.max(enemySizeBias, 0) / 5.0, 0.65));
      if (enemyIndex % 6 === 0 || enemyIndex % 6 === 1) {
        index = 0;
      }
      if (!fastWave && this.wave > 15 && this.wave % 3 === 0 && enemyIndex % 13 === 0) {
        index++;
      }
      const [color, subtract, hp, gold, speedMult, size] = enemyTypes[Math.min(index, enemyTypes.length - 1)];
      enemySizeBias -= subtract;
      const enemy = new Enemy(speed * speedMult, hp, gold, color, size);
      if (shootyWave || (this.wave > 10 && this.wave % 2 === 1 && enemyIndex % 2 === 0)) {
        biasAdder *= 0.8;
        enemy.maxShootCooldown = 3.0;
        enemy.shootDamage = 1;
        if (enemy.color === 'yellow') {
          enemy.shootCooldown = 2.5;
          enemy.shootDamage += 1;
        }
        if (enemy.color === 'black') {
          enemy.shootCooldown = 2.0;
          enemy.shootDamage += 2;
        }
        if (enemy.color === 'pink') {
          enemy.shootCooldown = 2.0;
          enemy.shootDamage += 4;
        }
      }
      this.enemySchedule.push([t, enemy]);
      enemySizeBias += biasAdder;

      enemyIndex++;
      counter++;
      if (counter > 10.0 + Math.pow(this.wave, 0.75)) {
        t += 2.0;
        counter = 0;
      }

      t += enemyCost / enemyDensity;
    }

    // let t = 0;
    // while (t < this.waveTimerMax) {
    //   // // Generate a subwave description.
    //   // let validHps: [string, number, number][] = [['red', 1, 14]];
    //   // if (this.wave >= 5) validHps.push(['blue', 2, 16]);
    //   // if (this.wave >= 10) validHps.push(['green', 5, 18]);
    //   // if (this.wave >= 20) validHps.push(['yellow', 20, 20]);
    //   // if (this.wave >= 30) validHps.push(['black', 100, 25]);
    //   // // Pick a random mixture of enemy types.
    //   // const mixture: [string, number, number, number][] = [];
    //   // for (let i = 0; i < 3; i++) {
    //   //   const [color, hp, size] = validHps[Math.floor(Math.random() * validHps.length)];
    //   //   const speed = 2.0 + Math.random() * 1.0;
    //   //   mixture.push([color, hp, size, speed]);
    //   // }

    //   const subwaveDuration = 5.0 + Math.random() * 3.0;
    //   const waveEnd = Math.min(t + subwaveDuration, this.waveTimerMax);
    //   let i = 0;
    //   while (t < waveEnd) {
    //     const [color, hp, size, speed] = mixture[i % mixture.length];
    //     this.enemySchedule.push([ t, new Enemy(speed, hp, hp, color, size) ]);
    //     t += 1.0 / enemyDensity;
    //     i++;
    //   }
    //   t += 1.0 + Math.random();
    // }

    // for (let i = 0; i < enemyCount; i++) {
    //   //const lerp = i / enemyCount;
    //   //const hp = Math.floor(1 + this.wave * 0.2);
    //   //const gold = hp;
    //   //const size = 14 + hp * 0.5;
    //   //this.enemySchedule.push([ lerp * this.waveTimerMax, new Enemy(2.0, hp, gold, 'red', size) ]);
    // }
    this.enemySchedule.sort((a, b) => a[0] - b[0]);
  }

  clickCell = (e: React.MouseEvent, x: number, y: number) => {
    if (this.gameState === 'dead')
      return;
    // Check if we're buying, or selecting.
    const cell = this.level.grid[y][x];
    if (cell.turret === null) {
      if (this.selectedTurretType !== null) {
        e.stopPropagation();
        const selectedTurretTypeData = TURRET_DATA[this.selectedTurretType];
        // Buying
        if (this.gold >= selectedTurretTypeData.cost) {
          cell.turret = new Turret(this.selectedTurretType);
          this.gold -= selectedTurretTypeData.cost;
        }
      }
    } else {
      e.stopPropagation();
      // Selecting
      this.selectedCell = cell;
      this.selectedTurretType = null;
    }
  }

  clickUpgradeButton = (upgrade: Upgrade) => {
    if (
      this.selectedCell !== null &&
      this.selectedCell.turret !== null &&
      !this.selectedCell.turret.upgrades.includes(upgrade.name) &&
      this.gold >= upgrade.cost &&
      this.selectedCell.turret.upgrades.length < TURRET_DATA[this.selectedCell.turret.type].maxUpgrades
    ) {
      this.selectedCell.turret.upgrades.push(upgrade.name);
      this.selectedCell.turret.investedGold += upgrade.cost;
      this.gold -= upgrade.cost;
    }
  }

  sellCell = (cell: CellContents | null) => {
    if (cell === null)
      return;
    if (cell.turret !== null) {
      this.gold += Math.round(cell.turret.investedGold * SELL_FRACTION);
      cell.turret = null;
      this.selectedCell = null;
    }
  }

  computeTurretRange = (turret: Turret): number => {
    const data = TURRET_DATA[turret.type];
    let range = data.range;
    if (turret.upgrades.includes('Range'))
      range += 3;
    if (turret.upgrades.includes('Repair Range'))
      range += 2;
    if (turret.upgrades.includes('Blizzard'))
      range += 1;
    if (turret.upgrades.includes('Distant Bombardment'))
      range += 2;
    return range;
  }

  computeTurretMinRange = (turret: Turret): number => {
    const data = TURRET_DATA[turret.type];
    let minRange = data.minRange;
    if (turret.upgrades.includes('Distant Bombardment'))
      minRange += 2;
    return minRange;
  }

  computeTurretCooldown = (turret: Turret): number => {
    const data = TURRET_DATA[turret.type];
    let cooldown = data.cooldown;
    if (turret.upgrades.includes('Rapid Fire'))
      cooldown *= 0.5;
    return cooldown;
  }

  makeTurretBullets = (turret: Turret, pos: Point, furthestTarget: Enemy): Bullet[] => {
    const data = TURRET_DATA[turret.type];
    if (turret.type === 'splash') {
      let speed = 250.0;
      if (turret.upgrades.includes('Missiles'))
        speed *= 3.0;
      const b = new Bullet(pos, furthestTarget.pos, furthestTarget, speed, turret.type);
      b.size = 10.0;
      b.color = '#555';
      b.bombDesc = {
        radius: 1.5 * CELL_SIZE,
        damage: data.damage,
        maximumEnemies: 10,
        trail: turret.upgrades.includes('Missiles'),
      };
      if (turret.upgrades.includes('Large Area'))
        b.bombDesc.radius *= 1.7;
      if (turret.upgrades.includes('Cluster Bomb'))
        b.bombDesc.maximumEnemies *= 3;
      if (turret.upgrades.includes('High Explosives'))
        b.bombDesc.damage *= 2;
      if (turret.upgrades.includes('Very High Explosives'))
        b.bombDesc.damage *= 2;
      return [b];
    }

    let speed = 650.0;
    if (turret.upgrades.includes('Velocity'))
      speed *= 3.0;
    const bullets = [
      new Bullet(pos, furthestTarget.pos, furthestTarget, speed, turret.type),
    ];
    if (turret.upgrades.includes('Trishot')) {
      for (const turn of [-1, +1]) {
        const b = new Bullet(pos, furthestTarget.pos, furthestTarget, speed, turret.type);
        b.targetDelta = rotate(b.targetDelta, turn * Math.PI / 8);
        bullets.push(b);
      }
    }
    for (const bullet of bullets) {
      bullet.damage = data.damage;
      if (turret.upgrades.includes('Piercing')) {
        bullet.hp += 1;
        bullet.color = '#f84';
      }
      if (turret.upgrades.includes('Damage')) {
        bullet.damage += 1;
        bullet.size *= 1.5;
      }
    }
    return bullets;
  }

  rafLoop = (time: number) => {
    const elapsed = (time - this.lastRafTime) / 1000;
    const fps = 1 / (elapsed + 1e-6);
    document.getElementById('fps')!.textContent = fps.toFixed(1);
    let dt = Math.min(elapsed, 0.1);

    let reps = this.fastMode ? 5 : 1;
    for (let rep = 0; rep < reps; rep++) {
      // Update path.
      if (this.clickedKnot !== null) {
        const knot = this.path[this.clickedKnot.index];
        knot[0] = Math.round(this.mousePos[0]);
        knot[1] = Math.round(this.mousePos[1] - 100);
        this.level = new Level(this.path);
        console.log('update:', JSON.stringify(this.path));
      }
      // Update wave.
      if (this.gameState === 'wave') {
        this.waveTimer += dt;
        while (this.enemySchedule.length > 0 && this.enemySchedule[0][0] <= this.waveTimer) {
          const [ _, enemy ] = this.enemySchedule.shift()!;
          this.enemies.push(enemy);
        }
        if (this.waveTimer >= this.waveTimerMax) {
          this.waveTimer = 0;
          this.wave++;
          this.gameState = 'build';
        }
      }
      if (this.hp <= 0) {
        this.gameState = 'dead';
      }

      // Update enemies.
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];
        enemy.update(this, dt);
        if (enemy.hp <= 0) {
          this.enemies.splice(i, 1);
          i--;
          this.gold += enemy.gold;
        }
      }

      // Update effects.
      for (let i = 0; i < this.effects.length; i++) {
        const effect = this.effects[i];
        effect.update(dt);
        if (effect.size <= 0) {
          this.effects.splice(i, 1);
          i--;
        }
      }

      // Update all turrets.
      for (let y = 0; y < this.level.grid.length; y++) {
        const row = this.level.grid[y];
        for (let x = 0; x < row.length; x++) {
          const cell = row[x];
          if (cell.turret !== null) {
            const turret = cell.turret;
            const pos: Point = [(x + 0.5) * CELL_SIZE, (y + 0.5) * CELL_SIZE];

            // Check for deadness.
            if (turret.hp <= 0) {
              turret.dead = true;
              turret.zapCharge = 0;
            }
            const HEAL_RATE = this.enemies.length > 0 ? 0.12 : 0.0;
            turret.hp = Math.min(turret.maxHp, turret.hp + HEAL_RATE * dt);
            if (turret.dead) {
              if (turret.hp >= turret.maxHp) {
                turret.dead = false;
              }
              continue;
            }

            if (turret.type === 'repair') {
              // Find the most damaged turret in range.
              let leastHp = 100000;
              let leastHpTurret = null;
              let leastHpPos = [0, 0];
              const range = this.computeTurretRange(turret);
              for (let dx = -range; dx <= range; dx++) {
                for (let dy = -range; dy <= range; dy++) {
                  let xx = x + dx;
                  let yy = y + dy;
                  if (xx < 0 || xx >= row.length || yy < 0 || yy >= this.level.grid.length)
                    continue;
                  const testCell = this.level.grid[yy][xx];
                  if (testCell.turret === null)
                    continue;
                  if (testCell.turret.hp < leastHp && testCell.turret.hp < testCell.turret.maxHp) {
                    leastHp = testCell.turret.hp;
                    leastHpTurret = testCell.turret;
                    leastHpPos = [(xx + 0.5) * CELL_SIZE, (yy + 0.5) * CELL_SIZE];
                  }
                }
              }
              if (turret.zapCharge >= 1 && leastHpTurret !== null) {
                turret.zapCharge -= 1;
                leastHpTurret.hp = Math.min(leastHpTurret.maxHp, leastHpTurret.hp + 1);
                for (let lerp = 0; lerp <= 1; lerp += 0.05) {
                  const lerpedPos: Point = [
                    lerp * pos[0] + (1 - lerp) * leastHpPos[0] + (Math.random() - 0.5) * 5,
                    lerp * pos[1] + (1 - lerp) * leastHpPos[1] + (Math.random() - 0.5) * 5,
                  ]
                  this.effects.push(new GroundEffect(lerpedPos, 10, -10, '#5f5'));
                }
              }
              let repairRate = 0.5;
              if (turret.upgrades.includes('Repair Speed'))
                repairRate *= 2.0;
              let maxRepairCharges = 5;
              if (turret.upgrades.includes('Repair Capacity'))
                maxRepairCharges *= 3;
              if (this.enemies.length > 0)
                turret.zapCharge = Math.min(maxRepairCharges, turret.zapCharge + repairRate * dt);
              continue;
            }

            turret.cooldown = Math.max(0, turret.cooldown - dt);
            const range = this.computeTurretRange(turret) * CELL_SIZE;
            const minRange = this.computeTurretMinRange(turret) * CELL_SIZE;

            if (turret.type === 'zapper') {
              let maxCharge = 3;
              if (turret.upgrades.includes('Capacitors'))
                maxCharge += 3;
              if (turret.upgrades.includes('Batteries'))
                maxCharge += 3;
              let rate = 0.5;
              if (turret.upgrades.includes('Superconductors'))
                rate *= 2.0;
              // We only recharge when there are enemies on screen.
              if (this.enemies.length > 0)
                turret.zapCharge = Math.min(maxCharge, turret.zapCharge + rate * dt);
            }

            if (turret.cooldown <= 0) {
              // Perform special behavior for each turret type.
              if (turret.type === 'slow') {
                let coldAmount = 3.0;
                if (turret.upgrades.includes('Deep Freeze'))
                  coldAmount += 3.0;

                let doAttack = false;
                for (const enemy of this.enemies) {
                  const d = dist(pos, enemy.pos) - enemy.size - 10.0;
                  if (minRange <= d && d <= range) {
                    enemy.cold += coldAmount;
                    enemy.burning = 0;
                    doAttack = true;
                  }
                }
                if (doAttack) {
                  turret.cooldown = this.computeTurretCooldown(turret);
                  this.effects.push(new GroundEffect(pos, range + 40, -150, '#aaf'));
                }
                continue;
              }

              // Find all valid targets.
              let clearZapCharge = false;
              const doAttackFrom = (self: App, pos: Point, chainCount: number, scratch: number) => {
                let furthestT = -1.0;
                let furthestTarget = null;
                const haveTargetingComputer = turret.upgrades.includes('Targeting Computer');
                for (const enemy of self.enemies) {
                  if (haveTargetingComputer && enemy.hp < 4)
                    continue;
                  if (enemy.scratch === scratch)
                    continue;
                  const d = dist(pos, enemy.pos) - enemy.size - 10.0;
                  if (minRange <= d && d <= range) {
                    if (enemy.t > furthestT) {
                      furthestT = enemy.t;
                      furthestTarget = enemy;
                    }
                  }
                }
                if (furthestTarget !== null) {
                  turret.cooldown = self.computeTurretCooldown(turret);
                  // If we're a zapper, zap the target.
                  if (turret.type === 'zapper') {
                    if (turret.zapCharge < 1.0)
                      return;
                    const zapAmount = Math.floor(turret.zapCharge);
                    clearZapCharge = true;
                    for (let i = 0; i < 30; i++) {
                      const lerp = i / 29;
                      const lerpPos: Point = [
                        lerp * pos[0] + (1 - lerp) * furthestTarget.pos[0] + (Math.random() - 0.5) * 10,
                        lerp * pos[1] + (1 - lerp) * furthestTarget.pos[1] + (Math.random() - 0.5) * 10,
                      ];
                      self.effects.push(new GroundEffect(lerpPos, 15 * Math.sqrt(zapAmount), -50, '#ff0'));
                    }
                    furthestTarget.hp = accountDamage(furthestTarget.hp, 'zapper', zapAmount * zapAmount);
                    if (chainCount > 0) {
                      furthestTarget.scratch = scratch;
                      doAttackFrom(self, furthestTarget.pos, chainCount - 1, scratch);
                    }
                  } else if (turret.type === 'laser') {
                    // Swivel towards the target.
                    const angleToTarget = Math.atan2(furthestTarget.pos[1] - pos[1], furthestTarget.pos[0] - pos[0]);
                    let laserDamageRate = 4.0;
                    if (turret.upgrades.includes('Better Optics'))
                      laserDamageRate *= 2.0;
                    if (turret.upgrades.includes('Best Optics'))
                      laserDamageRate *= 2.0;
                    let swivelRate = 0.2;
                    if (turret.upgrades.includes('Lubricant'))
                      swivelRate *= 2.0;
                    if (turret.upgrades.includes('Sweeper')) {
                      laserDamageRate *= 4.0;
                      turret.heading += swivelRate * dt;
                      turret.heading %= Math.PI * 2;
                    } else {
                      turret.heading = turnTowards(turret.heading, angleToTarget, swivelRate * dt);
                    }
                    const targetPoint: Point = [
                      pos[0] + Math.cos(turret.heading) * range,
                      pos[1] + Math.sin(turret.heading) * range,
                    ];
                    turret.laserDamageAccumulator += laserDamageRate * dt;
                    const b = new Bullet(pos, targetPoint, furthestTarget, 1.0, turret.type);
                    b.size = 10.0;
                    b.color = '#0f0';
                    b.laser = range;
                    b.damage = 0;
                    if (turret.upgrades.includes('X-ray Beam')) {
                      b.hp += 1;
                    }
                    if (turret.laserDamageAccumulator >= 1.0) {
                      b.damage = Math.floor(turret.laserDamageAccumulator);
                      turret.laserDamageAccumulator -= b.damage;
                      b.size += 2.0 * b.damage;
                    }
                    self.bullets.push(b);
                  } else if (turret.type === 'fire') {
                    const fireballCount = 50.0; //Math.round(range / 2.0);
                    let fireOutput = 0.4;
                    if (turret.upgrades.includes('Napalm'))
                      fireOutput *= 2.0;
                    for (let i = 0; i < fireballCount; i++) {
                      const heading = 2 * Math.PI * i / fireballCount;
                      const targetPoint: Point = [
                        pos[0] + Math.cos(heading) * range,
                        pos[1] + Math.sin(heading) * range,
                      ];
                      const b = new Bullet(pos, targetPoint, furthestTarget, 100.0 + 10 * Math.random(), turret.type);
                      b.size = 10.0;
                      b.damage = 0.0;
                      b.color = '#f00';
                      b.fire = fireOutput;
                      b.fireDistance = range + 10;
                      b.hp = 3; // Allow a little bit of penetration.
                      self.bullets.push(b);
                    }
                  } else {
                    self.bullets.push(...self.makeTurretBullets(turret, pos, furthestTarget));
                  }
                }
              };
              let maxChainCount = 0;
              if (turret.upgrades.includes('Chain Lightning'))
                maxChainCount += 1;
              if (turret.upgrades.includes('Lightning Storm'))
                maxChainCount += 1;
              const unique = Math.floor(1000000 * Math.random());
              doAttackFrom(this, pos, maxChainCount, unique);
              if (clearZapCharge)
                turret.zapCharge = 0;
            }
          }
        }
      }

      // Update all bullets.
      for (let i = 0; i < this.bullets.length; i++) {
        const bullet = this.bullets[i];
        bullet.update(this, dt);
        if (bullet.hp <= 0) {
          this.bullets.splice(i, 1);
          i--;
        }
      }
      // Update all enemy bullets.
      for (let i = 0; i < this.enemyBullets.length; i++) {
        const bullet = this.enemyBullets[i];
        bullet.update(this, dt);
        if (bullet.damage <= 0) {
          this.enemyBullets.splice(i, 1);
          i--;
        }
      }
    }

    const hoveredCellX = Math.floor(this.mousePos[0] / CELL_SIZE);
    const hoveredCellY = Math.floor((this.mousePos[1] - 100) / CELL_SIZE);
    if (hoveredCellX >= 0 && hoveredCellX < this.level.grid[0].length && hoveredCellY >= 0 && hoveredCellY < this.level.grid.length) {
      const cell = this.level.grid[hoveredCellY][hoveredCellX];
      if (!cell.blocked) {
        this.hoveredCell = cell;
      } else {
        this.hoveredCell = null;
      }
    } else {
      this.hoveredCell = null;
    }

    // // Spawn timer.
    // if (Math.random() < 0.01) {
    //   this.enemies.push(new Enemy(2, 1, 1));
    // }
    // Loop again.
    this.forceUpdate();
    this.lastRafTime = time;
    this.rafLoopHandle = requestAnimationFrame(this.rafLoop);
  }

  render() {
    const selectedTurretTypeData = this.selectedTurretType === null ? null : TURRET_DATA[this.selectedTurretType];
    let shownTurretTypeData = selectedTurretTypeData;

    const knots = [];
    if (EDITOR) {
      for (let i = 0; i < this.path.length; i++) {
        const point = this.path[i];
        knots.push(<div
          key={`${point[0]},${point[1]}`}
          style={{
            position: 'absolute',
            left: point[0] - 10,
            top: point[1] - 10,
            width: 20,
            height: 20,
            background: '#fff',
            border: '1px solid #333',
            borderRadius: 10,
            zIndex: 1000,
          }}
          // Drag handler
          onMouseDown={(e) => {
            e.preventDefault();
            console.log('down');
            this.clickedKnot = {
              index: i,
            };
          }}
        />);
      }
    }

    // // Show the linear points.
    // for (const linPoint of this.level.linearPoints) {
    //   knots.push(<div
    //     key={`${linPoint[0]},${linPoint[1]}`}
    //     style={{
    //       position: 'absolute',
    //       left: linPoint[0] - 5,
    //       top: linPoint[1] - 5,
    //       width: 10,
    //       height: 10,
    //       background: '#f00',
    //       borderRadius: 5,
    //       zIndex: 1,
    //     }}
    //   />);
    // }

    const cells = [];
    for (let y = 0; y < this.level.grid.length; y++) {
      const row = this.level.grid[y];
      for (let x = 0; x < row.length; x++) {
        const cell = row[x];
        if (!cell.blocked) {
          let upgradeCount = 0;
          let zapCharge = 0;
          let preview = null;
          let turretBackgroundColor = '#444';
          let previewOpacity = 1.0;
          if (cell.turret === null && cell == this.hoveredCell && selectedTurretTypeData !== null && selectedTurretTypeData.cost <= this.gold) {
            preview = selectedTurretTypeData.icon;
            previewOpacity = 0.4;
          }
          if (cell.turret !== null) {
            preview = TURRET_DATA[cell.turret.type].icon;
            if (cell === this.selectedCell) {
              shownTurretTypeData = TURRET_DATA[cell.turret.type];
            }
            upgradeCount = cell.turret.upgrades.length;
            zapCharge = cell.turret.zapCharge;
            const damageLerp = cell.turret.hp / cell.turret.maxHp;
            const r = 68 + 187 * (1 - damageLerp);
            turretBackgroundColor = `rgba(${r}, 68, 68, 1.0)`;
            if (cell.turret.dead) {
              previewOpacity = 0.3;
            }
          }

          cells.push(<div
            key={`${x},${y}`}
            style={{
              position: 'absolute',
              //boxSizing: 'border-box',
              border: this.selectedCell === cell ? '2px solid yellow' : '1px solid #333',
              left: x * CELL_SIZE,
              top: y * CELL_SIZE,
              width: CELL_SIZE - 1,
              height: CELL_SIZE - 1,
              zIndex: (+(this.hoveredCell === cell)) + (+(this.selectedCell == cell)),
            }}
            onClick={(e) => this.clickCell(e, x, y)}
            className={cell.turret !== null ? 'hoverButton' : ''}
          >
            {preview !== null && <div style={{
              opacity: previewOpacity,
              width: CELL_SIZE - 1,
              height: CELL_SIZE - 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              backgroundColor: turretBackgroundColor,
              userSelect: 'none',
              position: 'relative',
            }}>
              {preview}
              {upgradeCount > 0 && <div style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                fontSize: 14,
                color: '#0f0',
              }}>+{upgradeCount}</div>}
              {zapCharge > 0 && <div style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                fontSize: 14,
                color: '#ff0',
              }}>{Math.floor(zapCharge)}</div>}
            </div>}
          </div>);
          // Push a range indicator, if hovered.
          if (cell === this.hoveredCell) {
            let offerRange = selectedTurretTypeData === null ? 0 : selectedTurretTypeData.range;
            let offerMinRange = selectedTurretTypeData === null ? 0 : selectedTurretTypeData.minRange;
            if (selectedTurretTypeData !== null && this.gold < selectedTurretTypeData.cost) {
              offerRange = 0;
              offerMinRange = 0;
            }
            const range = cell.turret !== null ? this.computeTurretRange(cell.turret) : offerRange;
            const minRange = cell.turret !== null ? this.computeTurretMinRange(cell.turret) : offerMinRange;
            const isSquare = cell.turret?.type === 'repair' || this.selectedTurretType === 'repair';
            let stopColor = 'rgb(255,0,0)';
            if (cell.turret?.type === 'slow' || this.selectedTurretType === 'slow') {
              stopColor = 'rgb(0,0,255)';
            }
            if (range > 0) {
              if (isSquare) {
                cells.push(<div
                  key={`${x},${y}-range`}
                  style={{
                    position: 'absolute',
                    left: x * CELL_SIZE - range * CELL_SIZE,
                    top: y * CELL_SIZE - range * CELL_SIZE,
                    width: CELL_SIZE * (range * 2 + 1),
                    height: CELL_SIZE * (range * 2 + 1),
                    zIndex: 10,
                    opacity: 0.2,
                    backgroundColor: '#00f',
                    pointerEvents: 'none',
                  }}
                />);
              } else {
                const innerPercent = minRange / range * 100;
                // Draw an annulus.
                cells.push(<svg
                  key={`${x},${y}-range`}
                  style={{
                    position: 'absolute',
                    left: x * CELL_SIZE - range * CELL_SIZE,
                    top: y * CELL_SIZE - range * CELL_SIZE,
                    width: CELL_SIZE * (range * 2 + 1),
                    height: CELL_SIZE * (range * 2 + 1),
                    zIndex: 10,
                    opacity: 0.2,
                    pointerEvents: 'none',
                  }}
                  viewBox={`0 0 300 300`}
                >
                  <defs>
                    <radialGradient id="gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset={`${innerPercent}%`} style={{stopColor, stopOpacity: 0}} />
                      <stop offset={`${innerPercent + 0.1}%`} style={{stopColor, stopOpacity: 1}} />
                      <stop offset="100%" style={{stopColor, stopOpacity: 1}} />
                    </radialGradient>
                  </defs>
                  <circle cx="150" cy="150" r="150" fill="url(#gradient)" />
                </svg>);
              }

                /*                 <defs>
                  <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" style={{stopColor: 'rgba(255, 255, 255, 0.0)', stopOpacity: 0}} />
                    <stop offset="100%" style={{stopColor: 'rgba(255, 255, 255, 0.0)', stopOpacity: 1}} />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="50" fill="url(#grad1)" /> */


              // cells.push(<div
              //   key={`${x},${y}-range`}
              //   style={{
              //     position: 'absolute',
              //     left: x * CELL_SIZE - range * CELL_SIZE,
              //     top: y * CELL_SIZE - range * CELL_SIZE,
              //     width: CELL_SIZE * (range * 2 + 1),
              //     height: CELL_SIZE * (range * 2 + 1),
              //     backgroundColor: 'red',
              //     borderRadius: '100%',
              //     opacity: 0.1,
              //     pointerEvents: 'none',
              //     zIndex: 10,
              //   }}
              // />);
            }
          }
        }
      }
    }

    const movingThings = [];
    for (const enemy of this.enemies) {
      movingThings.push(<div
        key={enemy.id}
        style={{
          position: 'absolute',
          left: enemy.pos[0] - enemy.size,
          top: enemy.pos[1] - enemy.size,
          width: 2*enemy.size,
          height: 2*enemy.size,
          border: '1px solid black',
          background: enemy.color,
          borderRadius: enemy.size,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />);
    }
    for (const bullet of this.bullets) {
      movingThings.push(<div
        key={bullet.id}
        style={{
          position: 'absolute',
          left: bullet.pos[0] - bullet.size,
          top: bullet.pos[1] - bullet.size,
          width: 2*bullet.size,
          height: 2*bullet.size,
          border: '1px solid black',
          background: bullet.color,
          borderRadius: bullet.size,
          pointerEvents: 'none',
          zIndex: 8,
        }}
      />);
    }
    for (const enemyBullet of this.enemyBullets) {
      movingThings.push(enemyBullet.render());
    }

    for (const effect of this.effects) {
      movingThings.push(effect.render());
    }

    function colorText(color: string, text: string | number) {
      return <span style={{ color, textShadow: '0 0 2px #000' }}>{text}</span>;
    }
    let progressText = (Math.min(100.0 * this.waveTimer / this.waveTimerMax, 99.9).toFixed(1) + '%').padStart(6);

    let rightBarContents = `Enemies: ${this.enemies.length} Bullets: ${this.bullets.length}`;

    return <div>
      {/* Top bar */}
      <div style={{
        width: this.props.layout.width,
        height: 100,
        background: '#333',
        color: '#fff',
        display: 'flex',
        position:'absolute',
        alignItems: 'center',
        fontSize: 42,
        zIndex: 500,
      }}>
        <div style={{
          marginLeft: 20,
          width: 350,
        }}>
          <div>Gold:&nbsp; {colorText('yellow', Math.floor(this.gold))}</div>
          <div>Lives: {colorText('red', this.hp)}</div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          border: '1px solid black',
          borderRadius: 5,
          backgroundColor: '#252525',
          width: 80,
          height: 80,
          marginRight: 20,
          userSelect: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 50,
        }} onClick={() => this.fastMode = !this.fastMode}
          className='hoverButton'
        >
          <span style={{ marginTop: -5 }}>{this.fastMode ? '🐇' : '🐢'}</span> {/* ▶ */}
        </div>

        <div>
          <div>Wave: {colorText('cyan', this.wave)}</div>
          <div>Prog:
            <span style={{ whiteSpace: 'pre' }}>{progressText}</span>
          </div>
        </div>

        <div style={{
          border: '1px solid black',
          borderRadius: 5,
          backgroundColor: '#252525',
          padding: 5,
          marginLeft: 20,
          marginRight: 20,
          opacity: this.gameState === 'build' ? 1 : 0.2,
          cursor: this.gameState === 'build' ? 'pointer' : 'default',
          userSelect: 'none',
        }} className={
          this.gameState === 'build' ? 'hoverButton' : undefined
        } onClick={this.startWave}>
          Start Wave
        </div>
      </div>

      <div style={{
        width: this.props.layout.width,
        position: 'absolute',
        top: 100,
        display: 'flex',
      }}>
        {/* Main field */}
        <div style={{
          width: this.props.layout.width - 400,
          height: this.props.layout.height - 100,
          background: this.gameState === 'dead' ? '#363' : '#484',
          position: 'relative',
        }}
          onClick={() => {
            this.selectedCell = null;
            this.selectedTurretType = null;
          }}
        >
          {knots}
          {cells}
          {movingThings}
          <svg
            width={this.props.layout.width - 400}
            height={this.props.layout.height - 100}
            viewBox={`0 0 ${WIDTH - 400} ${HEIGHT - 100}`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              pointerEvents: 'none',
            }}
          >
            <path
              d={this.level.svgPath}
              fill="none"
              stroke="#373"
              strokeWidth="20"
            />
          </svg>
        </div>

        {/* Right bar */}
        <div style={{
          width: 400,
          height: this.props.layout.height - 100,
          boxSizing: 'border-box',
          borderLeft: '1px solid black',
          borderTop: '1px solid black',
          padding: 10,
          fontSize: 24,
          background: '#3a3a3a',
          color: '#fff',
          zIndex: 50,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {TURRET_TYPES.map((turretType, i) => {
              const data = TURRET_DATA[turretType];
              return <div style={{
                height: 130,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    border: this.selectedTurretType === turretType ? '2px solid #fff' : '2px solid #111',
                    borderRadius: 5,
                    background: this.selectedTurretType === turretType ? '#555' : '#444',
                    marginLeft: 10,
                    marginTop: 10,
                    cursor: 'pointer',
                    userSelect: 'none',
                    // Center the text.
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 52,
                    opacity: this.gold >= data.cost ? 1 : 0.3,
                  }}
                  className='hoverButton'
                  onClick={(e) => {
                    this.selectedTurretType = turretType;
                    this.selectedCell = null;
                    this.forceUpdate();
                    e.stopPropagation();
                  }}
                >
                  {data.icon}
                </div>
                <span style={{ paddingLeft: 10, userSelect: 'none' }}>{colorText(this.gold >= data.cost ? 'yellow' : 'red', data.cost)}</span>
              </div>;
            })}
          </div>

          {shownTurretTypeData !== null && <div style={{ fontSize: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10, marginBottom: 5 }}>{shownTurretTypeData.name}
              &nbsp;<span style={{ fontWeight: 'normal', fontSize: 18 }}>(max {shownTurretTypeData.maxUpgrades} upgrades)</span></div>
            {shownTurretTypeData.description}
            <div
              style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}
            >
              {shownTurretTypeData.upgrades.map((upgrade, i) => {
                let clickable = false;
                let have = false;
                let maxedOut = null;
                if (
                  this.selectedCell !== null &&
                  this.selectedCell.turret !== null
                ) {
                  //if (this.gold >= upgrade.cost) {
                  clickable = true;
                  //}
                  if (this.selectedCell.turret.upgrades.includes(upgrade.name)) {
                    have = true;
                    clickable = false;
                  }
                  if (this.selectedCell.turret.upgrades.length >= TURRET_DATA[this.selectedCell.turret.type].maxUpgrades) {
                    maxedOut = <span style={{ fontSize: 14, opacity: 0.5 }}>Maxed out</span>;
                  }
                }

                return <div
                  style={{
                    border: '1px solid #111',
                    padding: 10,
                    userSelect: 'none',
                    background: have ? '#222' : '#333',
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                  className={clickable ? 'hoverButton hoverIncreaseZ' : 'hoverIncreaseZ'}
                  onClick={() => this.clickUpgradeButton(upgrade)}
                >
                  {upgrade.name}
                  <span style={{ float: 'right' }}>{maxedOut ? maxedOut : colorText(this.gold >= upgrade.cost ? 'yellow' : 'red', upgrade.cost)}</span>
                  <div style={{ fontSize: 14 }}>
                    {upgrade.description}
                  </div>
                </div>;
              })}

              {this.selectedCell?.turret && <div style={{
                marginTop: 10,
                border: '1px solid #111',
                padding: 10,
                userSelect: 'none',
                background: '#333',
              }} className='hoverButton' onClick={() => {
                this.sellCell(this.selectedCell);
              }}>
                Sell for {colorText('yellow', Math.round(this.selectedCell.turret.investedGold * SELL_FRACTION))}
              </div>}

              {this.selectedTurretType !== null && <div style={{ position: 'absolute', bottom: 5 }}>
                Total damage dealt: {Math.floor(damageAttribution[this.selectedTurretType])}
              </div>}
            </div>
          </div>}

          {/*rightBarContents*/}
        </div>
      </div>
    </div>;
  }
}

ReactDOM.render(
  <Rescaler
    layouts={[
      { width: WIDTH, height: HEIGHT, name: 'landscape' },
    ]}
  >
    {(layout, rescaler) => <App layout={layout} rescaler={rescaler} />}
  </Rescaler>,
  document.getElementById('root'),
);
