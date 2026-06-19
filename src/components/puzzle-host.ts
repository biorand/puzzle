import { LitElement, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { PuzzleModule, PuzzleContext } from '../types';

export class PuzzleHost extends LitElement {
  @property({ type: Object }) module: PuzzleModule | null = null;
  @property({ type: Object }) context: PuzzleContext | null = null;

  @state() private _container: HTMLElement | null = null;
  private _destroyFn: (() => void) | null = null;

  createRenderRoot() {
    return this;
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('module') || changedProperties.has('context')) {
      this._mountPuzzle();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._destroyPuzzle();
  }

  private _destroyPuzzle(): void {
    if (this._destroyFn) {
      this._destroyFn();
      this._destroyFn = null;
    }
  }

  private _mountPuzzle(): void {
    this._destroyPuzzle();
    if (this.module && this.context && this._container) {
      this._container.innerHTML = '';
      const result = this.module.create(this._container, this.context);
      this._destroyFn = result.destroy;
    }
  }

  firstUpdated(): void {
    this._container = this.renderRoot.querySelector('#puzzle-container');
    this._mountPuzzle();
  }

  render() {
    return html`<div id="puzzle-container"></div>`;
  }
}

customElements.define('puzzle-host', PuzzleHost);

declare global {
  interface HTMLElementTagNameMap {
    'puzzle-host': PuzzleHost;
  }
}
