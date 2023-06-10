/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

"use strict";

var EXPORTED_SYMBOLS = ["EnigmailVerifyAttachment"];

const { EnigmailLog } = ChromeUtils.import(
  "chrome://openpgp/content/modules/log.jsm"
);
const { EnigmailFiles } = ChromeUtils.import(
  "chrome://openpgp/content/modules/files.jsm"
);
const { EnigmailCryptoAPI } = ChromeUtils.import(
  "chrome://openpgp/content/modules/cryptoAPI.jsm"
);

var EnigmailVerifyAttachment = {
  attachment(verifyFile, sigFile) {
    EnigmailLog.DEBUG("verify.jsm: EnigmailVerifyAttachment.attachment:\n");

    const verifyFilePath = EnigmailFiles.getEscapedFilename(
      EnigmailFiles.getFilePathReadonly(verifyFile.QueryInterface(Ci.nsIFile))
    );
    const sigFilePath = EnigmailFiles.getEscapedFilename(
      EnigmailFiles.getFilePathReadonly(sigFile.QueryInterface(Ci.nsIFile))
    );
    const cApi = EnigmailCryptoAPI();
    return cApi.verifyAttachment(verifyFilePath, sigFilePath);
  },
};
