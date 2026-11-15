import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { followNight } from './night.js';
import './styles/app.css';
import './styles/ensemble.css';
import './styles/editor.css';
import './styles/night.css';

/*
 * The iOS Web Audio bypass patches AudioContext before any Webamp is made.
 * Importing this module is what installs it; the player model reads the
 * result from the same module when it builds Webamp, which happens later,
 * when the dock mounts.
 */
import './player/web-audio.js';

// Day or night, before the dock mounts, so nothing draws the other way first.
followNight();

createApp( App ).use( createPinia() ).mount( '#app' );
