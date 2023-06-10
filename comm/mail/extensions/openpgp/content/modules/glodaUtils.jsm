/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 This module is a shim module to make it easier to load
 GlodaUtils from the various potential sources
*/

"use strict";

var EXPORTED_SYMBOLS = ["GlodaUtils"];

var { GlodaUtils } = ChromeUtils.import(
  "resource:///modules/gloda/GlodaUtils.jsm"
);

// We don't define the exported symbol here - that is on purpose
// The goal of this module is simply to simplify loading of the component
