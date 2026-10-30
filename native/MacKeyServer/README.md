# MacKeyServer source

Vendored from LaunchMenu/node-global-key-listener, commit
`da6e55586a0559d0bb26ad6e08e15fac00fa785c`:
https://github.com/LaunchMenu/node-global-key-listener/blob/da6e55586a0559d0bb26ad6e08e15fac00fa785c/src/bin/MacKeyServer/main.swift

MIT license: see LICENSE. This revision preserves the `key,state,id` protocol
used by node-global-key-listener 0.1.1. Newer upstream revisions use a different
protocol and cannot be substituted directly.

Local change: explicitly import CoreGraphics for current Swift toolchains.

The npm package ships an Intel-only helper. `scripts/build-key-server.cjs`
compiles this source for the development host before `npm start`, and for the
target architecture after packaging, before app signing. No source download
is needed during builds.
