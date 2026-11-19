import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// jsdom lacks these; Radix Select needs them to open
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
// cmdk (comboboxes) observes its list size
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }

afterEach(() => {
  cleanup()
})
