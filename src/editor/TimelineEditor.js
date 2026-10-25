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

        this.container.innerHTML = `
            <div class="timeline-editor">
                <div class="editor-header">
                    <h3>Timeline Editor</h3>
                    <div class="editor-actions">
                        <button class="btn-toggle-mode" title="Switch to raw YAML view">
                            Raw YAML
                        </button>
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
        this._attachRulerListeners();
        this._highlightCurrentMarker();
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
        const stated = this.data.workingData.duration;
        if (stated && stated > 0) return stated;
        const last = entries.length ? entries[entries.length - 1].time : 0;
        return Math.max(60, last + 30);
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

        // Ticks: every 15s under four minutes, every 30s over.
        const step = duration > 240 ? 30 : 15;
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
                <div class="ruler-track" data-duration="${duration}">
                    ${bands.join('')}
                    ${ticks.join('')}
                    ${markers}
                    <div class="ruler-playhead" style="top:${pct(this.currentPlayingTime || 0)}%"></div>
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

        const timeAt = (e) => {
            const rect = track.getBoundingClientRect();
            const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
            return Math.round((y / rect.height) * duration * 10) / 10;
        };

        track.addEventListener('mousemove', (e) => {
            const t = timeAt(e);
            const rect = track.getBoundingClientRect();
            hover.hidden = false;
            hover.style.top = `${((e.clientY - rect.top) / rect.height) * 100}%`;
            hoverTime.textContent = this.formatTime(t);
        });

        track.addEventListener('mouseleave', () => {
            hover.hidden = true;
        });

        track.addEventListener('click', (e) => {
            const marker = e.target.closest('.ruler-marker');
            if (marker) {
                const t = parseFloat(marker.dataset.time);
                this.data.selectedMarkerTime = t;
                this.seekTo(t);
                this.render();
                return;
            }
            this.seekTo(timeAt(e));
        });

        track.addEventListener('dblclick', (e) => {
            if (e.target.closest('.ruler-marker')) return;
            this.addMarkerAt(timeAt(e));
        });
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
                        <button class="btn-toggle-yaml" data-time="${time}" title="${isExpanded ? 'Collapse' : 'Edit YAML'}">
                            ${isExpanded ? '▲' : '▼'}
                        </button>
                        <button class="btn-delete-marker" data-time="${time}" title="Delete this marker">
                            ✕
                        </button>
                    </div>
                </div>

                ${isExpanded ? `
                <div class="marker-yaml-editor">
                    <textarea class="yaml-input" data-time="${time}"
                              placeholder="solo: Musician Name&#10;part: A&#10;musicians:&#10;  band: in"
                              spellcheck="false">${this._escapeHtml(yamlStr)}</textarea>
                    <div class="yaml-error" data-time="${time}"></div>
                    <div class="yaml-actions">
                        <button class="btn-apply-yaml" data-time="${time}">Apply</button>
                        <span class="yaml-hint">Edit YAML above, then Apply (or Ctrl+Enter)</span>
                    </div>
                </div>
                ` : ''}
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
                if (confirm(`Delete marker at ${this.formatTime(time)}?`)) {
                    this.data.deleteMarker(time);
                    this._notifyTimelineChange();
                }
            });
        });

        // Toggle YAML editor buttons
        this.container.querySelectorAll('.btn-toggle-yaml').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const time = parseFloat(btn.dataset.time);
                this.expandedMarkerTime = this.expandedMarkerTime === time ? null : time;
                this.render();
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
                const duration = parseFloat(track.dataset.duration) || 0;
                if (duration > 0) {
                    head.style.top = `${Math.max(0, Math.min(100, (currentTime / duration) * 100))}%`;
                }
            }
        }
    }

    /**
     * Called when data changes
     */
    _onDataChange(timeline) {
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
