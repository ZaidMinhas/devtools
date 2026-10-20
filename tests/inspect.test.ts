import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
import { getInspectFields, inspect } from '../packages/api/src/inspect';
import { getInspectedProperties, setInspectedProperty } from '../packages/backend/src/scene/tree/inspectedFields';
import { Properties } from '../packages/backend/src/scene/tree/properties';

const custom = (name: string) => `__inspect__:${name}`;

test('initialized primitive fields are opt-in and use the existing inspector controls', () => {
  class Player {
    @inspect({ min: 0, max: 100, step: 1, label: 'Health', section: 'Gameplay', tooltip: 'Hit points' })
    health = 50;

    @inspect()
    title = 'Player';

    @inspect()
    invincible = false;

    hidden = 42;
  }
  const player = new Player();
  const props = getInspectedProperties(player);
  assert.deepEqual(
    props.map(({ prop, entry }) => [prop, entry.type]),
    [
      [custom('health'), 'number'],
      [custom('title'), 'text'],
      [custom('invincible'), 'boolean'],
    ],
  );
  assert.deepEqual(props[0].entry, {
    section: 'Gameplay',
    label: 'Health',
    tooltip: 'Hit points',
    type: 'number',
    options: { min: 0, max: 100, step: 1 },
  });
  assert.equal(props[1].entry.section, 'Custom Fields');
  setInspectedProperty(player, custom('health'), 75);
  setInspectedProperty(player, custom('title'), 'Goblin\'s "friend"\nSecond line');
  setInspectedProperty(player, custom('invincible'), true);
  assert.equal(player.health, 75);
  assert.equal(player.title, 'Goblin\'s "friend"\nSecond line');
  assert.equal(player.invincible, true);
});

test('numeric, negative, string and heterogeneous enums round-trip their original values', () => {
  enum Direction {
    Left = -1,
    Still = 0,
    Right = 1,
  }
  enum Mode {
    Idle = 'idle',
    Chase = 'chase',
  }
  enum Mixed {
    Off = 0,
    On = 'on',
  }
  class Player {
    @inspect({ enum: Direction }) direction = Direction.Still;
    @inspect({ enum: Mode }) mode = Mode.Idle;
    @inspect({ enum: Mixed }) mixed = Mixed.Off;
  }
  const player = new Player();
  const props = getInspectedProperties(player);
  assert.deepEqual(props[0].entry.options, { options: ['Left', 'Still', 'Right'] });
  assert.equal(props[0].value, 'Still');
  assert.deepEqual(props[1].entry.options, { options: ['Idle', 'Chase'] });
  assert.deepEqual(props[2].entry.options, { options: ['Off', 'On'] });
  setInspectedProperty(player, custom('direction'), 'Left');
  setInspectedProperty(player, custom('mode'), 'Chase');
  setInspectedProperty(player, custom('mixed'), 'On');
  assert.equal(player.direction, -1);
  assert.equal(typeof player.direction, 'number');
  assert.equal(player.mode, 'chase');
  assert.equal(player.mixed, 'on');
  setInspectedProperty(player, custom('direction'), 'Unknown');
  assert.equal(player.direction, -1);
});

test('inherited fields and overrides do not leak metadata between instances or sibling classes', () => {
  class Base {
    @inspect({ label: 'Base speed' }) speed = 1;
  }
  class Enemy extends Base {
    @inspect({ label: 'Enemy speed' }) override speed = 2;
    @inspect() health = 100;
  }
  class Friend extends Base {
    @inspect() nickname = 'Friend';
  }
  assert.deepEqual([...getInspectFields(new Base()).keys()], ['speed']);
  assert.deepEqual([...getInspectFields(new Enemy()).keys()], ['speed', 'health']);
  assert.deepEqual([...getInspectFields(new Friend()).keys()], ['speed', 'nickname']);
  assert.equal(getInspectFields(new Enemy()).get('speed')?.label, 'Enemy speed');
  assert.equal(getInspectFields(new Base()).get('speed')?.label, 'Base speed');
  const first = new Enemy();
  const second = new Enemy();
  setInspectedProperty(first, custom('health'), 25);
  assert.equal(second.health, 100);
});

test('legacy decorators use the same metadata protocol and support unusual field names', () => {
  class Legacy {
    ["player's name"] = 'Old';
    speed = 1;
  }
  inspect({ label: 'Name' })(Legacy.prototype, "player's name");
  inspect()(Legacy.prototype, 'speed');
  class Child extends Legacy {
    override speed = 2;
  }
  inspect({ label: 'Child speed' })(Child.prototype, 'speed');
  const child = new Child();
  setInspectedProperty(child, custom("player's name"), 'New');
  assert.equal(child["player's name"], 'New');
  assert.equal(getInspectFields(child).get('speed')?.label, 'Child speed');
  assert.equal(getInspectFields(new Legacy()).get('speed')?.label, undefined);
});

test('writes reject non-finite numbers, out-of-range numbers, wrong types and unregistered fields', () => {
  class Player {
    @inspect({ min: 0, max: 10 }) speed = 5;
    untouched = 7;
  }
  const player = new Player();
  for (const value of [NaN, Infinity, -Infinity, -1, 11, '8', true, null, {}]) {
    assert.equal(setInspectedProperty(player, custom('speed'), value), true);
    assert.equal(player.speed, 5);
  }
  assert.equal(setInspectedProperty(player, custom('untouched'), 1), true);
  assert.equal(player.untouched, 7);
  assert.equal(setInspectedProperty(player, custom('__proto__'), {}), true);
  assert.equal(setInspectedProperty(player, 'x', 10), false);
  setInspectedProperty(player, custom('speed'), 0);
  assert.equal(player.speed, 0);
  setInspectedProperty(player, custom('speed'), 10);
  assert.equal(player.speed, 10);
});

test('unsupported runtime values are omitted without serializing objects', () => {
  const target = { object: {}, empty: null, missing: undefined, invalid: NaN, valid: 0 };
  for (const name of Object.keys(target)) inspect()(target, name);
  assert.deepEqual(
    getInspectedProperties(target).map(({ prop }) => prop),
    [custom('valid')],
  );
});

test('selected-node integration isolates custom writes and respects locked nodes', () => {
  class Player {
    @inspect() width = 5;
    __devtoolLocked = false;
  }
  const player = new Player();
  const tree = { selectedNode: player as Player | null };
  let extensionWrites = 0;
  const plugin = {
    extension: { type: 'sceneProperties' as const, name: 'inspect-test' },
    testNode: () => true,
    testProp: () => true,
    setProperty: () => {
      extensionWrites++;
    },
    getProperties: () => [],
  };
  Properties.extensions.push(plugin);
  try {
    const properties = new Properties({ scene: { tree } } as any);
    properties.init();
    assert.equal(properties.getActiveProps()?.[0].prop, custom('width'));
    properties.setValue(custom('width'), 8);
    assert.equal(player.width, 8);
    assert.equal(extensionWrites, 0);
    properties.setValue('width', 10);
    assert.equal(extensionWrites, 1);
    player.__devtoolLocked = true;
    assert.equal(properties.getActiveProps(), undefined);
    properties.setValue(custom('width'), 1);
    assert.equal(player.width, 8);
    tree.selectedNode = null;
    assert.equal(properties.getActiveProps(), undefined);
    properties.setValue(custom('width'), 2);
    assert.equal(player.width, 8);
  } finally {
    Properties.extensions.splice(Properties.extensions.indexOf(plugin), 1);
  }
});

test('standard decorators emitted by TypeScript register fields and subclass overrides per instance', () => {
  const source = `
    class Base {
      @inspect({ label: 'Base speed' }) speed = 1;
    }
    class Enemy extends Base {
      @inspect({ label: 'Enemy speed' }) speed = 2;
      @inspect() health = 100;
    }
    exports.Base = Base;
    exports.Enemy = Enemy;
  `;
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, experimentalDecorators: false },
  });
  const classes = {} as { Base: new () => object; Enemy: new () => { speed: number; health: number } };
  new Function('inspect', 'exports', outputText)(inspect, classes);
  const enemy = new classes.Enemy();
  assert.equal(getInspectFields(enemy).get('speed')?.label, 'Enemy speed');
  assert.deepEqual([...getInspectFields(enemy).keys()], ['speed', 'health']);
  assert.equal(getInspectFields(new classes.Base()).get('speed')?.label, 'Base speed');
  setInspectedProperty(enemy, custom('health'), 10);
  assert.equal(enemy.health, 10);
  assert.equal(new classes.Enemy().health, 100);
});
