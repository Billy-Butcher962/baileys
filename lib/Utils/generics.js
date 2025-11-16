"use strict";

const boom = require("@hapi/boom");
const axios = require("axios");
const crypto = require("crypto");
const os = require("os");
const WAProto = require("../../WAProto");
const baileysVersionJson = require("../Defaults/baileys-version.json");
const Types = require("../Types");
const WABinary = require("../WABinary");

const COMPANION_PLATFORM_MAP = {
    'Chrome': '49',
    'Edge': '50',
    'Firefox': '51',
    'Opera': '53',
    'Safari': '54'
};

const PLATFORM_MAP = {
    'aix': 'AIX',
    'darwin': 'Mac OS',
    'win32': 'Windows',
    'android': 'Android',
    'freebsd': 'FreeBSD',
    'openbsd': 'OpenBSD',
    'sunos': 'Solaris'
};

const Browsers = {
    ubuntu: (browser) => ['Ubuntu', browser, '22.04.4'],
    macOS: (browser) => ['Mac OS', browser, '14.4.1'],
    baileys: (browser) => ['Baileys', browser, '6.5.0'],
    windows: (browser) => ['Windows', browser, '10.0.22631'],
    appropriate: (browser) => [PLATFORM_MAP[os.platform()] || 'Ubuntu', browser, os.release()]
};

const getPlatformId = (browser) => {
    const platformType = WAProto.proto.DeviceProps.PlatformType[browser.toUpperCase()];
    return platformType ? platformType.toString() : '49';
};

async function bindWaitForEvent(ev, event, check, timeoutMs) {
    let listener, closeListener;

    await promiseTimeout(timeoutMs, (resolve, reject) => {
        closeListener = ({ connection, lastDisconnect }) => {
            if (connection === 'close') {
                reject((lastDisconnect && lastDisconnect.error) || new boom.Boom('Connection Closed', {
                    statusCode: Types.DisconnectReason.connectionClosed
                }));
            }
        };

        ev.on('connection.update', closeListener);

        listener = async (update) => {
            if (await check(update)) {
                resolve();
            }
        };

        ev.on(event, listener);
    }).finally(() => {
        ev.off(event, listener);
        ev.off('connection.update', closeListener);
    });
}

const fetchLatestBaileysVersion = async (options = {}) => {
    const URL = 'https://unpkg.com/wileys@0.0.1/lib/Defaults/wileys-version.json';
    
    try {
        const result = await axios.get(URL, { ...options, responseType: 'json' });
        return {
            version: result.data.version,
            isLatest: true
        };
    } catch (error) {
        return {
            version: baileysVersionJson.version,
            isLatest: false,
            error
        };
    }
};

const fetchLatestWaWebVersion = async (options) => {
    try {
        const { data } = await axios.get('https://web.whatsapp.com/sw.js', {
            ...options,
            responseType: 'json'
        });
        const regex = /\\?"client_revision\\?":\s*(\d+)/;
        const match = data.match(regex);
        if (!match?.[1]) {
            return {
                version: baileysVersionJson.version,
                isLatest: false,
                error: { message: 'Could not find client revision in fetched content' }
            };
        }
        const clientRevision = match[1];
        return {
            version: [2, 3000, +clientRevision],
            isLatest: true
        };
    } catch (error) {
        return {
            version: baileysVersionJson.version,
            isLatest: false,
            error
        };
    }
};

module.exports = {
    Browsers,
    getPlatformId,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    bindWaitForEvent
};
