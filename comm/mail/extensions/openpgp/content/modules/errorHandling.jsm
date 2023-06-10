/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailErrorHandling"];

const { EnigmailLog } = ChromeUtils.import(
  "chrome://openpgp/content/modules/log.jsm"
);
const { EnigmailLazy } = ChromeUtils.import(
  "chrome://openpgp/content/modules/lazy.jsm"
);

const getEnigmailKeyRing = EnigmailLazy.loader(
  "enigmail/keyRing.jsm",
  "EnigmailKeyRing"
);
const getEnigmailFiles = EnigmailLazy.loader(
  "enigmail/files.jsm",
  "EnigmailFiles"
);
const getEnigmailRNG = EnigmailLazy.loader("enigmail/rng.jsm", "EnigmailRNG");

var l10n = new Localization(["messenger/openpgp/openpgp.ftl"], true);

var EnigmailErrorHandling = {
  /**
   * Determine why a given key cannot be used for signing
   *
   * @param keyId String - key ID
   *
   * @return String - the reason(s) as message to display to the user
   *                  "" in case the key is valid
   */
  determineInvSignReason(keyId) {
    EnigmailLog.DEBUG(
      "errorHandling.jsm: determineInvSignReason: keyId: " + keyId + "\n"
    );

    let reasonMsg = "";

    let key = getEnigmailKeyRing().getKeyById(keyId);
    if (!key) {
      return l10n.formatValueSync("key-error-key-id-not-found", {
        keySpec: keyId,
      });
    }
    let r = key.getSigningValidity();
    if (!r.keyValid) {
      reasonMsg = r.reason;
    }

    return reasonMsg;
  },

  /**
   * Determine why a given key cannot be used for encryption
   *
   * @param keyId String - key ID
   *
   * @return String - the reason(s) as message to display to the user
   *                  "" in case the key is valid
   */
  determineInvRcptReason(keyId) {
    EnigmailLog.DEBUG(
      "errorHandling.jsm: determineInvRcptReason: keyId: " + keyId + "\n"
    );

    let reasonMsg = "";

    let key = getEnigmailKeyRing().getKeyById(keyId);
    if (!key) {
      return l10n.formatValueSync("key-error-key-id-not-found", {
        keySpec: keyId,
      });
    }
    let r = key.getEncryptionValidity(false);
    if (!r.keyValid) {
      reasonMsg = r.reason;
    }

    return reasonMsg;
  },

  /**
   * Get a unique file to use for logging with --log-file
   */
  getTempLogFile() {
    let logFile = getEnigmailFiles()
      .getTempDirObj()
      .clone();
    logFile.normalize();
    logFile.append("gpgOutput." + getEnigmailRNG().generateRandomString(6));
    return logFile;
  },

  /**
   * Append the content of a file (such as created via --log-file) to the
   * debug log, and delete the file afterwards
   *
   * @param logFile: nsIFile object
   */
  appendLogFileToDebug(logFile) {
    if (logFile && logFile.exists() && logFile.isFile()) {
      let logData = getEnigmailFiles().readFile(logFile);

      EnigmailLog.DEBUG(
        `errorHandling.jsm: Process terminated. Human-readable output from gpg:\n-----\n${logData}-----\n`
      );
      try {
        logFile.remove(false);
      } catch (ex) {}
    }
  },
};
