/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailDialog"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { EnigmailLog } = ChromeUtils.import(
  "chrome://openpgp/content/modules/log.jsm"
);
const { EnigmailWindows } = ChromeUtils.import(
  "chrome://openpgp/content/modules/windows.jsm"
);
const { EnigmailPrefs } = ChromeUtils.import(
  "chrome://openpgp/content/modules/prefs.jsm"
);
const { EnigmailConstants } = ChromeUtils.import(
  "chrome://openpgp/content/modules/constants.jsm"
);

const l10n = new Localization(["messenger/openpgp/openpgp.ftl"], true);

const LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";

var EnigmailDialog = {
  /***
   * Confirmation dialog with OK / Cancel buttons (both customizable)
   *
   * @win:         nsIWindow - parent window to display modal dialog; can be null
   * @mesg:        String    - message text
   * @okLabel:     String    - OPTIONAL label for OK button
   * @cancelLabel: String    - OPTIONAL label for cancel button
   *
   * @return:      Boolean   - true: OK pressed / false: Cancel or ESC pressed
   */
  confirmDlg(win, mesg, okLabel, cancelLabel) {
    let buttonPressed = EnigmailDialog.msgBox(
      win,
      {
        msgtext: mesg,
        button1: okLabel ? okLabel : l10n.formatValueSync("dlg-button-ok"),
        cancelButton: cancelLabel
          ? cancelLabel
          : l10n.formatValueSync("dlg-button-cancel"),
        iconType: EnigmailConstants.ICONTYPE_QUESTION,
        dialogTitle: l10n.formatValueSync("enig-confirm"),
      },
      null
    );

    return buttonPressed === 0;
  },

  /**
   * Displays an alert dialog.
   *
   * @win:         nsIWindow - parent window to display modal dialog; can be null
   * @mesg:        String    - message text
   *
   * no return value
   */
  alert(win, mesg) {
    EnigmailDialog.msgBox(
      win,
      {
        msgtext: mesg,
        button1: l10n.formatValueSync("dlg-button-close"),
        iconType: EnigmailConstants.ICONTYPE_ALERT,
        dialogTitle: l10n.formatValueSync("enig-alert"),
      },
      null
    );
  },

  /**
   * Displays an information dialog.
   *
   * @win:         nsIWindow - parent window to display modal dialog; can be null
   * @mesg:        String    - message text
   *
   * no return value
   */
  info(win, mesg) {
    EnigmailDialog.msgBox(
      win,
      {
        msgtext: mesg,
        button1: l10n.formatValueSync("dlg-button-close"),
        iconType: EnigmailConstants.ICONTYPE_INFO,
        dialogTitle: l10n.formatValueSync("enig-info"),
      },
      null
    );
  },

  /**
   * Displays an alert dialog with 1-3 optional buttons.
   *
   * @win:           nsIWindow - parent window to display modal dialog; can be null
   * @mesg:          String    - message text
   * @checkboxLabel: String    - if not null, display checkbox with text; the
   *                             checkbox state is returned in checkedObj.value
   * @button-Labels: String    - use "&" to indicate access key
   *     use "buttonType:label" or ":buttonType" to indicate special button types
   *        (buttonType is one of cancel, help, extra1, extra2)
   * @checkedObj:    Object    - holding the checkbox value
   *
   * @return: 0-2: button Number pressed
   *          -1: ESC or close window button pressed
   *
   */
  longAlert(
    win,
    mesg,
    checkboxLabel,
    okLabel,
    labelButton2,
    labelButton3,
    checkedObj
  ) {
    var result = {
      value: -1,
      checked: false,
    };

    if (!win) {
      win = EnigmailWindows.getBestParentWin();
    }

    win.openDialog(
      "chrome://openpgp/content/ui/enigmailMsgBox.xhtml",
      "_blank",
      "chrome,dialog,modal,centerscreen,resizable,titlebar",
      {
        msgtext: mesg,
        checkboxLabel,
        iconType: EnigmailConstants.ICONTYPE_ALERT,
        button1: okLabel,
        button2: labelButton2,
        button3: labelButton3,
      },
      result
    );

    if (checkboxLabel) {
      checkedObj.value = result.checked;
    }
    return result.value;
  },

  /**
   * Displays a message box with 1-3 optional buttons.
   *
   * @win:           nsIWindow - parent window to display modal dialog; can be null
   * @argsObj:       Object:
   *   - msgtext:       String    - message text
   *   - dialogTitle:   String    - title of the dialog
   *   - checkboxLabel: String    - if not null, display checkbox with text; the
   *                                checkbox state is returned in checkedObj.value
   *   - iconType:      Number    - Icon type: 1=Message / 2=Question / 3=Alert / 4=Error
   *
   *   - buttonX:       String    - Button label (button 1-3) [button1 = "accept" button]
   *                                use "&" to indicate access key
   *   - cancelButton   String    - Label for cancel button
   *     use "buttonType:label" or ":buttonType" to indicate special button types
   *        (buttonType is one of cancel, help, extra1, extra2)
   *     if no button is provided, OK will be displayed
   *
   * @checkedObj:    Object    - holding the checkbox value
   *
   * @return: 0-2: button Number pressed
   *          -1: cancel button, ESC or close window button pressed
   *
   */
  msgBox(win, argsObj, checkedObj) {
    var result = {
      value: -1,
      checked: false,
    };

    if (!win) {
      win = EnigmailWindows.getBestParentWin();
    }

    win.openDialog(
      "chrome://openpgp/content/ui/enigmailMsgBox.xhtml",
      "",
      "chrome,dialog,modal,centerscreen,resizable",
      argsObj,
      result
    );

    if (argsObj.checkboxLabel) {
      checkedObj.value = result.checked;
    }
    return result.value;
  },

  /**
   * Display a dialog with a message and a text entry field
   *
   * @win:      nsIWindow - parent window to display modal dialog; can be null
   * @mesg:     String    - message text
   * @valueObj: Object    - object to hold the entered text in .value
   *
   * @return:   Boolean - true if OK was pressed / false otherwise
   */
  promptValue(win, mesg, valueObj) {
    return Services.prompt.prompt(
      win,
      l10n.formatValueSync("enig-prompt"),
      mesg,
      valueObj,
      "",
      {}
    );
  },

  /**
   * Display an alert message with an OK button and a checkbox to hide
   * the message in the future.
   * In case the checkbox was pressed in the past, the dialog is skipped
   *
   * @win:      nsIWindow - the parent window to hold the modal dialog
   * @mesg:     String    - the localized message to display
   * @prefText: String    - the name of the Enigmail preference to read/store the
   *                        the future display status
   */
  alertPref(win, mesg, prefText) {
    const display = true;
    const dontDisplay = false;

    let prefValue = EnigmailPrefs.getPref(prefText);
    if (prefValue === display) {
      let checkBoxObj = {
        value: false,
      };

      let buttonPressed = EnigmailDialog.msgBox(
        win,
        {
          msgtext: mesg,
          dialogTitle: l10n.formatValueSync("enig-info"),
          iconType: EnigmailConstants.ICONTYPE_INFO,
          checkboxLabel: l10n.formatValueSync("dlg-no-prompt"),
        },
        checkBoxObj
      );

      if (checkBoxObj.value && buttonPressed === 0) {
        EnigmailPrefs.setPref(prefText, dontDisplay);
      }
    }
  },

  /**
   * Display an alert dialog together with the message "this dialog will be
   * displayed |counter| more times".
   * If |counter| is 0, the dialog is not displayed.
   *
   * @win:           nsIWindow - the parent window to hold the modal dialog
   * @countPrefName: String    - the name of the Enigmail preference to read/store the
   *                             the |counter| value
   * @mesg:          String    - the localized message to display
   *
   */
  alertCount(win, countPrefName, mesg) {
    let alertCount = EnigmailPrefs.getPref(countPrefName);

    if (alertCount <= 0) {
      return;
    }

    alertCount--;
    EnigmailPrefs.setPref(countPrefName, alertCount);

    if (alertCount > 0) {
      mesg +=
        "\n" +
        l10n.formatValueSync("repeat-prefix", { count: alertCount }) +
        " ";
      mesg +=
        alertCount == 1
          ? l10n.formatValueSync("repeat-suffix-singular")
          : l10n.formatValueSync("repeat-suffix-plural");
    } else {
      mesg += "\n" + l10n.formatValueSync("no-repeat");
    }

    EnigmailDialog.alert(win, mesg);
  },

  /**
   * Display a confirmation dialog with OK / Cancel buttons (both customizable) and
   * a checkbox to remember the selected choice.
   *
   *
   * @win:         nsIWindow - parent window to display modal dialog; can be null
   * @mesg:        String    - message text
   * @prefText     String    - the name of the Enigmail preference to read/store the
   *                           the future display status.
   *                           the default action is chosen
   * @okLabel:     String    - OPTIONAL label for OK button
   * @cancelLabel: String    - OPTIONAL label for cancel button
   *
   * @return:      Boolean   - true: 1 pressed / 0: Cancel pressed / -1: ESC pressed
   *
   * If the dialog is not displayed:
   *  - if @prefText is type Boolean: return 1
   *  - if @prefText is type Number:  return the last choice of the user
   */
  confirmPref(win, mesg, prefText, okLabel, cancelLabel) {
    const notSet = 0;
    const yes = 1;
    const no = 2;
    const display = true;
    const dontDisplay = false;

    var prefValue = EnigmailPrefs.getPref(prefText);

    if (typeof prefValue != "boolean") {
      // number: remember user's choice
      switch (prefValue) {
        case notSet: {
          let checkBoxObj = {
            value: false,
          };
          let buttonPressed = EnigmailDialog.msgBox(
            win,
            {
              msgtext: mesg,
              button1: okLabel
                ? okLabel
                : l10n.formatValueSync("dlg-button-ok"),
              cancelButton: cancelLabel
                ? cancelLabel
                : l10n.formatValueSync("dlg-button-cancel"),
              checkboxLabel: l10n.formatValueSync("dlg-keep-setting"),
              iconType: EnigmailConstants.ICONTYPE_QUESTION,
              dialogTitle: l10n.formatValueSync("enig-confirm"),
            },
            checkBoxObj
          );

          if (checkBoxObj.value) {
            EnigmailPrefs.setPref(prefText, buttonPressed === 0 ? yes : no);
          }
          return buttonPressed === 0 ? 1 : 0;
        }
        case yes:
          return 1;
        case no:
          return 0;
        default:
          return -1;
      }
    } else {
      // boolean: "do not show this dialog anymore" (and return default)
      switch (prefValue) {
        case display: {
          let checkBoxObj = {
            value: false,
          };
          let buttonPressed = EnigmailDialog.msgBox(
            win,
            {
              msgtext: mesg,
              button1: okLabel
                ? okLabel
                : l10n.formatValueSync("dlg-button-ok"),
              cancelButton: cancelLabel
                ? cancelLabel
                : l10n.formatValueSync("dlg-button-cancel"),
              checkboxLabel: l10n.formatValueSync("dlg-no-prompt"),
              iconType: EnigmailConstants.ICONTYPE_QUESTION,
              dialogTitle: l10n.formatValueSync("enig-confirm"),
            },
            checkBoxObj
          );

          if (checkBoxObj.value) {
            EnigmailPrefs.setPref(prefText, false);
          }
          return buttonPressed === 0 ? 1 : 0;
        }
        case dontDisplay:
          return 1;
        default:
          return -1;
      }
    }
  },

  /**
   *  Display a "open file" or "save file" dialog
   *
   *  win:              nsIWindow - parent window
   *  title:            String    - window title
   *  displayDir:       String    - optional: directory to be displayed
   *  save:             Boolean   - true = Save file / false = Open file
   *  multiple:         Boolean   - true = Select multiple files / false = Select single file
   *  defaultExtension: String    - optional: extension for the type of files to work with, e.g. "asc"
   *  defaultName:      String    - optional: filename, incl. extension, that should be suggested to
   *                                the user as default, e.g. "keys.asc"
   *  filterPairs:      Array     - optional: [title, extension], e.g. ["Pictures", "*.jpg; *.png"]
   *
   *  return value:     nsIFile object, or array of nsIFile objects,
   *                    representing the file(s) to load or save
   */
  filePicker(
    win,
    title,
    displayDir,
    save,
    multiple,
    defaultExtension,
    defaultName,
    filterPairs
  ) {
    EnigmailLog.DEBUG("enigmailCommon.jsm: filePicker: " + save + "\n");

    let filePicker = Cc["@mozilla.org/filepicker;1"].createInstance();
    filePicker = filePicker.QueryInterface(Ci.nsIFilePicker);

    let open = multiple
      ? Ci.nsIFilePicker.modeOpenMultiple
      : Ci.nsIFilePicker.modeOpen;
    let mode = save ? Ci.nsIFilePicker.modeSave : open;

    filePicker.init(win, title, mode);

    if (displayDir) {
      var localFile = Cc[LOCAL_FILE_CONTRACTID].createInstance(Ci.nsIFile);

      try {
        localFile.initWithPath(displayDir);
        filePicker.displayDirectory = localFile;
      } catch (ex) {}
    }

    if (defaultExtension) {
      filePicker.defaultExtension = defaultExtension;
    }

    if (defaultName) {
      filePicker.defaultString = defaultName;
    }

    let nfilters = 0;
    if (filterPairs && filterPairs.length) {
      nfilters = filterPairs.length / 2;
    }

    for (let index = 0; index < nfilters; index++) {
      filePicker.appendFilter(
        filterPairs[2 * index],
        filterPairs[2 * index + 1]
      );
    }

    filePicker.appendFilters(Ci.nsIFilePicker.filterAll);

    let inspector = Cc["@mozilla.org/jsinspector;1"].createInstance(
      Ci.nsIJSInspector
    );
    let files = [];
    filePicker.open(res => {
      if (
        res != Ci.nsIFilePicker.returnOK &&
        res != Ci.nsIFilePicker.returnReplace
      ) {
        inspector.exitNestedEventLoop();
        return;
      }

      // Loop through multiple selected files only if the dialog was triggered
      // to open files and the `multiple` boolean variable is true.
      if (!save && multiple) {
        for (let file of filePicker.files) {
          // XXX: for some reason QI is needed on Mac.
          files.push(file.QueryInterface(Ci.nsIFile));
        }
      } else {
        files.push(filePicker.file);
      }

      inspector.exitNestedEventLoop();
    });

    inspector.enterNestedEventLoop(0); // wait for async process to terminate

    return multiple ? files : files[0];
  },

  /**
   * Displays a dialog with success/failure information after importing
   * keys.
   *
   * @param win:           nsIWindow - parent window to display modal dialog; can be null
   * @param keyList:       Array of String - imported keyIDs
   *
   * @return: 0-2: button Number pressed
   *          -1: ESC or close window button pressed
   *
   */
  keyImportDlg(win, keyList) {
    var result = {
      value: -1,
      checked: false,
    };

    if (!win) {
      win = EnigmailWindows.getBestParentWin();
    }

    win.openDialog(
      "chrome://openpgp/content/ui/enigmailKeyImportInfo.xhtml",
      "",
      "chrome,dialog,modal,centerscreen,resizable",
      {
        keyList,
      },
      result
    );

    return result.value;
  },
  /**
   * return a pre-initialized prompt service
   */
  getPromptSvc() {
    return Services.prompt;
  },

  /**
   * Asks user to confirm the import of the given public keys.
   * User is allowed to automatically accept new/undecided keys.
   *
   * @param {?nsIDOMWindow} parent - Parent window.
   * @param {EnigmailKeyObj[]} - Array of key objects.
   * @param {Object} outputParams - Out parameters. If confirmed,
   *                       outputParams.acceptance {String} contains the decision.
   * @return:              Boolean - true if user confirms import
   *
   */
  confirmPubkeyImport(parentWindow, keyPreview, outputParams) {
    // For TB 78 compatibility
    let w =
      "browsingContext" in parentWindow
        ? parentWindow.browsingContext.topChromeWindow
        : parentWindow.docShell.rootTreeItem.domWindow;

    let args = {
      keys: keyPreview,
      confirmed: false,
      acceptance: "",
    };

    w.openDialog(
      "chrome://openpgp/content/ui/confirmPubkeyImport.xhtml",
      "",
      "dialog,modal,centerscreen,resizable",
      args
    );

    if (args.confirmed && outputParams) {
      outputParams.acceptance = args.acceptance;
    }

    return args.confirmed;
  },
};

EnigmailWindows.alert = EnigmailDialog.alert;
