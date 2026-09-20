/*
// string.prototype.ts

import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

declare global {
    interface String {
        import<T = any>(): Promise<T>
        req<T = any>(): Promise<T>
    }
}

String.prototype.import = function <T = any>(): Promise<T> {
    return import(this.toString()) as Promise<T>
}

String.prototype.req = function <T = any>(): Promise<T> {
    return Promise.resolve(
        require(this.toString()) as T
    )
}

export {}*/

// string.prototype.ts
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

declare global {
    interface String {
        /**
         * Import module / package
         *
         * "axios".import()
         * "@whiskeysockets/baileys".import()
         * "node:events".import()
         */
        import<T = any>(): Promise<T>

        /**
         * Import file
         *
         * "./config.js".req()
         * "./connection.js".req()
         * `./plugins/${name}.js`.req()
         */
        req<T = any>(): Promise<T>
    }
}

/**
 * Import module / package
 *
 * Contoh:
 *
 * const axios = await "axios".import()
 * const { EventEmitter } = await "node:events".import()
 */
String.prototype.import = function <T = any>(): Promise<T> {
    return import(this.toString()) as Promise<T>
}

/**
 * Import file
 *
 * Contoh:
 *
 * const config = await "./config.js".req()
 * const plugin = await `./plugins/${name}.js`.req()
 */

String.prototype.req = function <T = any>(bust = false): Promise<T> {
  const url = pathToFileURL(resolve(process.cwd(), this.toString())).href;
  return import(bust ? `${url}?t=${Date.now()}` : url) as Promise<T>;
};

export {}
