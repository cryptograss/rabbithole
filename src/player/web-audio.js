/*
 * Whether this page keeps iOS off the Web Audio graph, decided once, as
 * early as the app loads. See ios-web-audio.js for why.
 */
import { installWebAudioBypass } from './ios-web-audio.js';

export const webAudioBypassed = typeof window !== 'undefined'
	? installWebAudioBypass( window.location.search )
	: false;
