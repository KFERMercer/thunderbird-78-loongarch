/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from ../../../../toolkit/mozapps/extensions/content/aboutaddons.js */

const THUNDERBIRD_THEME_PREVIEWS = new Map([
  [
    "thunderbird-compact-light@mozilla.org",
    "chrome://mozapps/content/extensions/firefox-compact-light.svg",
  ],
  [
    "thunderbird-compact-dark@mozilla.org",
    "chrome://mozapps/content/extensions/firefox-compact-dark.svg",
  ],
]);

XPCOMUtils.defineLazyModuleGetters(this, {
  ExtensionData: "resource://gre/modules/Extension.jsm",
});

/* This file runs in both the outer window, which controls the categories list, search bar, etc.,
 * and the inner window which is the list of add-ons or the detail view. */
(async function() {
  if (window.location.href == "about:addons") {
    // Fix the "Search on addons.mozilla.org" placeholder text in the searchbox.
    let browser = document.getElementById("html-view-browser");
    if (!/(interactive|complete)/.test(browser.contentDocument.readyState)) {
      await new Promise(resolve =>
        browser.contentWindow.addEventListener("DOMContentLoaded", resolve, {
          once: true,
        })
      );
    }

    // Wait for custom elements and L10n.
    await new Promise(resolve =>
      browser.contentWindow.requestAnimationFrame(resolve)
    );

    let textbox = browser.contentDocument.querySelector(
      "search-addons > search-textbox"
    );
    let placeholder = textbox.getAttribute("placeholder");
    placeholder = placeholder.replace(
      "addons.mozilla.org",
      "addons.thunderbird.net"
    );
    textbox.setAttribute("placeholder", placeholder);
    return;
  }

  let contentStylesheet = document.createProcessingInstruction(
    "xml-stylesheet",
    'href="chrome://messenger/content/aboutAddonsExtra.css" type="text/css"'
  );
  document.insertBefore(contentStylesheet, document.documentElement);

  window.isCorrectlySigned = function() {
    return true;
  };

  delete window.browserBundle;
  window.browserBundle = Services.strings.createBundle(
    "chrome://messenger/locale/addons.properties"
  );

  let _getScreenshotUrlForAddon = getScreenshotUrlForAddon;
  getScreenshotUrlForAddon = function(addon) {
    if (THUNDERBIRD_THEME_PREVIEWS.has(addon.id)) {
      return THUNDERBIRD_THEME_PREVIEWS.get(addon.id);
    }
    return _getScreenshotUrlForAddon(addon);
  };

  // Override parts of the addon-card customElement to be able
  // to add a dedicated button for extension preferences.
  await customElements.whenDefined("addon-card");
  AddonCard.prototype.addOptionsButton = async function() {
    let { addon, optionsButton } = this;
    if (addon.type != "extension") {
      return;
    }

    let addonOptionsButton = this.querySelector(".extension-options-button");
    if (addon.isActive) {
      if (!addon.optionsType) {
        // Upon fresh install the manifest has not been parsed and optionsType
        // is not known, manually trigger parsing.
        let data = new ExtensionData(addon.getResourceURI());
        await data.loadManifest();
      }
      if (addon.optionsType) {
        if (!addonOptionsButton) {
          addonOptionsButton = document.createElement("button");
          addonOptionsButton.classList.add("extension-options-button");
          addonOptionsButton.setAttribute("action", "preferences");
          optionsButton.parentNode.insertBefore(
            addonOptionsButton,
            optionsButton
          );
        }
      }
    } else if (addonOptionsButton) {
      addonOptionsButton.remove();
    }
  };
  AddonCard.prototype._update = AddonCard.prototype.update;
  AddonCard.prototype.update = function() {
    this._update();
    this.addOptionsButton();
  };

  // Override parts of the addon-permission-list customElement to be able
  // to show the usage of Experiments in the permission list.
  await customElements.whenDefined("addon-permissions-list");
  AddonPermissionsList.prototype.renderExperimentOnly = function() {
    let appName = brandBundle.GetStringFromName("brandShortName");
    this.textContent = "";

    let msg = browserBundle.formatStringFromName(
      "webextPerms.description.experiment",
      [appName]
    );
    let row = document.createElement("div");
    row.classList.add("addon-detail-row", "permission-info");
    row.textContent = msg;
    this.appendChild(row);

    // Add a learn more link.
    let learnMoreRow = document.createElement("div");
    learnMoreRow.classList.add("addon-detail-row");
    let learnMoreLink = document.createElement("a", { is: "support-link" });
    learnMoreLink.setAttribute("support-page", "extension-permissions");
    learnMoreLink.textContent = browserBundle.GetStringFromName(
      "webextPerms.learnMore"
    );
    learnMoreRow.appendChild(learnMoreLink);
    this.appendChild(learnMoreRow);
  };
  // We change this function from sync to async, which does not matter.
  // It calls this.render() which is async without awaiting it anyway.
  AddonPermissionsList.prototype.setAddon = async function(addon) {
    this.addon = addon;
    let data = new ExtensionData(addon.getResourceURI());
    await data.loadManifest();
    if (data.manifest.experiment_apis) {
      this.renderExperimentOnly();
    } else {
      this.render();
    }
  };
})();
