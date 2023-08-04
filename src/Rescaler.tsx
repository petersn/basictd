import React from 'react';
import { Point } from './Interpolate';

export interface ILayout {
  width: number;
  height: number;
  name: string;
}

export type ILayoutResult = ILayout & { scale: number };

export const RescalerContext = React.createContext<Rescaler | null>(null);

export interface IRescalerProps {
  layouts: ILayout[];
  children: (layout: ILayoutResult, rescaler: Rescaler) => React.ReactNode;
}

export class Rescaler extends React.Component<IRescalerProps, {
  targetScale: number;
  centeringOffset: number;
  layout: ILayout;
}> {
  lastCoords = [0, 0];
  containerRef = React.createRef<HTMLDivElement>();
  contentRef = React.createRef<HTMLDivElement>();

  constructor(props: IRescalerProps) {
    super(props);
    this.state = {
      targetScale: 1,
      centeringOffset: 0,
      layout: this.props.layouts[0],
    };
  }

  recompute = () => {
    if (this.containerRef.current !== null && this.contentRef.current !== null) {
      const containerRect = this.containerRef.current.getBoundingClientRect();
      // Find the best layout.
      let bestTargetScale = -1;
      for (const layout of this.props.layouts) {
        const targetScale = Math.min(
          containerRect.width / layout.width,
          containerRect.height / layout.height,
        );
        if (targetScale > bestTargetScale) {
          bestTargetScale = targetScale;
          const centeringOffset = (containerRect.width - layout.width * targetScale) / 2;
          this.setState({ targetScale, centeringOffset, layout });
        }
      }
    }
  }

  remapClientCoords = (clientX: number, clientY: number): Point => {
    if (this.contentRef.current !== null) {
      const contentRect = this.contentRef.current.getBoundingClientRect();
      const x = (clientX - contentRect.left) / this.state.targetScale;
      const y = (clientY - contentRect.top) / this.state.targetScale;
      return [x, y];
    }
    return [0, 0];
  }

  componentDidMount() {
    this.recompute();
    window.addEventListener('resize', this.recompute);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.recompute);
  }

  render() {
    return (
      <RescalerContext.Provider value={this}>
        <div
          ref={this.containerRef}
          style={{
            width: '100%',
            height: '100vh',
          }}
        >
          <div
            ref={this.contentRef}
            style={{
              display: 'inline-block',
              transform: `
                translate(${this.state.centeringOffset}px, 0px)
                translate(-50%, -50%)
                scale(${this.state.targetScale})
                translate(50%, 50%)
              `,
            }}
          >
            <div style={{
              width: this.state.layout.width,
              minWidth: this.state.layout.width,
              maxWidth: this.state.layout.width,
              height: this.state.layout.height,
              minHeight: this.state.layout.height,
              maxHeight: this.state.layout.height,
              position: 'relative',
            }}>
              {this.props.children({...this.state.layout, scale: this.state.targetScale}, this)}
            </div>
          </div>
        </div>
      </RescalerContext.Provider>
    );
  }
}
