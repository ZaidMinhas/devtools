import App from '@devtool/frontend/App';
import type { BridgeFn } from '@devtool/frontend/lib/utils';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PixiDevtools } from '@devtool/backend/pixi';
import scene from './scene.ts';
import * as PIXI from 'pixi.js';

(async () => {
  // wait for the app to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  const app = await scene(canvas);

  window.__PIXI_DEVTOOLS__ = {
    pixi: PIXI,
    app,
  };

  const renderer = PixiDevtools.renderer;

  if (renderer) {
    renderer.render = new Proxy(renderer.render, {
      apply(target, thisArg, ...args) {
        PixiDevtools.update();
        messageListeners.forEach((listener) =>
          listener({
            method: 'pixi-state-update',
            data: JSON.stringify({ ...PixiDevtools.state, stats: PixiDevtools.scene.getStats() }),
          }),
        );
        // @ts-expect-error - TODO: fix this type
        return target.apply(thisArg, ...args);
      },
    });
  }
})();

const messageListeners: ((message: unknown) => void)[] = [];
const mockChrome = {
  runtime: {
    connect: () => ({
      postMessage: () => {},
      onMessage: {
        addListener: (listner: (message: unknown) => void) => {
          messageListeners.push(listner);
        },
      },
    }),
  },
  devtools: {
    inspectedWindow: {
      tabId: 0,
      eval: (code: string, cb: () => void) => {
        eval(code);
        cb();
      },
    },
  },
} as unknown as typeof chrome;

const mockBridge: BridgeFn = async (code) => {
  // Return a snapshot, matching the extension's inspectedWindow.eval bridge.
  const result = eval(code);
  return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center' }}>
      <canvas id="canvas" style={{ width: 'min(600px, 53.333vh, 100vw)', height: 'auto', flexShrink: 0 }} />
      <div className="[&_.app]:h-full" style={{ width: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <App bridge={mockBridge} chromeProxy={mockChrome} />
      </div>
    </div>
  </React.StrictMode>,
);
