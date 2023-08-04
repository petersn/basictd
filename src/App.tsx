import React from 'react';
import ReactDOM from 'react-dom';
import { ILayoutResult, Rescaler } from './Rescaler';
import { Point, interpolate, dist } from './Interpolate';

const WIDTH = 1600;
const HEIGHT = 1000;
const CELL_SIZE = 50;
const CELL_COUNT_X = 32;
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
  [250,-10],[250,250],[1320,150],[1371,484],[593,794],[638,634],[1053,367],[146,543],[1269,755],[1460,931],
];

type GameState = 'wave' | 'build' | 'dead';

interface CellContents {
  blocked: boolean;
}

class Enemy {
  id: string;
  t: number = 0;
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
    if (this.t >= 1) {
      app.hp -= this.hp;
      this.hp = 0;
      // Enemies that cross the finish don't give gold.
      this.gold = 0;
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
        row.push({ blocked: false });
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
      while (dist(candidatePoint, this.linearPoints[this.linearPoints.length - 1]) < 20 && t < 1) {
        t += 0.0001;
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
  level: Level;
  gold: number = 0;
  wave: number = 1;
  hp: number = 100;
  waveTimer: number = 0;
  waveTimerMax: number = 1;
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
    this.waveTimerMax = 10 + this.wave;
    this.waveTimer = 0;
    this.enemySchedule = [];
    for (let i = 0; i < this.waveTimerMax; i++) {
      this.enemySchedule.push([ i, new Enemy(10, 100, 1, 'red', 8) ]);
    }
  }

  rafLoop = (time: number) => {
    const dt = Math.min((time - this.lastRafTime) / 1000, 0.1);
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
            zIndex: 1,
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
          cells.push(<div
            key={`${x},${y}`}
            style={{
              position: 'absolute',
              //boxSizing: 'border-box',
              border: '1px solid #333',
              left: x * CELL_SIZE,
              top: y * CELL_SIZE,
              width: CELL_SIZE - 1,
              height: CELL_SIZE - 1,
            }}
          />);
        }
      }
    }

    const enemies = [];
    for (const enemy of this.enemies) {
      const pos = interpolate(this.level.linearPoints, enemy.t);
      enemies.push(<div
        key={enemy.id}
        style={{
          position: 'absolute',
          left: pos[0] - 10,
          top: pos[1] - 10,
          width: 20,
          height: 20,
          background: '#f00',
          borderRadius: 10,
          zIndex: 5,
        }}
      />);
    }

    function colorText(color: string, text: string | number) {
      return <span style={{ color, textShadow: '0 0 2px #000' }}>{text}</span>;
    }
    let progressText = ((100.0 * this.waveTimer / this.waveTimerMax).toFixed(1) + '%').padStart(7);

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
          width: 400,
        }}>
          <div>Gold:&nbsp; {colorText('yellow', this.gold)}</div>
          <div>Lives: {colorText('red', this.hp)}</div>
        </div>

        <div style={{ flex: 1 }} />

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

      {/* Main field */}
      <div style={{
        width: this.props.layout.width,
        height: this.props.layout.height - 100,
        background: this.gameState === 'dead' ? '#363' : '#484',
        top: 100,
        position: 'relative',
      }}>
        {knots}
        {cells}
        {enemies}
        <svg
          width={this.props.layout.width}
          height={this.props.layout.height}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
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
