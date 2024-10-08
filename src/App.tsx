import React from 'react';
import ReactDOM from 'react-dom';
import { ILayoutResult, Rescaler } from './Rescaler';
import { Point, interpolate, dist, rotate, turnTowards } from './Interpolate';

const VERSION = 'v0.103';
const WIDTH = 1600;
const HEIGHT = 1000;
const CELL_SIZE = 50;
const CELL_COUNT_X = 24;
const CELL_COUNT_Y = 18;
const EDITOR = false;
const SELL_FRACTION = 0.9;
const WIN_LEVEL = 61;

const FIELD_WIDTH = CELL_SIZE * CELL_COUNT_X;
const FIELD_HEIGHT = CELL_SIZE * CELL_COUNT_Y;

const SMALL_OFFSETS: Point[] = [
  [ -15.0, -15.0 ],
  [ -15.0,  15.0 ],
  [  15.0, -15.0 ],
  [  15.0,  15.0 ],
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

type GameState = 'wave' | 'build' | 'dead' | 'win';

type TurretType = 'basic' | 'slow' | 'splash' | 'zapper' | 'fire' | 'laser' | 'wall' | 'repair';
const TURRET_TYPES: TurretType[] = [ 'basic', 'slow', 'splash', 'zapper', 'fire', 'laser', 'wall', 'repair' ];

interface Upgrade {
  name: string;
  description: string;
  cost: number;
  mutExclusive?: string[];
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
    range: 4.0,
    minRange: 0.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 5,
    upgrades: [
      {
        name: 'Four-way Shot',
        description: 'Also shoots backwards, left, and right.',
        cost: 25,
      },
      {
        name: 'Sniper',
        description: 'Increases range by 3 tiles, and triples bullet velocity.',
        cost: 85,
      },
      {
        name: 'Super Sniper',
        description: 'Increases range by another 4 tiles.',
        cost: 350,
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
    description: 'Slows enemy movement and attacks for 3 seconds, once every 5 seconds. Reduces the effects of fire.',
    icon: '❄️',
    cost: 150,
    hp: 8,
    range: 2.0,
    minRange: 0.0,
    damage: 0,
    cooldown: 5.0,
    maxUpgrades: 2,
    upgrades: [
      {
        name: 'Deep Freeze',
        description: 'Increases slow duration to 6 seconds.',
        cost: 145,
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
    description: 'Shoots an explosive every 6 seconds, dealing 3 damage to up to 10 units.',
    icon: '💣', // 💥
    cost: 200,
    hp: 5,
    range: 4.5,
    minRange: 3.0,
    damage: 3,
    cooldown: 6.0,
    maxUpgrades: 5,
    upgrades: [
      //{
      //  name: 'Missiles',
      //  description: 'Increases projectile velocity to 3x.',
      //  cost: 95,
      //},
      {
        name: 'Cluster Bomb',
        description: 'Can damage up to 30 units.',
        cost: 125,
      },
      {
        name: 'Large Area',
        description: 'Increases explosion radius by 50%.',
        cost: 150,
      },
      {
        name: 'High Explosives',
        description: 'Doubles damage.',
        cost: 220,
      },
      {
        name: 'Very High Explosives',
        description: 'Doubles damage again.',
        cost: 400,
      },
      {
        name: 'Rapid Fire',
        description: 'Doubles rate of fire.',
        cost: 325,
      },
      {
        name: 'Distant Bombardment',
        description: 'Increase max range by 2 tiles, and projectile velocity to 3x.',
        cost: 200,
      },
    ],
  },
  zapper: {
    name: 'Zapper',
    description: 'Charges up one unit per 1.4 seconds, and deals n² damage when released. Max charge: 4.',
    icon: '⚡',
    cost: 110,
    hp: 5,
    range: 3.5,
    minRange: 0.0,
    damage: 0,
    cooldown: 0.0, // Cooldown is controlled by recharging.
    maxUpgrades: 5,
    upgrades: [
      //{
      //  name: 'Targeting Computer',
      //  description: 'Never fires at enemies with <15 HP.',
      //  cost: 0,
      //},
      {
        name: 'Capacitors',
        description: 'Increases max charge by 4.',
        cost: 75,
      },
      {
        name: 'Batteries',
        description: 'Increases max charge by another 8.',
        cost: 425,
      },
      {
        name: 'Superconductors',
        description: 'Doubles recharge rate.',
        cost: 160,
      },
      {
        name: 'Marx Generator',
        description: 'Never fires except at max charge.',
        cost: 175,
      },
      {
        name: 'Chain Lightning',
        description: 'Lightning bounces to another enemy.',
        cost: 185,
      },
      {
        name: 'Lightning Storm',
        description: 'Lightning bounces to yet another two enemies.',
        cost: 425,
      },
      {
        name: 'Range',
        description: 'Increases range by 1.5 tiles.',
        cost: 200,
      },
    ],
  },
  fire: {
    name: 'Flamethrower',
    description: 'Lights enemies on fire, damaging them over time. Reduces the effects of cold.',
    icon: '🔥',
    cost: 175,
    hp: 8,
    range: 2.5,
    minRange: 0.0,
    damage: 0,
    cooldown: 6.0,
    maxUpgrades: 5,
    upgrades: [
      {
        name: 'Strongtanium Armor',
        description: 'Halves all damage received.',
        cost: 150,
      },
      {
        name: 'Flame Range',
        description: 'Increases range by 2 tiles.',
        cost: 185,
      },
      {
        name: 'Napalm',
        description: 'Doubles fire damage (but over a longer time).',
        cost: 215,
      },
      {
        name: 'Napalmier Napalm',
        description: 'Doubles fire damage again.',
        cost: 360,
      },
      {
        name: 'Napalmiest Napalm',
        description: 'Doubles fire damage again again.',
        cost: 450,
      },
      {
        name: 'Rapid Fire',
        description: 'Doubles rate of fire.',
        cost: 250,
      },
    ],
  },
  laser: {
    name: 'Laser',
    description: 'Rotates very slowly towards the target enemy, and shoots forward, dealing 5 damage per second.',
    icon: '📡',
    cost: 350,
    hp: 5,
    range: 4.5,
    minRange: 0.0,
    damage: 1,
    cooldown: 0.0,
    maxUpgrades: 5,
    upgrades: [
      {
        name: 'Lubricant',
        description: 'Triples swivel speed.',
        cost: 0,
      },
      {
        name: 'Lens',
        description: 'Increases range by 2 tiles.',
        cost: 95,
      },
      {
        name: 'Clockwise Sweeper',
        description: 'Simply always swivels clockwise, but multiplies damage per second by 5.',
        cost: 200,
        mutExclusive: ['Counter-clockwise Sweeper'],
      },
      {
        name: 'Counter-clockwise Sweeper',
        description: 'Simply always swivels counter-clockwise, but multiplies damage per second by 5.',
        cost: 200,
        mutExclusive: ['Clockwise Sweeper'],
      },
      {
        name: 'Better Optics',
        description: 'Doubles damage per second.',
        cost: 375,
      },
      {
        name: 'Best Optics',
        description: 'Doubles damage per second again.',
        cost: 725,
      },
      {
        name: 'Bestest Optics',
        description: 'Doubles damage per second again again.',
        cost: 950,
      },
      {
        name: 'X-ray Beam',
        description: 'Can pass through an enemy, damaging a second.',
        cost: 450,
      },
    ],
  },
  wall: {
    name: 'Wall',
    description: 'Blocks enemy attacks, with double the HP of other towers. Takes only 70% damage, thus making more efficient use of repair resources.',
    icon: '🧱',
    cost: 20,
    hp: 10,
    range: 0,
    minRange: 0.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 3,
    upgrades: [
      {
        name: 'Strongtanium Armor',
        description: 'Halves all damage received.',
        cost: 150,
      },
      {
        name: 'Resilientanium Armor',
        description: 'Halves all damage received again.',
        cost: 375,
      },
      {
        name: 'Indestructiblanium Armor',
        description: 'Halves all damage received again again.',
        cost: 550,
      },
    ],
  },
  repair: {
    name: 'Repair Station',
    description: 'Repairs nearby turrets.',
    icon: '🔧',
    cost: 175,
    hp: 5,
    range: 3.0,
    minRange: 0.0,
    damage: 1,
    cooldown: 1.0,
    maxUpgrades: 3,
    upgrades: [
      {
        name: 'Repair Capacity',
        description: 'Multiplies the storage of repair charges by five.',
        cost: 25,
      },
      {
        name: 'Super Repair Capacity',
        description: 'Multiplies the storage of repair charges by ten.',
        cost: 100,
      },
      {
        name: 'Repair Range',
        description: 'Increases range by 2 tiles.',
        cost: 125,
      },
      {
        name: 'Repair Speed',
        description: 'Doubles repair speed.',
        cost: 250,
      },
      {
        name: 'Super Repair Speed',
        description: 'Doubles repair speed again.',
        cost: 650,
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
  maxHp: number;
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
    this.maxHp = hp;
    this.gold = gold;
    this.color = color;
    this.size = size;
  }

  update(app: App, dt: number) {
    // Never slow down to less than one third speed.
    const coldFactor = 1.0 / Math.min(3.0, 1.0 + this.cold)
    let thisFrameSpeed = this.speed * coldFactor;
    //if (this.burning > 1.0)
    //  thisFrameSpeed *= 1.45;
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
      app.hp -= Math.max(0, Math.round(Math.pow(this.hp, 0.7)));
      this.hp = 0;
      // Enemies that cross the finish don't give gold.
      this.gold = 0;
    }
    if (this.burning > 0.2) {
      const burnRate = this.burning / 5.0;
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
      this.shootCooldown -= dt * Math.pow(coldFactor, 0.63);
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
  pos: Point = [0, 0];
  size: number = 0;
  dsizedt: number = 0;
  dropRate: number = 0;
  color?: string = 'white';
  opacity: number = 0.3;
  text: string | null = null;
  textColor?: string;

  constructor(pos: Point, size: number, dsizedt: number, color?: string) {
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
          color: this.textColor,
          opacity: this.opacity,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {this.text}
      </div>
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
              enemy.cold *= 0.9;
            this.hp -= 1;
            this.alreadyHit.push(enemy);
            break;
          }
        }
      } else {
        // If we are a bomb, check if we're close enough to explode.
        if (dist(this.pos, this.targetPos) <= this.size) {
          this.hp = 0;
          let hits = 0; //this.bombDesc.maximumEnemies;
          for (const enemy of app.enemies) {
            if (dist(this.pos, enemy.pos) <= enemy.size + this.bombDesc.radius) {
              console.log('hit', this.bombDesc);
              enemy.hp = accountDamage(enemy.hp, this.counterName, this.bombDesc.damage);
              hits++;
              if (hits >= this.bombDesc.maximumEnemies)
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
          const countEffect = new GroundEffect(this.pos, 20.0, -15.0);
          countEffect.text = hits.toString();
          countEffect.textColor = 'white';
          countEffect.opacity = 1.0;
          app.effects.push(countEffect);
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
        d *= 0.7;
      if (cell.turret.upgrades.includes('Strongtanium Armor'))
        d *= 0.5;
      if (cell.turret.upgrades.includes('Resilientanium Armor'))
        d *= 0.5;
      if (cell.turret.upgrades.includes('Indestructiblanium Armor'))
        d *= 0.5;
      d *= app.cheatArmorMult;
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
  totalGameDt: number = 0;
  waveEndT: number = 0;
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
  cheatCode: string = '';
  cheatTurboRange: boolean = false;
  cheatFullAutoStart: boolean = false;
  cheatAutoStart: boolean = false;
  cheatHealMult: number = 1;
  cheatArmorMult: number = 1;

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
    window.addEventListener('keydown', this.onKeyDown);
    this.rafLoopHandle = requestAnimationFrame(this.rafLoop);
  }

  componentWillUnmount() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
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

  onKeyDown = (e: KeyboardEvent) => {
    if (
      this.selectedCell !== null &&
      this.selectedCell.turret !== null
    ) {
      const selectedTurretTypeData = TURRET_DATA[this.selectedCell.turret.type];
      for (let i = 0; i < 9; i++) {
        const key = (i + 1).toString();
        if (e.key === key && i < selectedTurretTypeData.upgrades.length) {
          this.clickUpgradeButton(selectedTurretTypeData.upgrades[i]);
        }
      }
    }
    this.cheatCode += e.key;
    if (this.cheatCode.length > 30) {
      this.cheatCode = this.cheatCode.slice(1);
    }
    for (const [cheatCode, f] of [
      ['smallmoney', () => { this.gold += 100; }],
      ['midmoney', () => { this.gold += 1000; }],
      ['money', () => { this.gold += 10000; }],
      ['range', () => { this.cheatTurboRange = true; }],
      ['fullauto', () => { this.cheatFullAutoStart = true; }],
      ['auto', () => { this.cheatAutoStart = true; }],
      ['turboheal', () => { this.cheatHealMult = 6; window.alert('Activated turbo heal'); }],
      ['noheal', () => { this.cheatHealMult = 0; window.alert('Activated no heal'); }],
      ['heal', () => { this.cheatHealMult = 3; window.alert('Activated heal'); }],
      ['armor', () => { this.cheatArmorMult = 0.5; window.alert('Activated armor'); }],
      ['reset', () => {
        this.cheatTurboRange = false;
        this.cheatFullAutoStart = false;
        this.cheatAutoStart = false;
        this.cheatHealMult = 1;
        this.cheatArmorMult = 1.0;
        window.alert('Reset cheats');
      }],
    ]) {
      if (this.cheatCode.slice(-cheatCode.length) === cheatCode) {
        f();
        this.cheatCode = '';
      }
    }
  }

  startWave = () => {
    if (this.gameState !== 'build')
      return;
    this.gold += 100;
    if (this.wave > 5)
      this.gold += 25;
    if (this.wave > 10)
      this.gold += 25;
    this.gameState = 'wave';
    this.waveTimerMax = 20 + 2.0 * Math.sqrt(this.wave);
    this.waveTimer = 0;
    this.enemySchedule = [];
    let enemyDensity = 1.0 + Math.pow(this.wave / 2.0, 0.65);
    //const enemyCount = this.waveTimerMax * enemyDensity;

    const fastWave = this.wave > 10 && (this.wave % 5 === 3);
    let shootyWave = this.wave > 15 && (this.wave % 7 === 1 || this.wave % 7 === 2 || this.wave % 7 === 5);
    if (this.wave >= 50) {
      shootyWave = true;
    }
    for (let i = 56; i <= 60; i++) {
      if (this.wave >= i) {
        //enemyDensity *= 1;
        this.waveTimerMax *= 1.2;
      }
    }
    const hordeWave = this.wave > 30 && (this.wave % 11 === 0);
    if (hordeWave) {
      enemyDensity *= 2.7;
    }

    let t = 0;
    let enemySizeBias = 0;
    let counter = 0;
    let enemyIndex = 0;
    let pinkLimit = 1 + Math.max(0, Math.floor((this.wave - 25) / 2));
    if (this.wave > 35) pinkLimit *= 2;
    if (this.wave > 45) pinkLimit *= 2;
    if (this.wave > 55) pinkLimit = 1000000;
    let whiteLimit = 1 + Math.max(0, Math.floor((this.wave - 35) / 2));
    if (this.wave > 45) whiteLimit *= 2;
    if (this.wave > 55) whiteLimit *= 2;
    if (this.wave > 65) whiteLimit = 1000000;
    while (t < this.waveTimerMax) {
      let enemyCost = 1.0;
      let speed = 2.0;
      let biasAdder = Math.max(1.5, Math.pow(this.wave, 1.3) / 3.0);
      if (fastWave) {
        biasAdder /= 1.3;
        speed *= 1.75;
      }
      if (hordeWave) {
        biasAdder /= 1.3;
      }
      const enemyTypes: [string, number, number, number, number, number][] = [
        // color,  sub,   hp,  gold, speed, size
        ['red',      1,    1,     1, 1.0,  14],
        ['blue',     2,    2,   2.0, 1.0,  16],
        ['green',    4,    5,   2.5, 1.0,  18],
        ['yellow',  12,   20,     5, 1.0,  20],
        ['#333',    50,  100,    11, 0.75, 22],
        ['purple', 100,  850,    15, 0.5,  24],
        ['white',  400, 5000,    22, 0.3,  26],
      ];
      let index = Math.floor(Math.pow(Math.max(enemySizeBias, 0) / 5.0, 0.5));
      if (enemyIndex % 6 === 0 || enemyIndex % 6 === 1) {
        let currentBaseIndex = 0;
        if (this.wave > 10)
          currentBaseIndex++;
        if (this.wave > 30)
          currentBaseIndex++;
        index = currentBaseIndex;
      }
      if (!fastWave && this.wave > 15 && this.wave % 3 === 0 && enemyIndex % 13 === 0) {
        index++;
      }
      if (this.wave > 30 && !shootyWave && this.wave % 2 === 0 && enemyIndex % 23 === 0) {
        index = 5;
      }
      if (this.wave > 30 && shootyWave && this.wave % 2 === 0 && enemyIndex % 41 === 0) {
        index = 5;
      }
      if (index >= 5) {
        if (pinkLimit > 0)
          pinkLimit--;
        else
          index = 4;
      }
      if (index >= 6) {
        if (whiteLimit > 0)
          whiteLimit--;
        else
          index = 5;
      }
      const [color, subtract, hp, gold, speedMult, size] = enemyTypes[Math.min(index, enemyTypes.length - 1)];
      enemySizeBias -= subtract;
      const enemy = new Enemy(speed * speedMult, hp, gold, color, size);
      if (shootyWave || (this.wave > 10 && this.wave % 2 === 1 && enemyIndex % 2 === 0)) {
        biasAdder *= 0.8;
        enemy.maxShootCooldown = 3.0;
        enemy.shootDamage = 1;
        if (enemy.color === 'yellow') {
          enemy.shootCooldown = 2.2;
          enemy.shootDamage += 1;
        }
        if (enemy.color === '#333') {
          enemy.shootCooldown = 1.5;
          enemy.maxShootCooldown = 2.9;
          enemy.shootDamage += 2;
        }
        if (enemy.color === 'purple') {
          enemy.shootCooldown = 0.5;
          enemy.maxShootCooldown = 2.8;
          enemy.shootDamage += 4;
        }
        if (enemy.color === 'white') {
          enemy.shootCooldown = 0.2;
          enemy.maxShootCooldown = 2.65;
          enemy.shootDamage += 6;
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
    //if (this.gameState === 'dead')
    //  return;
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

  checkMutualExclusion = (turret: Turret, upgrade: Upgrade): boolean => {
    // Check mutual exclusion.
    if (upgrade.mutExclusive !== undefined)
      for (const otherUpgrade of upgrade.mutExclusive)
        if (turret.upgrades.includes(otherUpgrade))
          return true;
    return false;
  }

  clickUpgradeButton = (upgrade: Upgrade) => {
    if (
      this.selectedCell !== null &&
      this.selectedCell.turret !== null &&
      !this.selectedCell.turret.upgrades.includes(upgrade.name) &&
      this.gold >= upgrade.cost &&
      this.selectedCell.turret.upgrades.length < TURRET_DATA[this.selectedCell.turret.type].maxUpgrades
    ) {
      if (this.checkMutualExclusion(this.selectedCell.turret, upgrade))
        return;
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
    if (turret.upgrades.includes('Sniper'))
      range += 3;
    if (turret.upgrades.includes('Super Sniper'))
      range += 4;
    if (turret.upgrades.includes('Range'))
      range += 1.5;
    if (turret.upgrades.includes('Lens'))
      range += 2;
    if (turret.upgrades.includes('Repair Range'))
      range += 2;
    if (turret.upgrades.includes('Blizzard'))
      range += 1;
    if (turret.upgrades.includes('Flame Range'))
      range += 2;
    if (turret.upgrades.includes('Distant Bombardment'))
      range += 2;
    if (this.cheatTurboRange) {
      range *= 1.5;
      if (turret.type === 'repair') {
        range = Math.ceil(range);
      }
    }
    return range;
  }

  computeTurretMinRange = (turret: Turret): number => {
    const data = TURRET_DATA[turret.type];
    let minRange = data.minRange;
    //if (turret.upgrades.includes('Distant Bombardment'))
    //  minRange += 1;
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
      if (turret.upgrades.includes('Distant Bombardment'))
        speed *= 3.0;
      const b = new Bullet(pos, furthestTarget.pos, furthestTarget, speed, turret.type);
      b.size = 10.0;
      b.color = '#555';
      b.bombDesc = {
        radius: 1.5 * CELL_SIZE,
        damage: data.damage,
        maximumEnemies: 10,
        trail: turret.upgrades.includes('Distant Bombardment'),
      };
      if (turret.upgrades.includes('Large Area'))
        b.bombDesc.radius *= 1.5;
      if (turret.upgrades.includes('Cluster Bomb'))
        b.bombDesc.maximumEnemies *= 3;
      if (turret.upgrades.includes('High Explosives'))
        b.bombDesc.damage *= 2;
      if (turret.upgrades.includes('Very High Explosives'))
        b.bombDesc.damage *= 2;
      return [b];
    }

    let speed = 900.0;
    if (turret.upgrades.includes('Sniper'))
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
    if (turret.upgrades.includes('Four-way Shot')) {
      for (const old of [...bullets]) {
        let b = new Bullet(old.pos, old.targetPos, old.targetEnemy, old.speed, turret.type);
        b.targetDelta = rotate(old.targetDelta, Math.PI / 2);
        bullets.push(b);
        b = new Bullet(old.pos, old.targetPos, old.targetEnemy, old.speed, turret.type);
        b.targetDelta = rotate(old.targetDelta, Math.PI);
        bullets.push(b);
        b = new Bullet(old.pos, old.targetPos, old.targetEnemy, old.speed, turret.type);
        b.targetDelta = rotate(old.targetDelta, 3 * Math.PI / 2);
        bullets.push(b);
      }
    }
    for (const bullet of bullets) {
      bullet.size *= 1.6;
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

    if (this.cheatFullAutoStart)
      this.startWave();
    if (this.cheatAutoStart && this.gameState === 'build' && this.totalGameDt > this.waveEndT + this.wave / 2.0)
      this.startWave();

    let reps = this.fastMode ? 10 : 1;
    this.totalGameDt += reps * dt;
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
          this.waveEndT = this.totalGameDt;
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
            let heal_rate = this.enemies.length > 0 ? 0.15 : 0.0;
            heal_rate *= this.cheatHealMult;
            turret.hp = Math.min(turret.maxHp, turret.hp + heal_rate * dt);
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
              const has_capacity_upgrades = turret.upgrades.includes('Repair Capacity') || turret.upgrades.includes('Super Repair Capacity');
              if (
                turret.zapCharge >= 1
                && leastHpTurret !== null
                && (Math.random() < 0.2 || !has_capacity_upgrades)
              ) {
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
              let repairRate = 0.45;
              if (turret.upgrades.includes('Repair Speed'))
                repairRate *= 2.0;
              if (turret.upgrades.includes('Super Repair Speed'))
                repairRate *= 2.0;
              let maxRepairCharges = 5;
              if (turret.upgrades.includes('Repair Capacity'))
                maxRepairCharges *= 5;
              if (turret.upgrades.includes('Super Repair Capacity'))
                maxRepairCharges *= 10;
              if (this.enemies.length > 0)
                turret.zapCharge = Math.min(maxRepairCharges, turret.zapCharge + repairRate * dt);
              continue;
            }

            turret.cooldown = Math.max(0, turret.cooldown - dt);
            const range = this.computeTurretRange(turret) * CELL_SIZE;
            const minRange = this.computeTurretMinRange(turret) * CELL_SIZE;

            let maxZapCharge = 4;
            if (turret.type === 'zapper') {
              if (turret.upgrades.includes('Capacitors'))
                maxZapCharge += 4;
              if (turret.upgrades.includes('Batteries'))
                maxZapCharge += 8;
              let rate = 1 / 1.4;
              if (turret.upgrades.includes('Superconductors'))
                rate *= 2.0;
              // We only recharge when there are enemies on screen.
              if (this.enemies.length > 0)
                turret.zapCharge = Math.min(maxZapCharge, turret.zapCharge + rate * dt);
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
                    enemy.cold = Math.min(60.0, enemy.cold + coldAmount);
                    enemy.burning *= 0.65;
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
              const doAttackFrom = (self: App, pos: Point, chainCount: number, scratch: number, isFirst: boolean) => {
                let furthestT = -1.0;
                let furthestTarget = null;
                const haveTargetingComputer = turret.upgrades.includes('Targeting Computer');
                for (const enemy of self.enemies) {
                  if (haveTargetingComputer && enemy.hp < 15 && isFirst)
                    continue;
                  if (enemy.scratch === scratch)
                    continue;
                  // Skip off-screen enemies.
                  if (enemy.pos[0] < 0 || enemy.pos[0] >= FIELD_WIDTH ||
                      enemy.pos[1] < 0 || enemy.pos[1] >= FIELD_HEIGHT)
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
                      self.effects.push(new GroundEffect(lerpPos, 6 * Math.sqrt(zapAmount), -20 * Math.pow(zapAmount, 0.3), '#ff0'));
                    }
                    furthestTarget.hp = accountDamage(furthestTarget.hp, 'zapper', zapAmount * zapAmount);
                    if (chainCount > 0) {
                      furthestTarget.scratch = scratch;
                      doAttackFrom(self, furthestTarget.pos, chainCount - 1, scratch, false);
                    }
                  } else if (turret.type === 'laser') {
                    // Swivel towards the target.
                    const angleToTarget = Math.atan2(furthestTarget.pos[1] - pos[1], furthestTarget.pos[0] - pos[0]);
                    let laserDamageRate = 5.0;
                    if (turret.upgrades.includes('Better Optics'))
                      laserDamageRate *= 2.0;
                    if (turret.upgrades.includes('Best Optics'))
                      laserDamageRate *= 2.0;
                    if (turret.upgrades.includes('Bestest Optics'))
                      laserDamageRate *= 2.0;
                    let swivelRate = 0.2;
                    if (turret.upgrades.includes('Lubricant'))
                      swivelRate *= 3.0;
                    if (turret.upgrades.includes('Clockwise Sweeper')) {
                      laserDamageRate *= 5.0;
                      turret.heading += swivelRate * dt;
                      turret.heading %= Math.PI * 2;
                    } else if (turret.upgrades.includes('Counter-clockwise Sweeper')) {
                      laserDamageRate *= 5.0;
                      turret.heading -= swivelRate * dt;
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
                    const fireballCount = 60.0; //Math.round(range / 2.0);
                    let fireOutput = 0.8;
                    if (turret.upgrades.includes('Napalm'))
                      fireOutput *= 2.0;
                    if (turret.upgrades.includes('Napalmier Napalm'))
                      fireOutput *= 2.0;
                    if (turret.upgrades.includes('Napalmiest Napalm'))
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
                maxChainCount += 2;
              const unique = Math.floor(1000000 * Math.random());
              if (
                turret.type === 'zapper' &&
                turret.zapCharge < maxZapCharge &&
                turret.upgrades.includes('Marx Generator')
              ) {
                continue;
              }
              doAttackFrom(this, pos, maxChainCount, unique, true);
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
      // Draw a health bar.
      if (enemy.hp < enemy.maxHp) {
        movingThings.push(<div
          key={`${enemy.id}-hp`}
          style={{
            position: 'absolute',
            left: enemy.pos[0] - enemy.size,
            top: enemy.pos[1] + enemy.size + 2,
            width: 2*enemy.size,
            height: 2,
            border: '1px solid black',
            background: '#800',
            borderRadius: 1,
            pointerEvents: 'none',
            zIndex: 6,
          }}
        />);
        movingThings.push(<div
          key={`${enemy.id}-hp2`}
          style={{
            position: 'absolute',
            left: enemy.pos[0] - enemy.size,
            top: enemy.pos[1] + enemy.size + 2,
            width: 2*enemy.size * enemy.hp / enemy.maxHp,
            height: 2,
            border: '1px solid black',
            background: '#f00',
            borderRadius: 1,
            pointerEvents: 'none',
            zIndex: 7,
          }}
        />);
      }
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

    if (this.wave === WIN_LEVEL && this.enemies.length === 0) {
      this.gameState = 'win';
    }

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

        <div style={{ width: 350 }}>
          {this.wave === WIN_LEVEL ? <>
            <div>Wave: {colorText('cyan', 60)}/{colorText('cyan', 60)}</div>
            <div>
              {this.enemies.length > 0 ? 'Last wave...' : 'You Win!'}
            </div>
          </> : <>
            <div>Wave: {colorText('cyan', this.wave)}/{colorText('cyan', 60)}</div>
            <div>Prog:
              <span style={{ whiteSpace: 'pre' }}>{progressText}</span>
            </div>
          </>}
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
          background: this.gameState === 'dead' ? '#363' : (this.gameState === 'win' ? '#595' : '#484'),
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

          {shownTurretTypeData !== null && <div style={{ fontSize: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 5 }}>{shownTurretTypeData.name}
              &nbsp;<span style={{ fontWeight: 'normal', fontSize: 16 }}>(max {shownTurretTypeData.maxUpgrades} upgrades)</span></div>
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
                  if (this.checkMutualExclusion(this.selectedCell.turret, upgrade)) {
                    clickable = false;
                  }
                  if (this.selectedCell.turret.upgrades.length >= TURRET_DATA[this.selectedCell.turret.type].maxUpgrades) {
                    maxedOut = <span style={{ fontSize: 14, opacity: 0.5 }}>Maxed out</span>;
                  }
                }

                return <div
                  style={{
                    border: '1px solid #111',
                    padding: 7,
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
