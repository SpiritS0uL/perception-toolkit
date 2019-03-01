/**
 * @license
 * Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import { injectScript } from '../src/utils/inject-script.js';

declare global {
  interface Window {
    idbKeyval: {
      set(name: string, value: any): Promise<void>;
      get(name: string): Promise<{}>;
    };

    PerceptionToolkit: {
      config: {
        root?: string,
        onboarding?: boolean,
        onboardingImages?: string[],
        button?: HTMLElement,
        buttonSelector?: string,
        hintTimeout?: number
      },

      deviceSupport: {
        detectSupport(): Promise<boolean>;
      },

      loader: {
        hideLoader(): void;
        showLoader(): void;
      },

      main: {
        initialize(): void;
      }

      onboarding: {
        startOnboardingProcess(images: string[]): Promise<void>;
      }
    };
  }
}

const load = new Promise(async (resolve) => {
  const { config } = window.PerceptionToolkit;
  const { root = '' } = config;
  await injectScript(`${root}/lib/bundled/barcode-detection/loader.min.js`);

  const { showLoader } = window.PerceptionToolkit.loader;
  showLoader();

  await Promise.all([
    injectScript(`${root}/lib/bundled/barcode-detection/device-support.min.js`),
    injectScript(`${root}/lib/bundled/barcode-detection/onboarding.min.js`),
    injectScript(`${root}/third_party/idb-keyval/idb-keyval-iife.min.js`)
  ]);

  const { detectSupport } = window.PerceptionToolkit.deviceSupport;
  const supported = await detectSupport();
  resolve(supported);
});

(async function addEventListeners() {
  const supported = await load;
  if (!supported) {
    return;
  }

  const { hideLoader, showLoader } = window.PerceptionToolkit.loader;
  const { config } = window.PerceptionToolkit;

  const getStarted = config.button ? config.button :
      config.buttonSelector ? document.body.querySelector(config.buttonSelector) :
      null;

  hideLoader();

  if (!getStarted) {
    return;
  }
  getStarted.classList.add('visible');

  // When getStarted is clicked, load the experience.
  getStarted.addEventListener('click', (e) => {
    showLoader();
    getStarted.classList.remove('visible');
    initializeExperience();
  });

  // When captureclose is fired, show the button again.
  window.addEventListener('captureclose', () => {
    getStarted.classList.add('visible');
  });
})();

let loadMain: {};

/**
 * Initialize the experience.
 */
export async function initializeExperience() {
  const supported = await load;
  if (!supported) {
    return;
  }

  const { startOnboardingProcess } = window.PerceptionToolkit.onboarding;
  const { idbKeyval } = window;
  const { hideLoader } = window.PerceptionToolkit.loader;
  const { config } = window.PerceptionToolkit;
  hideLoader();

  // Recall whether the user has done onboarding before.
  const onboarded = await idbKeyval.get('onboarded');
  if (!onboarded && config && config.onboardingImages) {
    await startOnboardingProcess(config.onboardingImages);

    // Store for next time.
    await idbKeyval.set('onboarded', true);
  }

  // Load the main experience if necessary.
  if (!loadMain) {
    loadMain =
        await injectScript('/lib/bundled/barcode-detection/main.min.js');
  }

  const { initialize } = window.PerceptionToolkit.main;
  initialize();
}