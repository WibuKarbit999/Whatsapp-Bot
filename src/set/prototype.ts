// src/set/prototype.ts
import axios, { AxiosError } from 'axios';
import * as baileys from '@whiskeysockets/baileys';
import * as boom from '@hapi/boom';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import child_process from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import util from 'util';
import './src/set/String.prototype.js';

// ==========================================
// 1. DEKLARASI TIPE TYPESCRIPT (WAJIB)
// ==========================================
declare global {
    interface String {
        getMentions(): string[];
        createHash(): string;
        toJid(): string[];
        toBase64(): string;
        fromBase64(): string;
        formatSize(): string;
        getBearerToken(): string[];
        toFont(style?: string): string;
        slugify(): string;
    }

    interface Array<T> {
        getRandom(): T;
        shuffle(): T[];
        unique(): T[];
        last(): T;
        first(): T;
        count(item: T): number;
        isEmpty(): boolean;
        clean(): T[];
    }

    interface Object {
        extend(obj: any): this;
        deepCopy(): any;
    }

    // Deklarasi Global Module agar bisa diakses di file lain tanpa import
    var CustomApiError: any;
    var axios: typeof import('axios').default;
    var baileys: typeof import('@whiskeysockets/baileys');
    var boom: typeof import('@hapi/boom');
    var chalk: typeof import('chalk').default;
    var cheerio: typeof import('cheerio');
    var child: typeof import('child_process');
    var crypto: typeof import('crypto');
    var fs: typeof import('fs');
    var path: typeof import('path');
    var pino: typeof import('pino').default;
    var util: typeof import('util');
}

// ==========================================
// 2. MODIFIKASI STRING
// ==========================================

// Ekstrak tag mention (contoh: "Halo @62812" -> ["62812@s.whatsapp.net"])
String.prototype.getMentions = function () {
    const matches = this.match(/@(\d+)/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => `${m.replace('@', '')}@s.whatsapp.net`))];
};

// Ekstrak nomor WA dari teks sembarangan ke format JID Baileys
String.prototype.toJid = function () {
    const matches = this.match(/(\+?\d[\d\s-]{8,})/g) || [];
    return matches.map(match => {
        let text = match.replace(/[^0-9]/g, '');
        if (text.startsWith('0')) text = '62' + text.slice(1);
        return text.endsWith('@s.whatsapp.net') ? text : `${text}@s.whatsapp.net`;
    }).filter(Boolean);
};

// Generate random hash menggunakan Crypto
String.prototype.createHash = function () {
    return crypto.randomBytes(16).toString('hex');
};

// Encode dan Decode Base64 (Untuk API / Media)
String.prototype.toBase64 = function () {
    return Buffer.from(this.toString(), 'utf-8').toString('base64');
};
String.prototype.fromBase64 = function () {
    return Buffer.from(this.toString(), 'base64').toString('utf-8');
};

// Ubah angka bytes ke format ukuran (KB, MB, GB)
String.prototype.formatSize = function () {
    const bytes = parseInt(this.toString());
    if (isNaN(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Ambil token Bearer dari header/teks
String.prototype.getBearerToken = function () {
    const matches = this.match(/Bearer\s([a-zA-Z0-9\-_\.]+)/g) || [];
    return matches.map(m => m.split(' ')[1]);
};

// Ubah string biasa jadi slug untuk URL (Contoh: "Halo Dunia" -> "halo-dunia")
String.prototype.slugify = function () {
    return this.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};

// Ubah teks ke font karakter khusus WA
String.prototype.toFont = function (style = 'bold') {
    const fonts: Record<string, { shift: number }> = {
        bold: { shift: 0x1D400 - 0x41 },
        italic: { shift: 0x1D434 - 0x41 },
        monospace: { shift: 0x1D670 - 0x41 }
    };
    const selected = fonts[style] || fonts['bold'];
    return this.split('').map(char => {
        if (/[A-Z]/.test(char)) return String.fromCodePoint(char.charCodeAt(0) - 0x41 + selected.shift);
        if (/[a-z]/.test(char)) return String.fromCodePoint(char.charCodeAt(0) - 0x61 + selected.shift + 0x1A);
        return char;
    }).join('');
};

// ==========================================
// 3. MODIFIKASI ARRAY
// ==========================================

Array.prototype.getRandom = function () {
    return this[Math.floor(Math.random() * this.length)];
};

Array.prototype.shuffle = function () {
    const arr = [...this];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

Array.prototype.unique = function () {
    return [...new Set(this)];
};

Array.prototype.last = function () {
    return this[this.length - 1];
};

Array.prototype.first = function () {
    return this[0];
};

Array.prototype.count = function (val) {
    return this.filter(item => item === val).length;
};

Array.prototype.isEmpty = function () {
    return this.length === 0;
};

// Buang nilai null, undefined, false, 0, atau string kosong dari Array
Array.prototype.clean = function () {
    return this.filter(Boolean);
};

// ==========================================
// 4. MODIFIKASI OBJECT
// ==========================================

Object.defineProperty(Object.prototype, 'extend', {
    value: function(obj: any) {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                this[key] = obj[key];
            }
        }
        return this;
    },
    writable: true,
    configurable: true
});

Object.defineProperty(Object.prototype, 'deepCopy', {
    value: function() {
        return JSON.parse(JSON.stringify(this));
    },
    writable: true,
    configurable: true
});

// ==========================================
// 5. CUSTOM API ERROR & AXIOS INTERCEPTOR
// ==========================================

class CustomApiError extends Error {
    public isCustom: boolean = true;
    public statusCode: number;
    public type: string;

    constructor(message: string, statusCode: number = 500, type: string = 'API_ERROR') {
        super(message);
        this.name = 'TermaiApiError';
        this.statusCode = statusCode;
        this.type = type;
    }
}
global.CustomApiError;

axios.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const status = error.response?.status || 500;
        const data = error.response?.data as any;
        const msg = data?.message || data?.error || error.message;

        if (status === 429) {
            throw new CustomApiError("Terlalu banyak request ke API (Limit habis).", status, "RATE_LIMIT");
        } else if (status === 403) {
            throw new CustomApiError("Akses API ditolak (Apikey tidak valid).", status, "FORBIDDEN");
        } else if (status === 503) {
            throw new CustomApiError("Layanan API sedang tidak tersedia/maintenance.", status, "UNAVAILABLE");
        } else if (status >= 500) {
            throw new CustomApiError(`Terjadi kesalahan pada server API (Code: ${status}).`, status, "SERVER_ERROR");
        }
        
        throw new CustomApiError(msg, status, "REQUEST_ERROR");
    }
);

// ==========================================
// 6. INJEKSI MODULE KE GLOBAL
// ==========================================
global.axios = axios;
global.baileys = baileys;
global.boom = boom;
global.chalk = chalk;
global.cheerio = cheerio;
global.child = child_process;
global.crypto = crypto;
global.fs = fs;
global.path = path;
global.pino = pino;
global.util = util;

// Wajib ditaruh di akhir agar diakui sebagai module TypeScript
export {};
