import { inspect } from '@pixi/devtools';
import { Container } from 'pixi.js';

export enum RotationDirection {
  Clockwise = 1,
  CounterClockwise = -1,
}

export enum AnimationMode {
  Spin = 'spin',
  Pulse = 'pulse',
}

/** Select this container in the scene tree to edit its Custom Fields. */
export class InspectorDemo extends Container {
  @inspect({ tooltip: 'The scene tree label. Try typing a new name.' })
  displayName = 'Inspector Demo';

  @inspect({ min: 0, max: 5, step: 0.1, tooltip: 'Controls the animation speed.' })
  speed = 1;

  @inspect({ step: 1, tooltip: 'An example number with whole-number increments.' })
  K = 10;

  @inspect({ label: 'Animate', tooltip: 'Pause or resume the animation.' })
  isAnimating = true;

  @inspect({ enum: RotationDirection, label: 'Direction' })
  direction = RotationDirection.Clockwise;

  @inspect({ enum: AnimationMode, label: 'Animation' })
  animation = AnimationMode.Spin;

  private elapsed = 0;

  constructor() {
    super();
    this.label = this.displayName;
  }

  public animate(deltaTime: number) {
    this.label = this.displayName;
    if (!this.isAnimating) return;

    this.elapsed += deltaTime * this.speed * 0.03;
    if (this.animation === AnimationMode.Spin) {
      this.scale.set(1);
      this.rotation += 0.01 * deltaTime * this.speed * this.direction;
    } else {
      this.scale.set(1 + Math.sin(this.elapsed) * 0.2);
    }
  }
}
