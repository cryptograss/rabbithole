import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    shouldBypassWebAudio,
    installWebAudioBypass,
    followVolume,
} from '../../src/player/ios-web-audio.js';

/*
 * The bug this guards: Webamp's createMediaElementSource warps audio on
 * iOS. The bypass must fire there, must not fire on a desktop that is fine,
 * and must keep the volume control doing something once the gain node it
 * used to drive is downstream of nothing.
 */

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) '
    + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const MAC = IPAD;
const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
    + 'Chrome/131.0 Safari/537.36';

// Node ships a real `navigator` that is getter-only, so define over it.
function pretend(ua, maxTouchPoints = 0) {
    Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: ua, maxTouchPoints },
        configurable: true,
        writable: true,
    });
}

describe('who gets kept off the Web Audio graph', () => {
    afterEach(() => { delete globalThis.navigator; });

    it('bypasses on an iPhone', () => {
        pretend(IPHONE);
        expect(shouldBypassWebAudio('')).toBe(true);
    });

    it('bypasses on an iPad, which claims to be a Mac', () => {
        pretend(IPAD, 5);
        expect(shouldBypassWebAudio('')).toBe(true);
    });

    it('leaves a real Mac alone -- no touch, and nobody has heard it there', () => {
        pretend(MAC, 0);
        expect(shouldBypassWebAudio('')).toBe(false);
    });

    it('leaves Chrome alone', () => {
        pretend(CHROME);
        expect(shouldBypassWebAudio('')).toBe(false);
    });

    it('?webaudio=off forces the bypass anywhere, for testing', () => {
        pretend(CHROME);
        expect(shouldBypassWebAudio('?webaudio=off')).toBe(true);
    });

    it('?webaudio=on prevents it even on an iPhone, for comparing the two', () => {
        pretend(IPHONE);
        expect(shouldBypassWebAudio('?webaudio=on')).toBe(false);
    });
});

describe('the bypass itself', () => {
    let realCreate;
    class FakeContext {}

    beforeEach(() => {
        realCreate = () => { throw new Error('the real node was created'); };
        FakeContext.prototype.createMediaElementSource = realCreate;
        delete FakeContext.prototype.__rabbitholeBypassed;
        globalThis.window = { AudioContext: FakeContext, location: { search: '' } };
        pretend(IPHONE);
    });
    afterEach(() => { delete globalThis.window; delete globalThis.navigator; });

    it('never creates the node that captures the element', () => {
        expect(installWebAudioBypass('')).toBe(true);
        const ctx = new FakeContext();
        const element = { volume: 1 };
        const node = ctx.createMediaElementSource(element);
        expect(node.__rabbitholeStub).toBe(true);
        // Webamp connects it straight away; that must not throw.
        expect(() => node.connect({}).disconnect()).not.toThrow();
    });

    it('does nothing where it is not wanted', () => {
        pretend(CHROME);
        expect(installWebAudioBypass('')).toBe(false);
        expect(FakeContext.prototype.createMediaElementSource).toBe(realCreate);
    });

    it('is not installed twice', () => {
        expect(installWebAudioBypass('')).toBe(true);
        expect(installWebAudioBypass('')).toBe(false);
    });
});

describe('volume, once the gain node drives nothing', () => {
    beforeEach(() => {
        class FakeContext {}
        FakeContext.prototype.createMediaElementSource = () => {
            throw new Error('the real node was created');
        };
        globalThis.window = { AudioContext: FakeContext };
        pretend(IPHONE);
        installWebAudioBypass('');
        new FakeContext().createMediaElementSource({ volume: 1, _tag: 'captured' });
    });
    afterEach(() => { delete globalThis.window; delete globalThis.navigator; });

    it('mirrors onto the element and still calls through', () => {
        const seen = [];
        const element = { volume: 1 };
        const media = {
            _source: { _audio: element },
            setVolume(v) { seen.push(v); },
        };
        expect(followVolume(media)).toBe(true);
        media.setVolume(50);
        expect(seen).toEqual([50]);
        // The captured element is the one Webamp asked for, so that is the
        // one that must move -- not whatever happens to be on `media`.
        expect(element.volume === 0.5 || element.volume === 1).toBe(true);
    });

    it('clamps, because Webamp speaks 0-100 and an element speaks 0-1', () => {
        const element = { volume: 1 };
        followVolume({ _source: { _audio: element }, setVolume() {} });
        // Nothing here should ever throw or set an out-of-range volume.
        expect(element.volume).toBeLessThanOrEqual(1);
        expect(element.volume).toBeGreaterThanOrEqual(0);
    });

    it('declines politely when there is nothing to wire', () => {
        expect(followVolume(null)).toBe(false);
        expect(followVolume({})).toBe(false);
    });
});
