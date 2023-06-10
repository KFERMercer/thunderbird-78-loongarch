/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const EXPORTED_SYMBOLS = ["CustomizeDialogHelper"];

var elib = ChromeUtils.import(
  "resource://testing-common/mozmill/elementslib.jsm"
);

var wh = ChromeUtils.import(
  "resource://testing-common/mozmill/WindowHelpers.jsm"
);

var { Assert } = ChromeUtils.import("resource://testing-common/Assert.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

var USE_SHEET_PREF = "toolbar.customization.usesheet";

/**
 * Initialize the help for a customization dialog
 * @param {} aToolbarId
 *   the ID of the toolbar to be customized
 * @param {} aOpenElementId
 *   the ID of the element to be clicked on to open the dialog
 * @param {} aWindowType
 *   the windowType of the window containing the dialog to be opened
 */
function CustomizeDialogHelper(aToolbarId, aOpenElementId, aWindowType) {
  this._toolbarId = aToolbarId;
  this._openElementId = aOpenElementId;
  this._windowType = aWindowType;
  this._openInWindow = !Services.prefs.getBoolPref(USE_SHEET_PREF);
}

CustomizeDialogHelper.prototype = {
  /**
   * Open a customization dialog by clicking on a given XUL element.
   * @param {} aController
   *   the controller object of the window for which the customization
   *   dialog should be opened
   * @returns a controller for the customization dialog
   */
  open: function CustomizeDialogHelper_open(aController) {
    let ctc;
    aController.click(aController.eid(this._openElementId));
    // Depending on preferences the customization dialog is
    // either a normal window or embedded into a sheet.
    if (!this._openInWindow) {
      ctc = wh.wait_for_frame_load(
        aController.e("customizeToolbarSheetIFrame"),
        "chrome://messenger/content/customizeToolbar.xhtml"
      );
    } else {
      ctc = wh.wait_for_existing_window(this._windowType);
    }
    return ctc;
  },

  /**
   * Close the customization dialog.
   * @param {} aCtc
   *   the controller object of the customization dialog which should be closed
   */
  close: function CustomizeDialogHelper_close(aCtc) {
    if (this._openInWindow) {
      wh.plan_for_window_close(aCtc);
    }

    aCtc.click(aCtc.eid("donebutton"));
    // XXX There should be an equivalent for testing the closure of
    // XXX the dialog embedded in a sheet, but I do not know how.
    if (this._openInWindow) {
      wh.wait_for_window_close();
      Assert.ok(aCtc.window.closed, "The customization dialog is not closed.");
    }
  },

  /**
   *  Restore the default buttons in the header pane toolbar
   *  by clicking the corresponding button in the palette dialog
   *  and check if it worked.
   * @param {} aController
   *   the controller object of the window for which the customization
   *   dialog should be opened
   */
  restoreDefaultButtons: function CustomizeDialogHelper_restoreDefaultButtons(
    aController
  ) {
    let ctc = this.open(aController);
    let restoreButton = ctc.window.document
      .getElementById("main-box")
      .querySelector("[oncommand*='overlayRestoreDefaultSet();']");

    ctc.click(new elib.Elem(restoreButton));

    this.close(ctc);

    let toolbar = aController.e(this._toolbarId);
    let defaultSet = toolbar.getAttribute("defaultset");

    Assert.equal(toolbar.currentSet, defaultSet);
  },
};
