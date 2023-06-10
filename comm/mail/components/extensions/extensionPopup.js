/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

var { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);
var { BrowserUtils } = ChromeUtils.import(
  "resource://gre/modules/BrowserUtils.jsm"
);
var { ExtensionParent } = ChromeUtils.import(
  "resource://gre/modules/ExtensionParent.jsm"
);

var gContextMenu;

/* globals nsContextMenu, reporterListener */

function loadRequestedUrl() {
  let browser = document.getElementById("requestFrame");
  browser.addProgressListener(reporterListener, Ci.nsIWebProgress.NOTIFY_ALL);
  browser.addEventListener("DOMTitleChanged", () => gBrowser.updateTitlebar());

  // This window does double duty. If window.arguments[0] is a string, it's
  // probably being called by browser.identity.launchWebAuthFlowInParent.

  // Otherwise, it's probably being called by browser.windows.create, with an
  // array of URLs to open in tabs. We'll only attempt to open the first,
  // which is consistent with Firefox behaviour.

  if (typeof window.arguments[0] == "string") {
    browser.src = window.arguments[0];
  } else {
    if (window.arguments[1].wrappedJSObject.allowScriptsToClose) {
      browser.contentWindow.windowUtils.allowScriptsToClose();
    }
    ExtensionParent.apiManager.emit("extension-browser-inserted", browser);
    browser.src =
      window.arguments[1].wrappedJSObject.tabs[0].tabParams.contentPage;
  }
}

// Fake it 'til you make it.
var gBrowser = {
  get selectedBrowser() {
    return document.getElementById("requestFrame");
  },
  _getAndMaybeCreateDateTimePickerPanel() {
    return this.selectedBrowser.dateTimePicker;
  },
  get webNavigation() {
    return this.selectedBrowser.webNavigation;
  },
  updateTitlebar() {
    let docTitle = browser.contentDocument.title
      ? browser.contentDocument.title.trim()
      : "";
    let docElement = document.documentElement;
    // If the document title is blank, add the default title.
    if (!docTitle) {
      docTitle = docElement.getAttribute("defaultTabTitle");
    }

    if (docElement.hasAttribute("titlepreface")) {
      docTitle = docElement.getAttribute("titlepreface") + docTitle;
    }

    // If we're on Mac, don't display the separator and the modifier.
    if (AppConstants.platform != "macosx") {
      docTitle +=
        docElement.getAttribute("titlemenuseparator") +
        docElement.getAttribute("titlemodifier");
    }

    document.title = docTitle;
    document.dispatchEvent(new Event("extension-window-title-changed"));
  },
};

this.__defineGetter__("browser", getBrowser);

function getBrowser() {
  return gBrowser.selectedBrowser;
}
function mailContextOnContextMenu(event) {
  document.getElementById("mailContext").target =
    event.composedTarget || event.originalTarget;
}
function fillMailContextMenu(event) {
  gContextMenu = new nsContextMenu(event.target, event.shiftKey);
  return gContextMenu.shouldDisplay;
}
function mailContextOnPopupHiding() {}
