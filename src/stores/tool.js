import { defineStore } from 'pinia'

export const TOOLS = {
  NONE: 'none', // reading mode — pointer events pass through to text
  HIGHLIGHTER: 'highlighter',
  PEN: 'pen',
  UNDERLINE: 'underline',
  SHAPE: 'shape',
  NOTE: 'note',
  ERASER: 'eraser'
}

export const STROKE_WIDTHS = {
  fine: 1.5,
  medium: 3,
  thick: 5,
  brush: 9
}

export const PRESET_COLOURS = [
  { name: 'Blue', hex: '#3B6FE0' },
  { name: 'Red', hex: '#D6432F' },
  { name: 'Green', hex: '#3E8E5B' },
  { name: 'Orange', hex: '#D98A2B' },
  { name: 'Purple', hex: '#7B5FBF' },
  { name: 'Yellow', hex: '#E0B62E' },
  { name: 'Pink', hex: '#D6608C' },
  { name: 'Black', hex: '#1F2430' }
]

/**
 * Drives the floating annotation toolbar (PRD §5.2). Tracks the active
 * tool plus per-tool-type "last used colour" memory (PRD §5.2.1).
 */
export const useToolStore = defineStore('tool', {
  state: () => ({
    activeTool: TOOLS.NONE,
    strokeWidthKey: 'medium',
    opacity: 1,
    lastColourByTool: {
      [TOOLS.HIGHLIGHTER]: '#E0B62E',
      [TOOLS.PEN]: '#1F2430',
      [TOOLS.UNDERLINE]: '#3B6FE0',
      [TOOLS.SHAPE]: '#D6432F'
    }
  }),
  getters: {
    strokeWidth: (state) => STROKE_WIDTHS[state.strokeWidthKey] ?? STROKE_WIDTHS.medium,
    activeColour: (state) => state.lastColourByTool[state.activeTool] ?? PRESET_COLOURS[0].hex,
    canvasShouldCapturePointer: (state) => state.activeTool !== TOOLS.NONE
  },
  actions: {
    setTool(tool) {
      this.activeTool = tool
    },
    setColour(hex) {
      if (this.activeTool === TOOLS.NONE) return
      this.lastColourByTool[this.activeTool] = hex
    },
    setStrokeWidth(key) {
      this.strokeWidthKey = key
    },
    reset() {
      this.activeTool = TOOLS.NONE
    }
  },
  persist: { paths: ['strokeWidthKey', 'opacity', 'lastColourByTool'] }
})
