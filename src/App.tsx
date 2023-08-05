import React from 'react';
import ReactDOM from 'react-dom';
import { ILayoutResult, Rescaler } from './Rescaler';
import { Point, interpolate, dist, rotate } from './Interpolate';

const WIDTH = 1600;
const HEIGHT = 1000;
const CELL_SIZE = 50;
const CELL_COUNT_X = 24;
const CELL_COUNT_Y = 18;
const EDITOR = false;

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

type TurretType = 'basic' | 'slow' | 'splash' | 'magic' | 'laser' | 'wall' | 'repair' | 'miner';
const TURRET_TYPES: TurretType[] = [ 'basic', 'slow', 'splash', 'magic', 'laser', 'wall', 'repair', 'miner' ];

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
  damage: number;
  cooldown: number;
  maxUpgrades: number;
  upgrades: Upgrade[];
}

const TURRET_DATA: { [key in TurretType]: TurretData } = {
  basic: {
    name: 'Basic Turret',
    description: 'Shoots a 1 damage bullet every second.',
    icon: '🔫',
    cost: 80,
    hp: 5,
    range: 3.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 3,
    upgrades: [
      {
        name: 'Range',
        description: 'Increases range by 3 tiles.',
        cost: 100,
      },
      {
        name: 'Velocity',
        description: 'Increases bullet velocity to 3x.',
        cost: 120,
      },
      {
        name: 'Rapid Fire',
        description: 'Increases fire rate by 50%.',
        cost: 150,
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
    name: 'Slow Turret',
    description: 'Slows enemies down.',
    icon: '❄️',
    cost: 8,
    hp: 5,
    range: 3.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 0,
    upgrades: [
      
    ],
  },
  splash: {
    name: 'Splash Turret',
    description: 'Shoots a bullet that explodes.',
    icon: '💥',
    cost: 12,
    hp: 5,
    range: 3.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 0,
    upgrades: [
      
    ],
  },
  magic: {
    name: 'Magic Turret',
    description: 'Shoots a bullet that can hit multiple enemies.',
    icon: '✨',
    cost: 20,
    hp: 5,
    range: 3.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 0,
    upgrades: [
      
    ],
  },
  laser: {
    name: 'Laser Turret',
    description: 'Shoots a laser that can hit multiple enemies.',
    icon: '🔥',
    cost: 30,
    hp: 5,
    range: 3.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 0,
    upgrades: [
      
    ],
  },
  wall: {
    name: 'Wall',
    description: 'Blocks enemies.',
    icon: '🧱',
    cost: 5,
    hp: 10,
    range: 0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 0,
    upgrades: [
      
    ],
  },
  repair: {
    name: 'Repair Turret',
    description: 'Repairs nearby turrets.',
    icon: '🔧',
    cost: 12,
    hp: 5,
    range: 3.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 0,
    upgrades: [
      
    ],
  },
  miner: {
    name: 'Miner',
    description: 'Mines gold.',
    icon: '⛏️',
    cost: 5,
    hp: 5,
    range: 0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 0,
    upgrades: [
      
    ],
  },
};

class Turret {
  hp: number;
  type: TurretType;
  cooldown: number;
  upgrades: string[];

  constructor(type: TurretType) {
    this.hp = TURRET_DATA[type].hp;
    this.type = type;
    this.cooldown = 0;
    this.upgrades = [];
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

  constructor(speed: number, hp: number, gold: number, color: string, size: number) {
    this.id = Math.random().toString() + Math.random().toString();
    this.speed = speed;
    this.hp = hp;
    this.gold = gold;
    this.color = color;
    this.size = size;
  }

  update(app: App, dt: number) {
    this.t += dt * this.speed * 0.01;
    this.pos = interpolate(app.level.linearPoints, this.t);
    if (this.t >= 1) {
      app.hp -= this.hp;
      this.hp = 0;
      // Enemies that cross the finish don't give gold.
      this.gold = 0;
    }
  }
}

class Bullet {
  id: string;
  pos: Point = [ 0, 0 ];
  speed: number;
  targetDelta: Point = [ 0, 0 ];
  targetEnemy: Enemy | null = null;
  size: number = 5.0;
  damage: number = 1;
  hp: number = 1;
  color: string = 'yellow';
  alreadyHit: Enemy[] = [];

  constructor(pos: Point, targetPos: Point, targetEnemy: Enemy | null, speed: number) {
    this.id = Math.random().toString() + Math.random().toString();
    this.pos = [pos[0], pos[1]];
    this.speed = speed;
    const dx = targetPos[0] - pos[0];
    const dy = targetPos[1] - pos[1];
    const d = dist(pos, targetPos) + 1e-6;
    this.targetDelta = [ speed * dx / d, speed * dy / d ];
    this.targetEnemy = targetEnemy;
  }

  update(app: App, dt: number) {
    let substeps = Math.max(1, Math.round(this.speed / 250.0));
    for (let substep = 0; substep < substeps; substep++) {
      this.pos[0] += this.targetDelta[0] * dt / substeps;
      this.pos[1] += this.targetDelta[1] * dt / substeps;
      // Try to find an enemy to hit.
      for (const enemy of app.enemies) {
        if (this.alreadyHit.includes(enemy))
          continue;
        if (dist(this.pos, enemy.pos) <= enemy.size + this.size) {
          enemy.hp -= this.damage;
          this.hp -= 1;
          this.alreadyHit.push(enemy);
          break;
        }
      }
      if (this.hp === 0)
        break;
      // If we're out of bounds, then disappear.
      if (this.pos[0] < 0 || this.pos[0] > WIDTH - 400 || this.pos[1] < 0 || this.pos[1] > HEIGHT - 100) {
        this.hp = 0;
      }
    }
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
    this.gameState = 'wave';
    this.waveTimerMax = 10 + 1.5 * this.wave;
    this.waveTimer = 0;
    this.enemySchedule = [];
    const enemyDensity = 1.0 + Math.sqrt(this.wave / 2.0);
    const enemyCount = this.waveTimerMax * enemyDensity;
    let t = 0;
    while (t < this.waveTimerMax) {
      // Generate a subwave description.
      let validHps: [string, number, number][] = [['red', 1, 14]];
      if (this.wave >= 5) validHps.push(['blue', 2, 16]);
      if (this.wave >= 10) validHps.push(['green', 5, 18]);
      if (this.wave >= 20) validHps.push(['yellow', 20, 20]);
      if (this.wave >= 30) validHps.push(['black', 100, 25]);
      // Pick a random mixture of enemy types.
      const mixture: [string, number, number, number][] = [];
      for (let i = 0; i < 3; i++) {
        const [color, hp, size] = validHps[Math.floor(Math.random() * validHps.length)];
        const speed = 2.0 + Math.random() * 1.0;
        mixture.push([color, hp, size, speed]);
      }

      const subwaveDuration = 5.0 + Math.random() * 3.0;
      const waveEnd = Math.min(t + subwaveDuration, this.waveTimerMax);
      let i = 0;
      while (t < waveEnd) {
        const [color, hp, size, speed] = mixture[i % mixture.length];
        this.enemySchedule.push([ t, new Enemy(speed, hp, hp, color, size) ]);
        t += 1.0 / enemyDensity;
        i++;
      }
      t += 1.0 + Math.random();
    }

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
      this.selectedCell.turret.upgrades.length <= TURRET_DATA[this.selectedCell.turret.type].maxUpgrades
    ) {
      this.selectedCell.turret.upgrades.push(upgrade.name);
      this.gold -= upgrade.cost;
    }
  }

  computeTurretRange = (turret: Turret): number => {
    const data = TURRET_DATA[turret.type];
    let range = data.range;
    if (turret.upgrades.includes('Range'))
      range += 3;
    return range;
  }

  computeTurretCooldown = (turret: Turret): number => {
    const data = TURRET_DATA[turret.type];
    let cooldown = data.cooldown;
    if (turret.upgrades.includes('Rapid Fire'))
      cooldown *= 0.6666;
    return cooldown;
  }

  makeTurretBullets = (turret: Turret, pos: Point, furthestTarget: Enemy): Bullet[] => {
    const data = TURRET_DATA[turret.type];
    let speed = 500.0;
    if (turret.upgrades.includes('Velocity'))
      speed *= 3.0;
    const bullets = [
      new Bullet(pos, furthestTarget.pos, furthestTarget, speed),
    ];
    if (turret.upgrades.includes('Trishot')) {
      for (const turn of [-1, +1]) {
        const b = new Bullet(pos, furthestTarget.pos, furthestTarget, speed);
        b.targetDelta = rotate(b.targetDelta, turn * Math.PI / 8);
        bullets.push(b);
      }
    }
    for (const bullet of bullets) {
      bullet.damage = data.damage;
      if (turret.upgrades.includes('Piercing'))
        bullet.hp += 1;
      if (turret.upgrades.includes('Damage'))
        bullet.damage += 1;
    }
    return bullets;
  }

  rafLoop = (time: number) => {
    let dt = Math.min((time - this.lastRafTime) / 1000, 0.1);

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

      // Update all turrets.
      for (let y = 0; y < this.level.grid.length; y++) {
        const row = this.level.grid[y];
        for (let x = 0; x < row.length; x++) {
          const cell = row[x];
          if (cell.turret !== null) {
            const turret = cell.turret;
            turret.cooldown = Math.max(0, turret.cooldown - dt);
            const pos: Point = [(x + 0.5) * CELL_SIZE, (y + 0.5) * CELL_SIZE];
            if (turret.cooldown <= 0) {
              // Find all valid targets.
              let furthestT = -1.0;
              let furthestTarget = null;
              const range = this.computeTurretRange(turret) * CELL_SIZE;
              for (const enemy of this.enemies) {
                const d = dist(pos, enemy.pos) - enemy.size - 10.0;
                if (d <= range) {
                  if (enemy.t > furthestT) {
                    furthestT = enemy.t;
                    furthestTarget = enemy;
                  }
                }
              }
              if (furthestTarget !== null) {
                turret.cooldown = this.computeTurretCooldown(turret);
                this.bullets.push(...this.makeTurretBullets(turret, pos, furthestTarget));
              }
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
          let preview = null;
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
              backgroundColor: '#444',
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
            </div>}
          </div>);
          // Push a range indicator, if hovered.
          if (cell === this.hoveredCell) {
            let offerRange = selectedTurretTypeData === null ? 0 : selectedTurretTypeData.range;
            if (selectedTurretTypeData !== null && this.gold < selectedTurretTypeData.cost) {
              offerRange = 0;
            }
            const range = cell.turret !== null ? this.computeTurretRange(cell.turret) : offerRange;
            if (range > 0) {
              cells.push(<div
                key={`${x},${y}-range`}
                style={{
                  position: 'absolute',
                  left: x * CELL_SIZE - range * CELL_SIZE,
                  top: y * CELL_SIZE - range * CELL_SIZE,
                  width: CELL_SIZE * (range * 2 + 1),
                  height: CELL_SIZE * (range * 2 + 1),
                  backgroundColor: 'red',
                  borderRadius: '100%',
                  opacity: 0.1,
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              />);
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
          zIndex: 8,
        }}
      />);
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
          <div>Gold:&nbsp; {colorText('yellow', this.gold)}</div>
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
          <span style={{ marginTop: -5 }}>{this.fastMode ? '▶▶' : '▶'}</span>
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

          {shownTurretTypeData !== null && <div>
            <h3>{shownTurretTypeData.name}</h3>
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
