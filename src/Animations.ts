/**
 * Sistema de Animações
 * Animações suaves para elementos da UI
 */

export interface AnimationConfig {
  duration: number;
  easing?: (t: number) => number;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

export class AnimationManager {
  private animations: Map<string, ActiveAnimation> = new Map();
  private lastTime: number = 0;

  constructor() {
    this.update = this.update.bind(this);
    this.startLoop();
  }

  private startLoop(): void {
    requestAnimationFrame(this.update);
  }

  private update(time: number): void {
    const deltaTime = time - this.lastTime;
    this.lastTime = time;

    // Update all animations
    for (const [id, animation] of this.animations) {
      animation.elapsed += deltaTime;
      const progress = Math.min(animation.elapsed / animation.config.duration, 1);
      const easedProgress = animation.config.easing ? animation.config.easing(progress) : progress;

      if (animation.config.onUpdate) {
        animation.config.onUpdate(easedProgress);
      }

      if (progress >= 1) {
        if (animation.config.onComplete) {
          animation.config.onComplete();
        }
        this.animations.delete(id);
      }
    }

    requestAnimationFrame(this.update);
  }

  public start(id: string, config: AnimationConfig): void {
    this.animations.set(id, {
      config,
      elapsed: 0
    });
  }

  public stop(id: string): void {
    this.animations.delete(id);
  }

  public isRunning(id: string): boolean {
    return this.animations.has(id);
  }
}

interface ActiveAnimation {
  config: AnimationConfig;
  elapsed: number;
}

// Easing functions
export const Easing = {
  linear: (t: number): number => t,
  easeInOut: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOut: (t: number): number => 1 - Math.pow(1 - t, 2),
  bounce: (t: number): number => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  }
};

// Global animation manager instance
export const animationManager = new AnimationManager();