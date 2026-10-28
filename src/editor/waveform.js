/**
 * The song's waveform, for drawing down the ruler.
 *
 * Justin, 2026-10-26: "Is there a way we can have the waveform behind the
 * moving bar, and be able to zoom in and really see right where the change
 * occurs?" His biggest fear with the editor was imprecision -- clicking a
 * tiny exact spot. A waveform shows where the music changes, so you place
 * a marker on what you can see as well as what you hear.
 *
 * Peaks come from delivery-kid, which decodes each pinned file once and
 * keeps the answer: about 18 KB a song instead of the whole song (Justin,
 * 2026-10-28: on mobile data, downloading 6 MB to draw a picture is not
 * workable). Decoding in the browser is the fallback, and only on request.
 *
 * In the browser, the audio is fetched and decoded on its own, never through the element
 * that is playing: routing the playing element through Web Audio is what
 * warped the sound on iPhones (see rabbithole-player.js). Decoding a copy
 * touches nothing that is audible.
 */

// Peaks kept per second of audio: 100 is a 10ms grain, finer than anyone
// places a marker, and four minutes of it is 24,000 numbers.
export const PEAKS_PER_SECOND = 100;

const cache = new Map();
const serverCache = new Map();

export const PEAKS_SERVICE = 'https://delivery-kid.cryptograss.live/peaks';

/** The CID in a gateway URL, or null. */
export function cidFromUrl(url) {
    const m = /\/ipfs\/([A-Za-z0-9]+)/.exec(url || '');
    return m ? m[1] : null;
}

/** delivery-kid's answer as numbers 0..1. */
export function decodeServerPeaks(body) {
    const bin = atob(body.peaks || '');
    const peaks = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) peaks[i] = bin.charCodeAt(i) / 255;
    return { peaks, perSecond: body.per_second, duration: body.duration };
}

/**
 * Peaks from delivery-kid: small, cached, and the same for everyone.
 */
export function loadServerPeaks(url) {
    const cid = cidFromUrl(url);
    if (!cid) return Promise.reject(new Error('No CID in the audio URL'));
    if (serverCache.has(cid)) return serverCache.get(cid);
    const job = fetch(`${PEAKS_SERVICE}/${cid}.json`).then(r => {
        if (!r.ok) throw new Error(`Peaks service: ${r.status}`);
        return r.json();
    }).then(decodeServerPeaks);
    job.catch(() => serverCache.delete(cid));
    serverCache.set(cid, job);
    return job;
}

/**
 * Loudest sample in each slice of the song, 0..1, across all channels.
 * channels: an array of Float32Arrays (one per channel), all one length.
 */
export function computePeaks(channels, sampleRate, perSecond = PEAKS_PER_SECOND) {
    const length = channels.length ? channels[0].length : 0;
    const per = Math.max(1, Math.round(sampleRate / perSecond));
    const count = Math.ceil(length / per);
    const peaks = new Float32Array(count);
    for (const data of channels) {
        for (let i = 0; i < count; i++) {
            const end = Math.min(length, (i + 1) * per);
            let max = peaks[i];
            for (let j = i * per; j < end; j++) {
                const v = data[j] < 0 ? -data[j] : data[j];
                if (v > max) max = v;
            }
            peaks[i] = max;
        }
    }
    return peaks;
}

/**
 * The loudest peak between two times, for one row of pixels.
 */
export function peakBetween(peaks, fromSec, toSec, perSecond = PEAKS_PER_SECOND) {
    const a = Math.max(0, Math.floor(fromSec * perSecond));
    const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil(toSec * perSecond)));
    let max = 0;
    for (let i = a; i < b; i++) if (peaks[i] > max) max = peaks[i];
    return max;
}

/**
 * Fetch, decode and reduce a song to peaks. One fetch per URL per page:
 * the editor redraws often and the answer never changes.
 */
export function loadPeaks(url) {
    if (!url) return Promise.reject(new Error('No audio URL'));
    if (cache.has(url)) return cache.get(url);

    const job = (async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
        const bytes = await response.arrayBuffer();

        // An offline context has no speakers, so decoding through it
        // cannot disturb what is playing.
        const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const ctx = new Offline(1, 1, 44100);
        const audio = await new Promise((resolve, reject) => {
            const p = ctx.decodeAudioData(bytes, resolve, reject);
            if (p && p.then) p.then(resolve, reject);
        });

        const channels = [];
        for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c));
        return { peaks: computePeaks(channels, audio.sampleRate), perSecond: PEAKS_PER_SECOND, duration: audio.duration };
    })();

    // A failure is not cached, so the next open of the editor tries again.
    job.catch(() => cache.delete(url));
    cache.set(url, job);
    return job;
}

/**
 * Draw the waveform down a canvas: time runs top to bottom, loudness
 * left to right. Sized to the canvas's own box.
 */
export function drawWaveform(canvas, peaks, duration, perSecond = PEAKS_PER_SECOND, color = 'rgba(74, 124, 89, 0.35)') {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    // Canvases stop drawing past about 16k pixels on a side.
    const height = Math.min(16000, Math.round(box.height * ratio));
    const width = Math.round(box.width * ratio);
    if (!height || !width || !duration) return;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;

    // Scale to the loudest moment, so a quiet recording still has a shape.
    let top = 0;
    for (let i = 0; i < peaks.length; i++) if (peaks[i] > top) top = peaks[i];
    if (!top) return;

    const secPerRow = duration / height;
    for (let y = 0; y < height; y++) {
        const v = peakBetween(peaks, y * secPerRow, (y + 1) * secPerRow, perSecond) / top;
        if (v > 0) ctx.fillRect(0, y, Math.max(1, v * width), 1);
    }
}
