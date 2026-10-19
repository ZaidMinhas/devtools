---
title: Editable Game Fields
---

# Editable Game Fields

Use `@inspect()` to expose fields on a Pixi `Container` or `Sprite` subclass. Select the object in the Scene tree and edit its **Custom Fields** section. Changes update that instance immediately.

```ts
import { inspect } from '@pixi/devtools';
import { Container } from 'pixi.js';

enum MovementMode {
  Idle,
  Patrol,
  Chase,
}

class Enemy extends Container {
  @inspect({ min: 0, max: 20, step: 0.1 })
  speed = 5;

  @inspect({ step: 1, label: 'Hit points' })
  health = 100;

  @inspect()
  displayName = 'Goblin';

  @inspect()
  invincible = false;

  @inspect({ enum: MovementMode })
  movementMode = MovementMode.Patrol;
}
```

Add the instance to your scene as usual. Use this repository's updated extension (or local playground) and API together; older published extensions do not read this metadata. No custom property extension or additional registration is required. Your application still needs the normal [DevTools setup](./installation.mdx).

## Supported fields

| Field value            | Inspector control          |
| ---------------------- | -------------------------- |
| `number`               | Number input               |
| `string`               | Text input                 |
| `boolean`              | Checkbox-style switch      |
| Numeric or string enum | Dropdown with member names |

Enums keep their original values: selecting `Chase` writes the numeric enum value, not the string `"Chase"`. Numeric reverse mappings are excluded from the dropdown. Runtime `as const` objects also work; `const enum` declarations do not provide a runtime object to pass to the decorator.

The control type is inferred from the field's current value. Initialize fields with a supported primitive value. Objects, arrays, functions, `null`, `undefined`, `bigint`, symbols and non-finite numbers are omitted.

## Options

| Option       | Purpose                                                          |
| ------------ | ---------------------------------------------------------------- |
| `label`      | Display name; defaults to the field name                         |
| `section`    | Inspector group; defaults to `Custom Fields`                     |
| `tooltip`    | Help text shown on the label                                     |
| `enum`       | Runtime enum or object mapping names to string/number values     |
| `min`, `max` | Numeric bounds; out-of-range edits are rejected                  |
| `step`       | Number input increment; defaults to arbitrary decimal increments |

TypeScript uses `number` for integers and decimals. `step: 1` provides whole-number increments; it does not change the JavaScript type or round values written by game code.

Inherited decorated fields appear on subclasses. A subclass can decorate a field again to override its options without changing its base class or sibling classes. Undecorated fields remain hidden, and locking a node disables field editing along with its other properties.

## TypeScript decorators

The decorator supports standard TypeScript field decorators and projects using `experimentalDecorators: true`. It does not require `emitDecoratorMetadata` or `reflect-metadata`. Your bundler must support the decorator syntax used by your TypeScript configuration.

This repository enables legacy decorators for its Vite 5 toolchain. To use the same mode in your game, add this compiler option to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

If your bundler already supports standard decorators, you can keep that mode instead.

Use public instance fields on scene objects. Static fields, JavaScript `#private` fields and symbol-named fields are unsupported. TypeScript `private` fields using ordinary JavaScript property names can technically be decorated, but their values will then be exposed in DevTools. Standalone local variables and objects outside the scene tree are not shown.

Edits are runtime changes, not saved configuration: reloading recreates the values from your code. This feature does not write back to TypeScript source or persist changes like Unity scene serialization.

## Try the local demo

Run `npm run start:local`, expand **Container (Stage)** and select **Inspector Demo**. Its Custom Fields include a name, speed, `K`, an animation toggle, a numeric direction enum and a string animation enum. Changing speed, direction, animation or the toggle affects the bunnies immediately. The name updates the scene-tree label; `K` is a standalone editable number example.

Edit `packages/devtool-local/src/InspectorDemo.ts` to add more fields.
