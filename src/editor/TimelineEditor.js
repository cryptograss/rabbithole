/**
 * TimelineEditor - UI Component for Rabbithole Metadata Editor
 *
 * Displays timeline markers in a list with:
 * - Click to seek to marker time
 * - Play from marker button
 * - Delete marker button
 * - Inline time editing with arrow key fine-tuning
 * - YAML editing for marker data (flexible, no predefined schema)
 * - Add marker at current time
 * - Visual highlight of current playing position
 */

import jsYaml from 'js-yaml';

import { musicianEntries, statusAt, compactMusicians, unmatchedNames, renameMusician } from '../musician-status.js';

import { loadPeaks, loadServerPeaks, drawWaveform } from './waveform.js';

// The rabbit that runs down the ruler as the song plays.
const RABBIT_URL = new URL('../images/rabbit.png', import.meta.url).href;
export class TimelineEditor {
    /*
     * What an empty marker starts as. The two keys that every marker
     * wants -- who is soloing and which part it is -- with the rest
     * named in a comment so nobody has to remember them.
     */
    static NEW_MARKER_TEMPLATE = [
        'solo: ',
        'part: ',
        '# part: intro | A | B | outro',
        '# pickup: Name          -- somebody leading in',
        '# musicians:            -- who comes in or drops out',
        '#   Name: in',
        '#   band: in'
    ].join('\n');

    constructor(containerId, editableTrackData, player, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('TimelineEditor: Container not found:', containerId);
            return;
        }

        this.data = editableTrackData;
        this.player = player;
        this.options = options;

        // State
        this.currentPlayingTime = 0;
        this.editingMarkerTime = null; // Time of marker being edited
        this.expandedMarkerTime = null; // Time of marker with YAML editor open
        /*
         * Open on the list, not the YAML.
         *
         * The list shows every marker as mm:ss.t and takes the same back;
         * the raw view shows the stored keys, which are seconds, because
         * that is what the player reads. Skyler, 2026-10-25: counting in
         * seconds is slow going when you think in minutes -- and he was
         * looking at the raw view, which is what opens first. The YAML is
         * still a click away for anyone who wants it.
         */
        this.rawMode = false;

        // Bind methods
        this._onTimeUpdate = this._onTimeUpdate.bind(this);
        this._onDataChange = this._onDataChange.bind(this);

        // Set up callbacks
        this.data.onChange = this._onDataChange;

        // Register with player for time updates
        if (this.player && this.player.onTimeUpdate) {
            this.player.onTimeUpdate(this._onTimeUpdate);
        }

        // Initial render
        this.render();
    }

    /**
     * Format time as mm:ss.t (tenths)
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const tenths = Math.floor((seconds % 1) * 10);
        return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
    }

    /**
     * Parse time string back to seconds
     */
    parseTime(timeStr) {
        const match = timeStr.match(/^(\d+):(\d{2})(?:\.(\d))?$/);
        if (!match) return null;

        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const tenths = match[3] ? parseInt(match[3], 10) : 0;

        return mins * 60 + secs + tenths / 10;
    }

    /**
     * Render the timeline editor UI
     */
    render() {
        if (this.rawMode) {
            this._renderRawMode();
        } else {
            this._renderListMode();
        }
    }

    /**
     * Render raw YAML mode - single textarea with entire timeline
     */
    _renderRawMode() {
        // Build the full data object to show
        const fullData = {
            timeline: this.data.workingData.timeline,
            standardSectionLength: this.data.workingData.standardSectionLength
        };

        const yamlStr = jsYaml.dump(fullData, {
            indent: 2,
            lineWidth: -1,
            sortKeys: (a, b) => {
                // Sort timeline keys numerically
                const numA = parseFloat(a);
                const numB = parseFloat(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            }
        });

        this.container.innerHTML = `
            <div class="timeline-editor raw-mode">
                <div class="editor-header">
                    <h3>Timeline YAML</h3>
                    <div class="editor-actions">
                        <button class="btn-toggle-mode" title="Switch to list view">
                            List View
                        </button>
                    </div>
                </div>

                <div class="raw-yaml-container">
                    <textarea class="raw-yaml-input" spellcheck="false">${this._escapeHtml(yamlStr)}</textarea>
                    <div class="raw-yaml-error"></div>
                </div>

                <div class="raw-yaml-actions">
                    <button class="btn-apply-raw-yaml">Apply Changes</button>
                    <span class="yaml-hint">Edit YAML, then Apply (or Ctrl+Enter)</span>
                    <span class="current-time-display">Current: ${this.formatTime(this.currentPlayingTime)}</span>
                </div>

                <div class="editor-footer">
                    <div class="dirty-indicator ${this.data.isDirty ? 'dirty' : ''}">
                        ${this.data.isDirty ? 'Unsaved changes' : 'Saved'}
                    </div>
                    <div class="editor-controls">
                        <button class="btn-undo" ${this.data.undoStack.length === 0 ? 'disabled' : ''} title="Undo (Ctrl+Z)">
                            Undo
                        </button>
                        <button class="btn-redo" ${this.data.redoStack.length === 0 ? 'disabled' : ''} title="Redo (Ctrl+Y)">
                            Redo
                        </button>
                        <button class="btn-revert" ${!this.data.isDirty ? 'disabled' : ''} title="Revert all changes">
                            Revert
                        </button>
                    </div>
                </div>
            </div>
        `;

        this._attachRawModeListeners();
    }

    /**
     * Attach event listeners for raw YAML mode
     */
    _attachRawModeListeners() {
        const textarea = this.container.querySelector('.raw-yaml-input');
        const errorDiv = this.container.querySelector('.raw-yaml-error');
        const applyBtn = this.container.querySelector('.btn-apply-raw-yaml');
        const toggleBtn = this.container.querySelector('.btn-toggle-mode');

        // Toggle to list mode
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.rawMode = false;
                this.render();
            });
        }

        // Apply button
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this._applyRawYaml(textarea.value, errorDiv);
            });
        }

        // Ctrl+Enter to apply
        if (textarea) {
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this._applyRawYaml(textarea.value, errorDiv);
                }
                // Don't let keyboard shortcuts fire while editing
                e.stopPropagation();
            });

            // Clear error on input
            textarea.addEventListener('input', () => {
                if (errorDiv) errorDiv.textContent = '';
            });
        }

        // Undo/Redo/Revert
        this._attachUndoRedoListeners();
    }

    /**
     * Apply raw YAML to the entire timeline
     */
    _applyRawYaml(yamlStr, errorDiv) {
        try {
            const rawParsed = jsYaml.load(yamlStr);

            if (typeof rawParsed !== 'object' || rawParsed === null) {
                throw new Error('YAML must be an object');
            }

            // Accept either the flat shape (timeline at top level) or the
            // arthel song YAML shape (studio_versions.0.<Album>.{ensemble,
            // rabbithole.timeline, ...}). Pasting the whole arthel file
            // is a common workflow.
            const parsed = _normalizeMetadata(rawParsed);

            if (!parsed.timeline || typeof parsed.timeline !== 'object') {
                throw new Error('Must have a "timeline" object');
            }

            // Save undo state
            this.data._saveUndoState();

            // Replace timeline
            this.data.workingData.timeline = parsed.timeline;

            // Update ensemble too, since arthel-paste typically brings it
            if (parsed.ensemble && typeof parsed.ensemble === 'object') {
                this.data.workingData.ensemble = parsed.ensemble;
            }

            // Update standardSectionLength if provided
            if (parsed.standardSectionLength !== undefined) {
                this.data.workingData.standardSectionLength = parsed.standardSectionLength;
            }

            // Notify changes
            this.data._notifyChange();
            this._notifyTimelineChange();

            // Show success
            if (errorDiv) {
                errorDiv.style.color = '#4a7c59';
                errorDiv.textContent = 'Applied!';
                setTimeout(() => {
                    if (errorDiv) errorDiv.textContent = '';
                }, 1500);
            }

        } catch (e) {
            if (errorDiv) {
                errorDiv.style.color = '#c00';
                errorDiv.textContent = `YAML error: ${e.message}`;
            }
        }
    }

    /**
     * Render list mode (original UI)
     */
    _renderListMode() {
        const entries = this.data.getTimelineEntries();
        const musicians = this.data.getMusicianNames();
        const oldRuler = this.container.querySelector('.timeline-ruler');
        if (oldRuler) this._rulerScroll = oldRuler.scrollTop;

        this.container.innerHTML = `
            <div class="timeline-editor">
                <div class="editor-header">
                    <h3>Timeline Editor</h3>
                    <div class="editor-actions">
                        <button class="btn-toggle-mode" title="Switch to raw YAML view">
                            Raw YAML
                        </button>
                        <button class="btn-tidy" title="Say only what changes: collapse repeated 'in' lists, and write 'band: in' when everyone joins at once">
                            Tidy
                        </button>
                        <span class="ruler-zoom" title="Zoom the timeline (or Ctrl + scroll on it)">
                            <button class="btn-zoom-out" ${this._zoom() <= 1 ? 'disabled' : ''}>−</button>
                            <span class="ruler-zoom-level">${this._zoom()}×</span>
                            <button class="btn-zoom-in" ${this._zoom() >= 32 ? 'disabled' : ''}>+</button>
                        </span>
                        <button class="btn-add-marker" title="Add a marker where the playhead is (Space)">
                            + Add Marker at <span class="add-marker-time">${this.formatTime(this.currentPlayingTime || 0)}</span>
                        </button>
                    </div>
                </div>

                <div class="editor-body">
                    ${this.renderRuler(entries)}
                    <div class="marker-list">
                        ${entries.map((entry, index) => this.renderMarkerRow(entry, index, musicians)).join('')}
                    </div>
                </div>

                ${this.renderEnsemblePanel()}

                <div class="editor-footer">
                    <div class="dirty-indicator ${this.data.isDirty ? 'dirty' : ''}">
                        ${this.data.isDirty ? 'Unsaved changes' : 'Saved'}
                    </div>
                    <div class="editor-controls">
                        <button class="btn-undo" ${this.data.undoStack.length === 0 ? 'disabled' : ''} title="Undo (Ctrl+Z)">
                            Undo
                        </button>
                        <button class="btn-redo" ${this.data.redoStack.length === 0 ? 'disabled' : ''} title="Redo (Ctrl+Y)">
                            Redo
                        </button>
                        <button class="btn-revert" ${!this.data.isDirty ? 'disabled' : ''} title="Revert all changes">
                            Revert
                        </button>
                    </div>
                </div>
            </div>
        `;

        this._attachEventListeners();
        if (this._rulerMove) window.removeEventListener('mousemove', this._rulerMove);
        if (this._rulerUp) window.removeEventListener('mouseup', this._rulerUp);
        this._attachRulerListeners();
        const ruler = this.container.querySelector('.timeline-ruler');
        if (ruler && this._rulerScroll) ruler.scrollTop = this._rulerScroll;
        this._drawWave();
        this._highlightCurrentMarker();
    }

    /**
     * Who is on this recording, and on what.
     *
     * Skyler, 2026-10-29: the editor had nowhere to say what anyone plays,
     * so every ensemble it wrote out read "Name: []". One row per person;
     * instruments comma-separated, and the first is what their card shows.
     */
    renderEnsemblePanel() {
        const band = this.data.workingData.ensemble || {};
        const names = Object.keys(band);
        if (!names.length) return '';
        const common = ['guitar', 'banjo', 'mandolin', 'fiddle', 'bass', 'dobro',
            'cello', 'vocals', 'harmony vocals', 'piano', 'drums', 'percussion',
            'harmonica', 'melodica', 'throat singing', 'pedal steel', 'accordion'];
        const rows = names.map(name => {
            const list = Array.isArray(band[name]) ? band[name] : (band[name] ? [band[name]] : []);
            const empty = list.length ? '' : ' empty';
            return `<label class="ens-row${empty}">
                <span class="ens-name">${this._escapeHtml(name)}</span>
                <input class="ens-instruments" data-musician="${this._escapeHtml(name)}"
                       value="${this._escapeHtml(list.join(', '))}" list="rh-instruments"
                       placeholder="what do they play?" autocomplete="off">
            </label>`;
        }).join('');
        const missing = names.filter(n => !(band[n] && band[n].length)).length;
        return `
            <div class="ensemble-panel">
                <div class="ens-head">
                    <h4>On this recording</h4>
                    ${missing ? `<span class="ens-missing">${missing} without an instrument</span>` : ''}
                </div>
                ${rows}
                <datalist id="rh-instruments">${common.map(i => `<option value="${i}">`).join('')}</datalist>
            </div>`;
    }

    _saveInstruments(input) {
        const name = input.dataset.musician;
        const list = input.value.split(',').map(x => x.trim()).filter(Boolean);
        const band = this.data.workingData.ensemble || (this.data.workingData.ensemble = {});
        if (JSON.stringify(band[name] || []) === JSON.stringify(list)) return;

        this.data._saveUndoState();
        band[name] = list;

        // The cards read the player's copy of the ensemble.
        if (this.player && this.player.trackData) {
            this.player.trackData.ensemble = { ...(this.player.trackData.ensemble || {}), [name]: list };
            if (this.player.updateEnsembleDisplay) {
                this.player.updateEnsembleDisplay(this.currentPlayingTime || 0);
            }
        }

        // Re-rendering drops focus; put it back where the person tabbed to.
        const active = document.activeElement;
        const next = active && active.classList && active.classList.contains('ens-instruments')
            ? active.dataset.musician : null;
        this.data._notifyChange();
        if (next) {
            const el = [...this.container.querySelectorAll('.ens-instruments')]
                .find(i => i.dataset.musician === next);
            if (el) { el.focus(); el.select(); }
        }
    }

    /** How far the ruler is zoomed: 1 is the whole song in one column. */
    _zoom() {
        return this.rulerZoom || 1;
    }

    /**
     * Zoom the ruler, keeping one moment (the playhead, or what is under
     * the pointer) where it was on screen, so zooming never loses your place.
     */
    setZoom(zoom, anchorTime = null, anchorY = null) {
        const next = Math.max(1, Math.min(32, zoom));
        if (next === this._zoom()) return;
        const ruler = this.container.querySelector('.timeline-ruler');
        const track = this.container.querySelector('.ruler-track');
        const duration = track ? parseFloat(track.dataset.duration) || 0 : 0;
        const t = anchorTime ?? (this.currentPlayingTime || 0);
        // Where on screen the anchor sits now, relative to the ruler's box.
        let screenY = anchorY;
        if (screenY == null && ruler && track && duration) {
            screenY = track.offsetTop + (t / duration) * track.offsetHeight - ruler.scrollTop;
        }
        this.rulerZoom = next;
        this.render();
        const r = this.container.querySelector('.timeline-ruler');
        const tr = this.container.querySelector('.ruler-track');
        if (r && tr && duration) {
            r.scrollTop = Math.max(0, tr.offsetTop + (t / duration) * tr.offsetHeight - (screenY ?? r.clientHeight / 3));
            this._rulerScroll = r.scrollTop;
        }
    }

    /**
     * Paint the waveform behind the ruler. Peaks come from delivery-kid;
     * if it has none, offer to draw them from the song itself, which
     * downloads the whole file -- so only when asked.
     */
    _drawWave() {
        const url = this.player && this.player.trackData && this.player.trackData.audioFile;
        if (!url || !this.container.querySelector('.ruler-wave')) return;
        const paint = ({ peaks, perSecond }) => {
            // The editor may have redrawn while this was loading; draw on
            // whichever canvas is there now.
            const c = this.container.querySelector('.ruler-wave');
            const track = this.container.querySelector('.ruler-track');
            if (c && track) drawWaveform(c, peaks, parseFloat(track.dataset.duration) || 0, perSecond);
        };
        const setState = (state) => {
            const r = this.container.querySelector('.timeline-ruler');
            if (!r) return;
            r.classList.toggle('wave-loading', state === 'loading');
            const old = r.querySelector('.ruler-wave-offer');
            if (old) old.remove();
            if (state === 'offer') {
                const b = document.createElement('button');
                b.className = 'ruler-wave-offer';
                b.textContent = 'show waveform';
                b.title = 'Draws it from the song itself, which downloads the whole file';
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setState('loading');
                    loadPeaks(url).then(p => { setState('done'); paint(p); }).catch(err => {
                        setState('offer');
                        console.warn('Waveform unavailable:', err.message);
                    });
                });
                b.addEventListener('mousedown', e => e.stopPropagation());
                r.querySelector('.ruler-track').appendChild(b);
            }
        };
        if (this._wavePeaks && this._wavePeaksUrl === url) {
            paint(this._wavePeaks);
            return;
        }
        setState('loading');
        loadServerPeaks(url).then(p => {
            this._wavePeaks = p;
            this._wavePeaksUrl = url;
            setState('done');
            paint(p);
        }).catch(() => setState('offer'));
    }

    /**
     * Attach undo/redo/revert listeners (shared between modes)
     */
    _attachUndoRedoListeners() {
        const undoBtn = this.container.querySelector('.btn-undo');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                this.data.undo();
                this._notifyTimelineChange();
            });
        }

        const redoBtn = this.container.querySelector('.btn-redo');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                this.data.redo();
                this._notifyTimelineChange();
            });
        }

        const revertBtn = this.container.querySelector('.btn-revert');
        if (revertBtn) {
            revertBtn.addEventListener('click', () => {
                if (confirm('Revert all changes to original data?')) {
                    this.data.revert();
                    this._notifyTimelineChange();
                }
            });
        }
    }

    /**
     * Render a single marker row
     */

    /**
     * How long the song is, as best we can tell.
     *
     * The ruler has to be a ruler of something. Prefer the recording's own
     * duration; failing that, leave room past the last marker so a timeline
     * still has somewhere to grow.
     */
    _rulerDuration(entries) {
        /*
         * Ask the audio first.
         *
         * The ruler used to take the duration from the metadata, and a
         * Release page without one falls back to 180 -- so every longer
         * song stopped at 3:00 and there was no way to chart past it.
         * Skyler, 2026-10-25. The loaded audio knows how long it really
         * is; the metadata is only the guess for before it has loaded.
         */
        const real = this.player && this.player.getDuration ? this.player.getDuration() : 0;
        if (real > 0) return real;

        const stated = this.data.workingData.duration;
        const last = entries.length ? entries[entries.length - 1].time : 0;
        // Never shorter than the markers already on it, plus room to grow.
        return Math.max(60, stated || 0, last + 30);
    }

    /**
     * The song as a vertical line.
     *
     * Skyler, 2026-10-25: a timeline you can run the mouse down until you
     * reach the right moment, and drop a marker there. The list of markers
     * answers "what is at 1:04"; the line answers "where am I in the song",
     * which is the question you are actually holding while you listen.
     *
     * Section bands are drawn when the recording is authored around a click
     * -- standardSectionLength, which Justin built into the data model and
     * which August and Paint Exchange both use. On a click, a section is
     * the unit you think in, so it should be the unit you can see.
     */
    renderRuler(entries) {
        const duration = this._rulerDuration(entries);
        const pct = t => Math.max(0, Math.min(100, (t / duration) * 100));

        // Ticks: as fine as fits, at least ~28px apart, so zooming in
        // brings in seconds and zooming out leaves the minutes.
        const trackPx = 400 * this._zoom();
        const pxPerSec = trackPx / duration;
        const step = [1, 2, 5, 10, 15, 30, 60].find(s => s * pxPerSec >= 28) || 60;
        const ticks = [];
        for (let t = 0; t <= duration; t += step) {
            ticks.push(`<div class="ruler-tick" style="top:${pct(t)}%">
                <span class="ruler-tick-label">${this.formatTime(t).replace(/\.\d$/, '')}</span>
            </div>`);
        }

        // Section bands, alternating, when there is a click to band by.
        const len = this.data.workingData.standardSectionLength;
        const bands = [];
        if (len && len > 0) {
            // Sections accumulate from the last explicit time before them,
            // the same way the player works them out.
            const explicit = entries.map(e => e.time).filter(t => t < len * 2);
            let start = explicit.length ? Math.max(...explicit) : 0;
            let i = 1;
            while (start + len <= duration && i <= 40) {
                const from = start + len;
                bands.push(`<div class="ruler-band ${i % 2 ? 'odd' : 'even'}"
                     style="top:${pct(from)}%;height:${pct(from + len) - pct(from)}%"
                     title="Section ${i} -- ${this.formatTime(from)}">
                     <span class="ruler-band-label">${i}</span>
                </div>`);
                start = from;
                i += 1;
            }
        }

        const markers = entries.map(entry => {
            const { time, data } = entry;
            const who = data.solo || data.pickup || '';
            const part = data.part || '';
            const label = [part, who].filter(Boolean).join(' · ') || 'unnamed';
            const selected = this.data.selectedMarkerTime === time ? ' selected' : '';
            return `<div class="ruler-marker${selected}" style="top:${pct(time)}%"
                         data-time="${time}" title="${this._escapeHtml(this.formatTime(time) + '  ' + label)}">
                        <span class="ruler-marker-label">${this._escapeHtml(label)}</span>
                    </div>`;
        }).join('');

        return `
            <div class="timeline-ruler">
                <div class="ruler-track" data-duration="${duration}" style="height:${trackPx}px">
                    <canvas class="ruler-wave"></canvas>
                    ${bands.join('')}
                    ${ticks.join('')}
                    ${markers}
                    <div class="ruler-playhead" style="top:${pct(this.currentPlayingTime || 0)}%"><img class="ruler-rabbit" src="${RABBIT_URL}" alt="" draggable="false"><span class="ruler-playhead-tag">now <b>${this.formatTime(this.currentPlayingTime || 0).replace(/\.\d$/, '')}</b></span></div>
                    <div class="ruler-hover" hidden><span class="ruler-hover-time"></span></div>
                </div>
            </div>
        `;
    }

    /**
     * Mouse over the line: show the time under the pointer. Click: go there.
     * Double-click: drop a marker there and open it to be filled in.
     */
    _attachRulerListeners() {
        const track = this.container.querySelector('.ruler-track');
        if (!track) return;

        const duration = parseFloat(track.dataset.duration) || 0;
        const hover = track.querySelector('.ruler-hover');
        const hoverTime = track.querySelector('.ruler-hover-time');

        const timeAt = (clientY) => {
            const rect = track.getBoundingClientRect();
            const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
            return Math.round((y / rect.height) * duration * 10) / 10;
        };

        const showHover = (clientY) => {
            const rect = track.getBoundingClientRect();
            hover.hidden = false;
            hover.style.top = `${((clientY - rect.top) / rect.height) * 100}%`;
            hoverTime.textContent = this.formatTime(timeAt(clientY));
        };

        /*
         * Scrub, then click.
         *
         * Skyler, 2026-10-25: a ruler you can scroll through until you get
         * the right time, and then click. So dragging moves the playhead
         * with you -- you hear where you are, which is the only way to find
         * the moment a solo changes -- and a click that did not drag opens
         * the form for that moment.
         */
        let dragging = false;
        let startY = 0;
        let moved = false;

        track.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ruler-marker')) return;
            dragging = true;
            moved = false;
            startY = e.clientY;
            showHover(e.clientY);
            e.preventDefault();
        });

        window.addEventListener('mousemove', this._rulerMove = (e) => {
            if (!dragging) return;
            if (Math.abs(e.clientY - startY) > 3) moved = true;
            showHover(e.clientY);
            if (moved) this.seekTo(timeAt(e.clientY));
        });

        window.addEventListener('mouseup', this._rulerUp = (e) => {
            if (!dragging) return;
            dragging = false;
            const t = timeAt(e.clientY);
            if (moved) {
                this.seekTo(t);
            } else {
                this.openMarkerForm(t, null);
            }
        });

        track.addEventListener('mousemove', (e) => {
            if (!dragging) showHover(e.clientY);
        });

        track.addEventListener('mouseleave', () => {
            if (!dragging) hover.hidden = true;
        });

        // Instruments: saved when you leave the field or press Enter.
        this.container.querySelectorAll('.ens-instruments').forEach(input => {
            input.addEventListener('change', () => this._saveInstruments(input));
            input.addEventListener('keydown', (e) => {
                e.stopPropagation(); // Space types a space, not "add marker"
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            });
        });

        // Zoom: the buttons, or Ctrl/⌘ + scroll over the ruler, which zooms
        // around the moment under the pointer.
        const zin = this.container.querySelector('.btn-zoom-in');
        const zout = this.container.querySelector('.btn-zoom-out');
        if (zin) zin.addEventListener('click', () => this.setZoom(this._zoom() * 2));
        if (zout) zout.addEventListener('click', () => this.setZoom(this._zoom() / 2));
        const ruler = this.container.querySelector('.timeline-ruler');
        if (ruler) {
            ruler.addEventListener('wheel', (e) => {
                if (!(e.ctrlKey || e.metaKey)) {
                    this._userScrolledAt = performance.now();
                    return;
                }
                e.preventDefault();
                const box = ruler.getBoundingClientRect();
                this.setZoom(this._zoom() * (e.deltaY < 0 ? 2 : 0.5), timeAt(e.clientY), e.clientY - box.top);
            }, { passive: false });
            ruler.addEventListener('touchstart', () => { this._userScrolledAt = performance.now(); }, { passive: true });
        }

        // A marker on the line opens itself, filled in.
        track.querySelectorAll('.ruler-marker').forEach(m => {
            m.addEventListener('mousedown', (e) => e.stopPropagation());
            m.addEventListener('click', (e) => {
                e.stopPropagation();
                const t = parseFloat(m.dataset.time);
                this.data.selectedMarkerTime = t;
                this.seekTo(t);
                this.openMarkerForm(t, t);
            });
        });
    }

    /**
     * The template box: what happens at this moment, as a form.
     *
     * Skyler asked for "a template box with the different options" rather
     * than a YAML field, and he is right -- the keys of a marker are a
     * short, known list, and typing them out is work a form can do. The
     * YAML is still underneath and still reachable; this is a way in that
     * does not require remembering the vocabulary.
     */
    openMarkerForm(time, existingTime) {
        this.closeMarkerForm();

        const t = Math.round(time * 10) / 10;
        const data = existingTime !== null ? (this.data.getMarker(existingTime) || {}) : {};
        const parts = ['intro', 'A', 'B', 'outro'];

        /*
         * Who this box can offer.
         *
         * The ensemble when there is one -- and when there is not, which is
         * nine of the eleven 4masks tracks, whoever the timeline already
         * names. Charting a track from nothing, the second marker can then
         * pick from the people the first one introduced.
         */
        const musicians = (() => {
            const named = this.data.getMusicianNames();
            if (named.length) return named;
            const seen = new Set();
            Object.values(this.data.workingData.timeline || {}).forEach(m => {
                if (!m || typeof m !== 'object') return;
                if (m.solo) seen.add(m.solo);
                if (m.pickup) seen.add(m.pickup);
                Object.keys(m.musicians || {}).forEach(n => { if (n !== 'band') seen.add(n); });
            });
            return [...seen].sort();
        })();

        const who = (name, selected) => `<option value="${this._escapeHtml(name)}"${
            selected === name ? ' selected' : ''}>${this._escapeHtml(name)}</option>`;

        /*
         * A dropdown of nobody is no use.
         *
         * Nine of the eleven 4masks tracks have an empty ensemble, so on
         * those the Solo list would offer only "nobody" and charting would
         * be impossible. Where there is no ensemble recorded, take the
         * names by hand instead -- and what gets typed is what the player
         * will match on, so it is also how an ensemble starts existing.
         */
        /*
         * Type it or pick it.
         *
         * A plain <select> can only offer what is already recorded, and on
         * a track nobody has charted that is nobody -- but even on a full
         * ensemble, a guest or a wrong spelling needs typing. Skyler,
         * 2026-10-25: "it won't let me type in the name of the player". So
         * a text box with a datalist: the known names drop down, and
         * anything else can be written.
         */
        const listId = `mf-names-${Math.random().toString(36).slice(2, 8)}`;
        const instListId = `mf-insts-${Math.random().toString(36).slice(2, 8)}`;

        /*
         * Instruments this record already knows about: what people are
         * down as playing, plus anything a marker has switched them to.
         */
        const instruments = (() => {
            const seen = new Set();
            Object.values(this.data.ensemble || {}).forEach(v => {
                (Array.isArray(v) ? v : [v]).forEach(i => i && seen.add(i));
            });
            Object.values(this.data.workingData.timeline || {}).forEach(m => {
                Object.values((m && m.instrumentChanges) || {}).forEach(i => i && seen.add(i));
            });
            return [...seen].sort();
        })();
        const field = (cls, value, label) => `<input type="text" class="${cls}"
                list="${listId}" autocomplete="off"
                value="${this._escapeHtml(value || '')}"
                placeholder="${musicians.length ? 'pick or type a name' : 'type a name'}">`;
        const nameList = `<datalist id="${listId}">${
            musicians.map(n => `<option value="${this._escapeHtml(n)}"></option>`).join('')
        }</datalist>`;

        const box = document.createElement('div');
        box.className = 'marker-form';
        box.innerHTML = `
            ${nameList}
            <datalist id="${instListId}">${
                instruments.map(i => `<option value="${this._escapeHtml(i)}"></option>`).join('')
            }</datalist>
            <div class="marker-form-head">
                <strong>${existingTime !== null ? 'Marker at' : 'New marker at'}</strong>
                <input type="text" class="mf-time" value="${this.formatTime(t)}">
                <button class="mf-close" title="Close">✕</button>
            </div>

            <label class="mf-row">
                <span>Part</span>
                <span class="mf-parts">
                    ${parts.map(pt => `<button class="mf-part${data.part === pt ? ' on' : ''}"
                        data-part="${pt}">${pt}</button>`).join('')}
                </span>
            </label>

            <label class="mf-row">
                <span title="Who is taking the solo from this moment">Soloist</span>
                ${field('mf-solo', data.solo, 'nobody')}
            </label>

            <label class="mf-row">
                <span title="What the soloist picks up here. Leave blank if they stay on the same thing.">Instrument</span>
                <input type="text" class="mf-instrument" list="${instListId}" autocomplete="off"
                       value="${this._escapeHtml(this._soloInstrument(data))}"
                       placeholder="only if they switch here">
            </label>

            <label class="mf-row">
                <span title="Somebody leading into the next part, ahead of the soloist">Pickup</span>
                ${field('mf-pickup', data.pickup, 'none')}
            </label>

            <div class="mf-who">
                <div class="mf-who-head">
                    <span>Who is playing</span>
                    <button class="mf-band" data-band="in">whole band in</button>
                </div>
                <div class="mf-who-rows">
                    ${(() => {
                        const inherited = this._inheritedStates(musicians, t);
                        return musicians.map(n => this._musicianRow(n, data, inherited[n])).join('');
                    })()}
                </div>
                <div class="mf-who-add">
                    <input type="text" class="mf-add-name" list="${listId}"
                           autocomplete="off" placeholder="add somebody">
                    <button class="mf-add">add</button>
                </div>
            </div>

            <div class="mf-more">
                <label class="mf-more-label">Rarely needed: flourishes and the like, as "key: value" lines</label>
                <textarea class="mf-yaml" spellcheck="false"
                    placeholder="instrumentChanges:&#10;  Name: tin whistle">${
                    this._escapeHtml(this._extraYaml(data))}</textarea>
            </div>

            <div class="mf-actions">
                ${existingTime !== null
                    ? '<button class="mf-delete">Delete</button>'
                    : ''}
                <button class="mf-cancel">Cancel</button>
                <button class="mf-save">${existingTime !== null ? 'Save' : 'Add marker'}</button>
            </div>
            <div class="mf-error"></div>
        `;

        this.container.querySelector('.timeline-editor').appendChild(box);
        this._formFor = existingTime;

        // Keys typed in here belong to the box. The player, Webamp and the
        // editor's own shortcuts all listen further up.
        box.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') this.closeMarkerForm();
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
                this._saveMarkerForm(t);
            }
        });

        box.querySelectorAll('.mf-part').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const on = btn.classList.contains('on');
                box.querySelectorAll('.mf-part').forEach(b => b.classList.remove('on'));
                if (!on) btn.classList.add('on');
            });
        });

        this._wireInOut(box);
        this._wireRename(box);

        /*
         * Adding somebody by hand.
         *
         * Nine of the eleven 4masks tracks have no ensemble recorded, so
         * this block had nobody in it and no way to put anybody in it --
         * only a note saying they would turn up eventually. Skyler,
         * 2026-10-25: he wanted to type them all in. So: type a name,
         * press add, and they get a row like everyone else.
         */
        const addRow = () => {
            const input = box.querySelector('.mf-add-name');
            const name = input.value.trim();
            if (!name) return;
            const rows = box.querySelector('.mf-who-rows');
            const already = rows.querySelector(`.mf-inout[data-musician="${CSS.escape(name)}"]`);
            if (!already) {
                rows.insertAdjacentHTML('beforeend', this._musicianRow(
                    name, {}, this._inheritedStates([name], t)[name]));
                this._wireInOut(rows);
                this._wireRename(rows);
            }
            this._rememberMusician(name);
            input.value = '';
            input.focus();
        };

        box.querySelector('.mf-add').addEventListener('click', (e) => {
            e.preventDefault();
            addRow();
        });
        box.querySelector('.mf-add-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                addRow();
            }
        });

        const band = box.querySelector('.mf-band');
        if (band) {
            band.addEventListener('click', (e) => {
                e.preventDefault();
                band.classList.toggle('on');
            });
            if ((data.musicians || {}).band === 'in') band.classList.add('on');
        }

        box.querySelector('.mf-close').addEventListener('click', () => this.closeMarkerForm());
        box.querySelector('.mf-cancel').addEventListener('click', () => this.closeMarkerForm());
        box.querySelector('.mf-save').addEventListener('click', () => this._saveMarkerForm(t));
        const del = box.querySelector('.mf-delete');
        if (del) {
            del.addEventListener('click', () => {
                this.data.deleteMarker(existingTime);
                this._notifyTimelineChange();
                this.closeMarkerForm();
                this.render();
            });
        }

        const solo = box.querySelector('.mf-solo');
        if (solo) solo.focus();
    }


    /**
     * One musician, with in / out / leave-alone.
     *
     * A marker only says what *changes* at that moment -- somebody coming
     * in or dropping out. Most markers change nobody, so the third state
     * is the usual one and has to be the default.
     */

    /**
     * What this marker already switches its soloist onto, if anything.
     *
     * instrumentChanges is a map of person to instrument, and the common
     * case by far is one entry, for whoever is taking the solo -- Justin
     * putting down the guitar and picking up the whistle. The field shows
     * that one; anyone else's change stays in the field below, untouched.
     */

    /**
     * in / out / leave-alone, for however many rows are there now.
     */

    /**
     * Keep a name once somebody has typed it.
     *
     * Skyler, 2026-10-26: he was retyping the same five players at every
     * marker. They were only remembered if a saved marker happened to
     * mention them -- so anyone left on "leave alone" was forgotten the
     * moment the box closed, which is most of the band most of the time.
     *
     * Names now go into the track's ensemble, which is the right home for
     * them: it is what the cards are built from, it travels with the
     * timeline when the YAML is copied out, and it is what an ensemble
     * means -- the people on this recording, as against who is playing at
     * this instant, which is what a marker says.
     */
    _rememberMusician(name, instrument) {
        if (!name) return;
        const clean = name.trim();
        if (!clean) return;

        if (!this.data.workingData.ensemble) this.data.workingData.ensemble = {};
        const band = this.data.workingData.ensemble;

        if (!band[clean]) band[clean] = [];
        if (instrument && !band[clean].includes(instrument)) {
            band[clean].push(instrument);
        }
    }


    /**
     * Click a name in "Who is playing" to correct it.
     *
     * Skyler, 2026-10-26: there was no way to edit a name once typed -- which
     * is why "harry clark" went uncorrected. A name was only ever added, never
     * changed. Renaming rewrites every place the person appears: the ensemble,
     * every musicians block, solos, pickups and instrument changes. The open
     * box keeps whatever you had picked.
     */
    _wireRename(scope) {
        scope.querySelectorAll('.mf-who-name').forEach(span => {
            if (span._renamer) return;
            span._renamer = true;
            span.addEventListener('click', () => {
                const row = span.closest('.mf-who-row');
                if (!row || row.querySelector('.mf-rename')) return;
                const oldName = span.textContent;

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'mf-rename';
                input.value = oldName;
                span.style.display = 'none';
                span.after(input);
                input.focus();
                input.select();

                let done = false;
                const finish = (commit) => {
                    if (done) return;
                    done = true;
                    const next = input.value.trim();
                    input.remove();
                    span.style.display = '';
                    if (commit && next && next !== oldName) this._applyRename(oldName, next, row);
                };

                input.addEventListener('keydown', (e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
                    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
                });
                input.addEventListener('blur', () => finish(true));
            });
        });
    }

    _applyRename(oldName, newName, row) {
        const box = this.container.querySelector('.marker-form');

        this.data._saveUndoState();
        const result = renameMusician(
            this.data.workingData.timeline, this.data.workingData.ensemble, oldName, newName);
        this.data.workingData.timeline = result.timeline;
        this.data.workingData.ensemble = result.ensemble;
        this.data._notifyChange();
        this._notifyTimelineChange();

        // The box is not rebuilt, so what has been picked in it survives.
        const existing = box && [...box.querySelectorAll('.mf-who-row')].find(
            r => r !== row && r.querySelector('.mf-who-name').textContent === newName);
        if (existing) {
            // Renamed onto somebody already in the box: they are one person now.
            row.remove();
        } else if (row) {
            row.querySelector('.mf-who-name').textContent = newName;
            row.querySelectorAll('.mf-inout').forEach(b => { b.dataset.musician = newName; });
        }
        if (box) {
            ['.mf-solo', '.mf-pickup'].forEach(sel => {
                const f = box.querySelector(sel);
                if (f && f.value === oldName) f.value = newName;
            });
        }

        const note = box && box.querySelector('.mf-error');
        if (note) {
            note.style.color = '#4a7c59';
            note.textContent = `Renamed "${oldName}" to "${newName}" in ${result.changed} place${result.changed === 1 ? '' : 's'}.`;
        }
    }

    _wireInOut(scope) {
        scope.querySelectorAll('.mf-inout').forEach(btn => {
            if (btn._wired) return;
            btn._wired = true;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const name = btn.dataset.musician;
                const box = this.container.querySelector('.marker-form');
                box.querySelectorAll(`.mf-inout[data-musician="${CSS.escape(name)}"]`)
                   .forEach(b => b.classList.remove('on'));
                btn.classList.add('on');
            });
        });
    }


    /**
     * Collapse the timeline to what changes. Undoable, and it says what it did.
     *
     * Justin, 2026-10-26: the YAML should be interesting enough that
     * somebody reads it and says "that second B part doesn't have fiddle" --
     * and quick to find the line to fix. A block repeated seventeen times
     * is neither. This is a button rather than something that happens on
     * its own, because it rewrites markers that somebody may have written
     * by hand, and that should be a decision.
     */
    tidyMusicians() {
        const names = this.data.getMusicianNames();
        const result = compactMusicians(this.data.workingData.timeline, names);

        const note = this.container.querySelector('.tidy-note')
            || (() => {
                const el = document.createElement('div');
                el.className = 'tidy-note';
                this.container.querySelector('.editor-header').appendChild(el);
                return el;
            })();

        const stray = unmatchedNames(this.data.workingData.timeline, names);
        const strayText = stray.length
            ? ' Check these names -- they match nobody on the ensemble, so the cards '
              + 'will not light for them: '
              + stray.map(s => `"${s.name}"`
                  + (s.suggestion ? ` (did you mean "${s.suggestion}"?)` : '')).join(', ') + '.'
            : '';

        if (result.skipped) {
            note.textContent = 'Left alone: this timeline uses section keys, which are worked out by the player.' + strayText;
            return;
        }
        if (!result.removed && !result.rewritten) {
            note.textContent = 'Already says only what changes.' + strayText;
            if (strayText) note.style.color = '#b05a3c';
            return;
        }

        this.data._saveUndoState();
        this.data.workingData.timeline = result.timeline;
        this.data._notifyChange();
        this._notifyTimelineChange();
        this.render();

        const after = this.container.querySelector('.editor-header');
        const msg = document.createElement('div');
        msg.className = 'tidy-note';
        msg.textContent = `Tidied: ${result.removed} repeated block${result.removed === 1 ? '' : 's'} removed, `
            + `${result.rewritten} shortened. Undo puts it back.` + strayText;
        if (strayText) msg.style.color = '#b05a3c';
        if (after) after.appendChild(msg);
    }


    /** A short message with one action, in the editor header. */
    _flash(text, actionLabel, action) {
        const header = this.container.querySelector('.editor-header');
        if (!header) return;
        header.querySelectorAll('.editor-flash').forEach(e => e.remove());
        const el = document.createElement('div');
        el.className = 'editor-flash';
        el.textContent = text + ' ';
        if (actionLabel) {
            const b = document.createElement('button');
            b.textContent = actionLabel;
            b.addEventListener('click', () => { el.remove(); action(); });
            el.appendChild(b);
        }
        header.appendChild(el);
        setTimeout(() => el.remove(), 8000);
    }

    _soloInstrument(data) {
        const changes = data.instrumentChanges || {};
        if (data.solo && changes[data.solo]) return changes[data.solo];
        return '';
    }

    _musicianRow(name, data, inherited) {
        const state = (data.musicians || {})[name];
        const btn = (value, label, title) => `<button class="mf-inout${
            state === value ? ' on' : ''}${!state && value === '' ? ' on' : ''}"
            data-musician="${this._escapeHtml(name)}" data-value="${value}"
            ${title ? `title="${title}"` : ''}>${label}</button>`;

        /*
         * Say what this person already is.
         *
         * Skyler's Victory came out as seventeen copies of the same six
         * names because the box gave no sign who was already in -- so
         * everyone was clicked "in" again at every marker, to be safe.
         * "—" now reads "stays in" or "stays out", which is what it means,
         * and it is the right choice for almost everyone almost every time.
         */
        const stays = inherited ? `stays ${inherited}` : '—';
        const cls = inherited ? ` is-${inherited}` : '';
        return `<div class="mf-who-row${cls}">
            <span class="mf-who-name" title="Click to correct the spelling">${this._escapeHtml(name)}</span>
            ${btn('in', 'in', 'Joins here')}${btn('out', 'out', 'Drops out here')}${
                btn('', stays, 'No change at this moment')}
        </div>`;
    }

    /** What each person already is, going into a marker at `time`. */
    _inheritedStates(names, time) {
        const entries = musicianEntries(this.data.workingData.timeline);
        const states = {};
        names.forEach(n => { states[n] = statusAt(entries, n, time, { exclusive: true }); });
        return states;
    }

    closeMarkerForm() {
        const old = this.container.querySelector('.marker-form');
        if (old) old.remove();
        this._formFor = undefined;
    }

    /**
     * The keys the form has no field for, as YAML, so nothing is lost by
     * opening a marker in the form and saving it again.
     */
    _extraYaml(data) {
        const rest = {};
        Object.keys(data).forEach(k => {
            if (!['solo', 'pickup', 'part', 'musicians'].includes(k)) rest[k] = data[k];
        });

        // The soloist's own instrument change has its own field; showing it
        // here as well would mean editing it in two places.
        if (rest.instrumentChanges && data.solo && rest.instrumentChanges[data.solo]) {
            const others = { ...rest.instrumentChanges };
            delete others[data.solo];
            if (Object.keys(others).length) rest.instrumentChanges = others;
            else delete rest.instrumentChanges;
        }
        return Object.keys(rest).length
            ? jsYaml.dump(rest, { indent: 2, lineWidth: -1 }).trim()
            : '';
    }

    _saveMarkerForm(fallbackTime) {
        const box = this.container.querySelector('.marker-form');
        if (!box) return;
        const errorDiv = box.querySelector('.mf-error');

        const typed = this.parseTime(box.querySelector('.mf-time').value);
        const time = Math.round((typed === null ? fallbackTime : typed) * 10) / 10;

        let marker = {};
        try {
            const extra = box.querySelector('.mf-yaml').value.trim();
            if (extra) {
                const parsed = jsYaml.load(extra);
                if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                    throw new Error('the bottom field takes "key: value" lines');
                }
                marker = { ...parsed };
            }
        } catch (err) {
            // The fields above cover everything most markers need, so a
            // fault down here is usually somebody writing prose into the
            // escape hatch. Say which field and what it wants.
            errorDiv.textContent = 'The bottom field needs "key: value" lines, '
                + 'or nothing at all — use the rows above for people. ('
                + err.message + ')';
            return;
        }

        /*
         * Store the difference, not the picture.
         *
         * Choosing "in" for somebody who is already in says nothing the
         * timeline did not know, and writing it down is what turned one
         * band into seventeen identical blocks. A choice is kept only if
         * it changes the person from what they inherit.
         */
        const inheritedNow = this._inheritedStates(
            [...box.querySelectorAll('.mf-inout')].map(b => b.dataset.musician), time);
        const who = {};
        box.querySelectorAll('.mf-inout.on').forEach(btn => {
            const name = btn.dataset.musician;
            const value = btn.dataset.value;
            if (value && value !== inheritedNow[name]) who[name] = value;
        });
        const bandBtn = box.querySelector('.mf-band');
        if (bandBtn && bandBtn.classList.contains('on')) {
            const alreadyAllIn = Object.values(inheritedNow).length
                && Object.values(inheritedNow).every(v => v === 'in');
            if (!alreadyAllIn) {
                // band first, then anyone who is not coming in with it
                const withBand = { band: 'in' };
                Object.keys(inheritedNow).forEach(n => {
                    const picked = box.querySelector(
                        `.mf-inout.on[data-musician="${CSS.escape(n)}"]`);
                    if (picked && picked.dataset.value === 'out') withBand[n] = 'out';
                });
                Object.keys(who).forEach(k => delete who[k]);
                Object.assign(who, withBand);
            }
        }
        if (Object.keys(who).length) {
            marker.musicians = who;
        } else {
            delete marker.musicians;
        }

        const soloName = box.querySelector('.mf-solo').value.trim();
        const instrument = box.querySelector('.mf-instrument').value.trim();
        if (instrument && soloName) {
            marker.instrumentChanges = { ...(marker.instrumentChanges || {}), [soloName]: instrument };
            this._rememberMusician(soloName, instrument);
        } else if (marker.instrumentChanges && soloName) {
            // Cleared on purpose: take this person's change out, leave the rest.
            delete marker.instrumentChanges[soloName];
            if (!Object.keys(marker.instrumentChanges).length) delete marker.instrumentChanges;
        }

        const part = box.querySelector('.mf-part.on');
        if (part) marker.part = part.dataset.part;
        if (soloName) {
            marker.solo = soloName;
            this._rememberMusician(soloName);
        }
        const pickup = box.querySelector('.mf-pickup').value.trim();
        if (pickup) {
            marker.pickup = pickup;
            this._rememberMusician(pickup);
        }

        this.data._saveUndoState();

        // Moving an existing marker means taking it out of its old slot.
        if (this._formFor !== null && this._formFor !== undefined) {
            delete this.data.workingData.timeline[String(this._formFor)];
        }

        this.data.workingData.timeline[String(time)] = marker;
        this.data._notifyChange();
        this._notifyTimelineChange();
        this.data.selectedMarkerTime = time;
        this.closeMarkerForm();
        this.render();
    }


    renderMarkerRow(entry, index, musicians) {
        const { time, data } = entry;
        const isSelected = this.data.selectedMarkerTime === time;
        const isPlaying = this._isMarkerPlaying(time);
        const isExpanded = this.expandedMarkerTime === time;

        // Build marker info string (compact summary)
        let info = [];
        if (data.solo) info.push(`solo: ${data.solo}`);
        if (data.pickup) info.push(`pickup: ${data.pickup}`);
        if (data.part) info.push(`part: ${data.part}`);
        // Show other keys briefly
        const otherKeys = Object.keys(data).filter(k => !['solo', 'pickup', 'part'].includes(k));
        if (otherKeys.length > 0) info.push(`+${otherKeys.length} more`);

        const infoStr = info.join(' | ') || '(empty)';

        /*
         * Convert the marker to YAML for editing -- and when it is empty,
         * hand over the scaffold rather than a grey hint.
         *
         * Placeholder text disappears the moment you type, so a new marker
         * meant retyping "solo:" and "part:" every time, from memory, with
         * the one example you had just lost. Skyler, 2026-10-25: the keys
         * should stay and not be greyed out. Real text, so the shape is
         * there to fill in and the keys cannot be misremembered.
         */
        const yamlStr = Object.keys(data).length > 0
            ? jsYaml.dump(data, { indent: 2, lineWidth: -1 }).trim()
            : TimelineEditor.NEW_MARKER_TEMPLATE;

        return `
            <div class="marker-row ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''} ${isExpanded ? 'expanded' : ''}"
                 data-time="${time}"
                 data-index="${index}">

                <div class="marker-header">
                    <div class="marker-time-section">
                        <button class="btn-play-from" data-time="${time}" title="Play from this marker">
                            ▶
                        </button>
                        <input type="text"
                               class="marker-time-input"
                               value="${this.formatTime(time)}"
                               data-time="${time}"
                               title="Click to edit, arrow keys to fine-tune"
                               readonly>
                    </div>

                    <div class="marker-info" data-time="${time}">
                        ${infoStr}
                    </div>

                    <div class="marker-actions">
                        <button class="btn-toggle-yaml" data-time="${time}" title="Edit this marker">
                            ✎
                        </button>
                        <button class="btn-delete-marker" data-time="${time}" title="Delete this marker">
                            ✕
                        </button>
                    </div>
                </div>

            </div>
        `;
    }

    /**
     * Escape HTML entities
     */
    _escapeHtml(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;');
    }

    /**
     * Attach event listeners to the rendered UI
     */
    _attachEventListeners() {
        // Add marker button
        const addBtn = this.container.querySelector('.btn-add-marker');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addMarkerAtCurrentTime());

        const tidyBtn = this.container.querySelector('.btn-tidy');
        if (tidyBtn) {
            tidyBtn.addEventListener('click', () => this.tidyMusicians());
        }
        }

        // Play from marker buttons
        this.container.querySelectorAll('.btn-play-from').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const time = parseFloat(btn.dataset.time);
                this.seekAndPlay(time);
            });
        });

        // Click on marker row to select/seek
        this.container.querySelectorAll('.marker-row').forEach(row => {
            row.addEventListener('click', (e) => {
                /*
                 * A click anywhere in the row selects the marker and seeks
                 * there, and then re-renders -- which throws away the DOM,
                 * and with it whatever you were typing into and where your
                 * caret was. The open YAML editor is inside the row, so
                 * clicking into it to correct a name counted as a click on
                 * the row: you were bounced back out before you could type
                 * a character. Skyler, 2026-10-25.
                 *
                 * closest(), not classList, because the click lands on
                 * whatever is under the pointer -- the text inside a button
                 * as readily as the button.
                 */
                if (e.target.closest('.marker-yaml-editor') ||
                    e.target.closest('button') ||
                    e.target.classList.contains('marker-time-input')) {
                    return;
                }
                const time = parseFloat(row.dataset.time);
                this.data.selectedMarkerTime = time;
                this.seekTo(time);
                this.render();
            });
        });

        // Time input click to enable editing
        this.container.querySelectorAll('.marker-time-input').forEach(input => {
            input.addEventListener('click', (e) => {
                e.stopPropagation();
                this._startEditingTime(input);
            });

            input.addEventListener('keydown', (e) => {
                this._handleTimeInputKeydown(e, input);
            });

            input.addEventListener('blur', (e) => {
                this._finishEditingTime(input);
            });
        });

        // Delete marker buttons
        this.container.querySelectorAll('.btn-delete-marker').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const time = parseFloat(btn.dataset.time);
                /*
                 * No confirmation box.
                 *
                 * A native confirm() freezes the page while it is open, which
                 * is the pause Justin heard in the song, and it asks a
                 * question nobody needs: the delete is undoable. Delete at
                 * once, say so, and offer the way back.
                 */
                this.data.deleteMarker(time);
                this._notifyTimelineChange();
                this._flash(`Deleted the marker at ${this.formatTime(time)}.`, 'Undo', () => {
                    this.data.undo();
                    this._notifyTimelineChange();
                });
            });
        });

        // Toggle YAML editor buttons
        /*
         * One way to edit a marker, not two.
         *
         * This used to open a raw YAML box inside the row, which is where
         * Skyler met "bad indentation of a mapping entry" after reasonably
         * typing "musicians: Justin Holmes, Gaven Largent". The form knows
         * the shape; the row should open the form.
         */
        this.container.querySelectorAll('.btn-toggle-yaml').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const time = parseFloat(btn.dataset.time);
                this.data.selectedMarkerTime = time;
                this.openMarkerForm(time, time);
            });
        });

        // YAML textareas - handle Ctrl+Enter to apply
        this.container.querySelectorAll('.yaml-input').forEach(textarea => {
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    const time = parseFloat(textarea.dataset.time);
                    this._applyYaml(time, textarea.value);
                }
                // Prevent keyboard shortcuts while editing YAML
                e.stopPropagation();
            });

            // Clear error on input
            textarea.addEventListener('input', () => {
                const time = parseFloat(textarea.dataset.time);
                const errorDiv = this.container.querySelector(`.yaml-error[data-time="${time}"]`);
                if (errorDiv) errorDiv.textContent = '';
            });
        });

        // Apply YAML buttons
        this.container.querySelectorAll('.btn-apply-yaml').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const time = parseFloat(btn.dataset.time);
                const textarea = this.container.querySelector(`.yaml-input[data-time="${time}"]`);
                if (textarea) {
                    this._applyYaml(time, textarea.value);
                }
            });
        });

        // Undo/Redo/Revert buttons
        const undoBtn = this.container.querySelector('.btn-undo');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                this.data.undo();
                this._notifyTimelineChange();
            });
        }

        const redoBtn = this.container.querySelector('.btn-redo');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                this.data.redo();
                this._notifyTimelineChange();
            });
        }

        const revertBtn = this.container.querySelector('.btn-revert');
        if (revertBtn) {
            revertBtn.addEventListener('click', () => {
                if (confirm('Revert all changes to original data?')) {
                    this.data.revert();
                    this._notifyTimelineChange();
                }
            });
        }
    }

    /**
     * Start editing a time input
     */
    _startEditingTime(input) {
        input.readOnly = false;
        input.select();
        this.editingMarkerTime = parseFloat(input.dataset.time);
    }

    /**
     * Handle keydown in time input
     */
    _handleTimeInputKeydown(e, input) {
        const time = parseFloat(input.dataset.time);

        if (e.key === 'Escape') {
            input.value = this.formatTime(time);
            input.readOnly = true;
            input.blur();
            return;
        }

        if (e.key === 'Enter') {
            this._finishEditingTime(input);
            input.blur();
            return;
        }

        // Arrow key fine-tuning
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const delta = e.shiftKey ? 1 : 0.1; // 1s with shift, 0.1s without
            const direction = e.key === 'ArrowUp' ? 1 : -1;
            const newTime = Math.max(0, time + (delta * direction));

            // Update the marker time
            this.data.updateMarkerTime(time, newTime);
            input.dataset.time = newTime;
            input.value = this.formatTime(newTime);
            this._notifyTimelineChange();
        }
    }

    /**
     * Finish editing a time input
     */
    _finishEditingTime(input) {
        const oldTime = parseFloat(input.dataset.time);
        const newTime = this.parseTime(input.value);

        input.readOnly = true;
        this.editingMarkerTime = null;

        if (newTime === null || newTime === oldTime) {
            input.value = this.formatTime(oldTime);
            return;
        }

        this.data.updateMarkerTime(oldTime, newTime);
        this._notifyTimelineChange();
    }

    /**
     * Check if a marker is currently "playing" (within its time range)
     */
    _isMarkerPlaying(markerTime) {
        const entries = this.data.getTimelineEntries();
        const index = entries.findIndex(e => e.time === markerTime);

        if (index === -1) return false;

        const nextTime = entries[index + 1]?.time ?? Infinity;
        return this.currentPlayingTime >= markerTime && this.currentPlayingTime < nextTime;
    }

    /**
     * Highlight the currently playing marker
     */
    _highlightCurrentMarker() {
        this.container.querySelectorAll('.marker-row').forEach(row => {
            const time = parseFloat(row.dataset.time);
            row.classList.toggle('playing', this._isMarkerPlaying(time));
        });
    }

    /**
     * Add a new marker at the current playback time
     */
    addMarkerAtCurrentTime() {
        this.addMarkerAt(this.currentPlayingTime || 0);
    }

    /**
     * Put a marker at a given time and open it for filling in.
     *
     * Two markers cannot share a time -- the second would replace the
     * first, which from a stopped player is every press after the first.
     * Step forward by a tenth until the slot is free, which is below the
     * resolution of anything you could hear.
     */
    addMarkerAt(seconds) {
        let time = Math.round((seconds || 0) * 10) / 10;

        while (this.data.timeline && this.data.timeline[String(time)] !== undefined) {
            time = Math.round((time + 0.1) * 10) / 10;
        }

        this.data.addMarker(time, {});
        this._notifyTimelineChange();

        // Open it straight away: a marker with no solo and no part is not
        // yet anything, and the next thing you want is to say what it is.
        this.expandedMarkerTime = time;
        this.data.selectedMarkerTime = time;
        this.render();

        setTimeout(() => {
            const textarea = this.container.querySelector(`.yaml-input[data-time="${time}"]`);
            if (textarea) {
                textarea.focus();
                // Caret after "solo: ", which is the first thing to fill in.
                const at = textarea.value.indexOf('\n');
                textarea.setSelectionRange(at === -1 ? 0 : at, at === -1 ? 0 : at);
            }
        }, 50);

        return time;
    }

    /**
     * Apply YAML content to a marker
     */
    _applyYaml(time, yamlStr) {
        const errorDiv = this.container.querySelector(`.yaml-error[data-time="${time}"]`);

        try {
            // Parse YAML
            const parsed = yamlStr.trim() ? jsYaml.load(yamlStr) : {};

            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error('YAML must be an object (key: value pairs)');
            }

            // Replace marker data entirely with parsed YAML
            // First, save undo state
            this.data._saveUndoState();

            /*
             * Drop keys the scaffold left blank. A new marker arrives as
             * "solo: " and "part: " for somebody to fill in; applying it
             * with one of them still empty should leave that key out
             * rather than write an empty string the player would have to
             * interpret.
             */
            Object.keys(parsed).forEach(k => {
                const v = parsed[k];
                if (v === null || v === undefined || v === '') delete parsed[k];
            });

            // Replace the marker data
            const key = String(Math.round(time * 10) / 10);
            this.data.workingData.timeline[key] = parsed;

            // Notify changes
            this.data._notifyChange();
            this._notifyTimelineChange();

            // Clear error, keep expanded to show success
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.color = '#4a7c59';
                errorDiv.textContent = 'Applied!';
                setTimeout(() => {
                    if (errorDiv) errorDiv.textContent = '';
                }, 1500);
            }

        } catch (e) {
            if (errorDiv) {
                errorDiv.style.color = '#c00';
                errorDiv.textContent = `YAML error: ${e.message}`;
            }
        }
    }

    /**
     * Seek to a specific time
     */
    seekTo(time) {
        if (!this.player || !this.player.webamp) {
            return;
        }

        /*
         * Seek by time, not by percentage.
         *
         * This used to work out a percentage from state.media.length, which
         * is 0 until the audio has loaded its metadata -- so the fallback
         * duration was used instead, and when that did not match the real
         * length the seek landed somewhere else entirely, usually back at
         * the start. Skyler, 2026-10-25: the play button beside a section
         * put him at the beginning of the song.
         *
         * seekToTime is what the part blocks in the bar have always used,
         * which is why clicking those works and this did not. Same nudge
         * past the boundary, for the same reason: landing exactly on a
         * part's start time lands on the frame before the arrangement
         * changes, often enough to look like nothing happened.
         */
        if (typeof this.player.webamp.seekToTime === 'function') {
            this.player.webamp.seekToTime(Math.max(0, time + 0.05));
            return;
        }

        if (this.player.webamp.store) {
            const state = this.player.webamp.store.getState();
            const duration = state.media.length || this.data.workingData.duration || 180;
            this.player.webamp.store.dispatch({
                type: 'SEEK_TO_PERCENT_COMPLETE',
                percent: Math.min(100, Math.max(0, (time / duration) * 100))
            });
        }
    }

    /**
     * Seek to a time and start playing
     */
    seekAndPlay(time) {
        if (!this.player || !this.player.webamp) {
            return;
        }

        const webamp = this.player.webamp;

        /*
         * Start it, then seek -- and keep asking until it lands.
         *
         * Audio that has not loaded cannot be seeked, so pressing a
         * marker's play button from a standing start used to seek into
         * nothing and then begin at the top of the song. Skyler,
         * 2026-10-25. The part blocks in the bar never showed this because
         * by the time you click one, something is already playing.
         *
         * There is no reliable "is it loaded" flag to wait on here --
         * state.media.length is not populated the way the old percentage
         * seek assumed, which is the other half of why that seek missed.
         * So: ask repeatedly for a couple of seconds, and stop as soon as
         * the playhead is where it was asked to be. seekToTime is
         * idempotent, so asking twice costs nothing.
         */
        if (webamp.store) {
            webamp.store.dispatch({ type: 'PLAY' });
        }

        const target = Math.max(0, time + 0.05);
        const landed = () => Math.abs(this.player.getCurrentTime() - target) < 2;

        const trySeek = () => {
            if (typeof webamp.seekToTime === 'function') {
                webamp.seekToTime(target);
            }
        };

        trySeek();

        clearInterval(this._seekWhenReady);
        const until = Date.now() + 2500;
        this._seekWhenReady = setInterval(() => {
            if (landed() || Date.now() > until) {
                clearInterval(this._seekWhenReady);
                return;
            }
            trySeek();
        }, 200);
    }

    /**
     * Called when playback time updates
     */
    _onTimeUpdate(currentTime, arrangement) {
        this.currentPlayingTime = currentTime;

        // Update time display in raw mode without full re-render
        if (this.rawMode) {
            const timeDisplay = this.container.querySelector('.current-time-display');
            if (timeDisplay) {
                timeDisplay.textContent = `Current: ${this.formatTime(currentTime)}`;
            }
        } else {
            this._highlightCurrentMarker();

            // The Add Marker button names the moment it will use, so that
            // where a new marker lands is visible before you press it
            // rather than a surprise afterwards. Skyler, 2026-10-25.
            const addLabel = this.container.querySelector('.add-marker-time');
            if (addLabel) {
                addLabel.textContent = this.formatTime(currentTime);
            }

            // Move the playhead down the ruler without rebuilding anything:
            // a re-render here would throw away whatever is being typed.
            const track = this.container.querySelector('.ruler-track');
            const head = this.container.querySelector('.ruler-playhead');
            if (track && head) {
                const tag = head.querySelector('.ruler-playhead-tag b');
                if (tag) tag.textContent = this.formatTime(currentTime).replace(/\.\d$/, '');
                let duration = parseFloat(track.dataset.duration) || 0;

                // The real length arrives when the audio loads, which is
                // after the editor opens. Redraw once, when it does.
                const real = this.player && this.player.getDuration ? this.player.getDuration() : 0;
                if (real > 0 && Math.abs(real - duration) > 1) {
                    this.render();
                    return;
                }

                if (duration > 0) {
                    head.style.top = `${Math.max(0, Math.min(100, (currentTime / duration) * 100))}%`;
                }

                // Zoomed in, the ruler scrolls to keep the rabbit in view --
                // unless you scrolled it yourself in the last few seconds.
                const ruler = this.container.querySelector('.timeline-ruler');
                if (ruler && this._zoom() > 1 && duration > 0 &&
                    performance.now() - (this._userScrolledAt || 0) > 3000) {
                    const y = track.offsetTop + (currentTime / duration) * track.offsetHeight;
                    const view = ruler.clientHeight;
                    if (y < ruler.scrollTop + 40 || y > ruler.scrollTop + view - 40) {
                        ruler.scrollTop = Math.max(0, y - view / 3);
                        this._rulerScroll = ruler.scrollTop;
                    }
                }

                // The rabbit hops while the song moves and sits still when
                // it doesn't; a jump (a seek) doesn't count as running.
                // Ticks come faster than the clock moves, and stop when it
                // pauses, so it stops running once time has held still.
                const step = currentTime - (this._lastHeadTime ?? currentTime);
                if (step > 0 && step < 1) {
                    head.classList.add('running');
                    clearTimeout(this._rabbitRest);
                    this._rabbitRest = setTimeout(() => {
                        const h = this.container.querySelector('.ruler-playhead');
                        if (h) h.classList.remove('running');
                    }, 700);
                }
                this._lastHeadTime = currentTime;
            }
        }
    }

    /**
     * Called when data changes
     */
    _onDataChange(timeline) {
        // Undo can change who plays what; the cards read the player's copy.
        if (this.player && this.player.trackData && this.data.workingData.ensemble &&
            JSON.stringify(this.player.trackData.ensemble) !== JSON.stringify(this.data.workingData.ensemble)) {
            this.player.trackData.ensemble = JSON.parse(JSON.stringify(this.data.workingData.ensemble));
            if (this.player.updateEnsembleDisplay) this.player.updateEnsembleDisplay(this.currentPlayingTime || 0);
        }
        this.render();
    }

    /**
     * Notify the player of timeline changes (for instant preview)
     */
    _notifyTimelineChange() {
        if (this.player && this.player.updateTimeline) {
            this.player.updateTimeline(this.data.timeline);
        }
    }

    /**
     * Clean up
     */
    dispose() {
        clearInterval(this._seekWhenReady);
        // The scrub listens on the window, so that a drag that leaves the
        // ruler still tracks; it has to be taken off again by hand.
        if (this._rulerMove) window.removeEventListener('mousemove', this._rulerMove);
        if (this._rulerUp) window.removeEventListener('mouseup', this._rulerUp);
        this._rulerMove = null;
        this._rulerUp = null;
        this.data.onChange = null;
        if (this.player) {
            this.player._timeUpdateCallback = null;
        }
    }
}

/**
 * Normalize a parsed YAML doc into the flat shape the editor uses.
 * Accepts the editor's own flat shape OR an arthel song YAML
 * (studio_versions.<n>.<AlbumName>.{ensemble, rabbithole.timeline, ...}).
 */
function _normalizeMetadata(data) {
    if (!data || typeof data !== 'object') return {};
    if (data.timeline || data.ensemble) {
        return {
            ensemble: data.ensemble,
            timeline: data.timeline,
            standardSectionLength: data.standardSectionLength,
            title: data.title
        };
    }
    const studioVersions = data.studio_versions;
    if (studioVersions && typeof studioVersions === 'object') {
        const firstVersion = studioVersions[Object.keys(studioVersions)[0]];
        if (firstVersion && typeof firstVersion === 'object') {
            const firstReleaseKey = Object.keys(firstVersion)[0];
            const release = firstVersion[firstReleaseKey];
            if (release && typeof release === 'object') {
                const rh = release.rabbithole || {};
                return {
                    ensemble: release.ensemble,
                    timeline: rh.timeline,
                    standardSectionLength: rh.standardSectionLength,
                    title: firstReleaseKey
                };
            }
        }
    }
    return {};
}

export default TimelineEditor;
