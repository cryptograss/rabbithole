/**
 * Rabbithole Timeline Editor - Main Entry Point
 *
 * Exports all editor components for use in pages.
 */

export { WikiSync, parseRabbitholeWikitext, formatRabbitholeWikitext, getRabbitholeSubpage, trackDataToWikiFormat, wikiFormatToTrackData } from './wiki-sync.js';
export { EditableTrackData } from './EditableTrackData.js';
export { TimelineEditor } from './TimelineEditor.js';
export { KeyboardShortcuts } from './keyboard-shortcuts.js';

/**
 * Initialize the complete editor experience
 * @param {Object} options
 * @param {string} options.containerId - Editor container element ID
 * @param {Object} options.trackData - Initial track data
 * @param {Object} options.player - WebampChartifacts player instance
 * @param {string} options.recordingTitle - PickiPedia recording title
 * @param {Function} options.onSave - Callback when save is requested
 * @returns {Promise<Object>} Editor instance with all components
 */
export async function initEditor(options) {
    const {
        containerId,
        trackData,
        player,
        recordingTitle,
        onSave,
        onDirtyChange
    } = options;

    // Create editable data state
    const editableData = new EditableTrackData(trackData, {
        recordingTitle,
        onDirtyChange
    });

    // Create the editor UI
    const editor = new TimelineEditor(containerId, editableData, player);

    // Set up keyboard shortcuts
    const shortcuts = new KeyboardShortcuts(editor, editableData, {
        onSave
    });

    return {
        editableData,
        editor,
        shortcuts,
        dispose() {
            shortcuts.dispose();
            editor.dispose();
            editableData.dispose();
        }
    };
}
