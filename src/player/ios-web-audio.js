/*
 * Keep iOS off the Web Audio graph.
 *
 * Webamp routes every track through `createMediaElementSource`, which hands
 * the media element's output to a Web Audio graph (gain, stereo balance,
 * equaliser, the visualiser's analyser). On iOS that graph mangles the
 * sound: the audio warps, speeding and slowing, while the element's own
 * clock keeps perfect time.
 *
 * Found on 2026-10-19 by elimination, on Skyler's iPhone, with a page that
 * played the same file four ways:
 *
 *   1. ogg,  plain <audio>            clean
 *   3. ogg,  through a Web Audio graph  warped
 *
 * Same file, same decoder, same connection, same device. The only
 * difference between 1 and 3 is createMediaElementSource. Everything else
 * had already been cleared: the player's own readout reported no stall, no
 * drift and rate 1 through the warp, the gateway serves the whole 4MB file
 * in under two seconds, and the display loop costs a fifth of a millisecond
 * a tick.
 *
 * So on iOS, don't build the graph. The element then plays natively, the
 * way player 1 did. What that costs: the equaliser and the visualiser do
 * nothing on an iPhone, and stereo balance is fixed at centre. Volume is
 * kept working by mirroring it onto the element (`followVolume`).
 *
 * Scoped to iOS deliberately. Desktop Safari shares WebKit and may share
 * the bug, but nobody has heard it there, and turning the graph off for a
 * machine that does not need it would cost the EQ for nothing. ?webaudio=off
 * forces the bypass anywhere, ?webaudio=on prevents it, for testing both.
 */

// iPads have reported themselves as a Mac since iPadOS 13; the touch points
// are what gives them away.
function isIOS() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPhone|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

export function shouldBypassWebAudio(search = '') {
    const forced = new URLSearchParams(search).get('webaudio');
    if (forced === 'off') return true;
    if (forced === 'on') return false;
    return isIOS();
}

/*
 * The element Webamp asked to capture, had we let it. Kept so volume can be
 * mirrored onto it once the player is up.
 */
let captured = null;

export function capturedElement() {
    return captured;
}

/*
 * Must be called before Webamp constructs its graph -- which it does as the
 * module initialises -- so this runs before the dynamic import of the
 * player, not after.
 */
export function installWebAudioBypass(search = '') {
    if (!shouldBypassWebAudio(search)) return false;
    const Ctx = typeof window !== 'undefined'
        && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx || Ctx.prototype.__rabbitholeBypassed) return false;

    const real = Ctx.prototype.createMediaElementSource;
    Ctx.prototype.createMediaElementSource = function (element) {
        captured = element;
        // Never called: creating the real node is what captures the element,
        // and capturing it is the whole problem. Return something with the
        // shape Webamp expects so its own wiring goes through unchanged.
        void real;
        return {
            __rabbitholeStub: true,
            connect() { return this; },
            disconnect() { return this; },
        };
    };
    Ctx.prototype.__rabbitholeBypassed = true;
    return true;
}

/*
 * The volume slider drives a gain node that is now downstream of nothing.
 * Point it at the element instead, so the control still does what it says.
 */
export function followVolume(media) {
    const element = captured || (media && media._source && media._source._audio);
    if (!media || !element || typeof media.setVolume !== 'function') return false;
    const original = media.setVolume.bind(media);
    media.setVolume = (volume) => {
        original(volume);
        element.volume = Math.max(0, Math.min(1, volume / 100));
    };
    return true;
}
