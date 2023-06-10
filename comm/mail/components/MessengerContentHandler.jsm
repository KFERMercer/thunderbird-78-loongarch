/* -*- indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["MessengerContentHandler"];

var { NetUtil } = ChromeUtils.import("resource://gre/modules/NetUtil.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

var URI_INHERITS_SECURITY_CONTEXT =
  Ci.nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT;

function resolveURIInternal(aCmdLine, aArgument) {
  var uri = aCmdLine.resolveURI(aArgument);

  if (!(uri instanceof Ci.nsIFileURL)) {
    return uri;
  }

  try {
    if (uri.file.exists()) {
      return uri;
    }
  } catch (e) {
    Cu.reportError(e);
  }

  // We have interpreted the argument as a relative file URI, but the file
  // doesn't exist. Try URI fixup heuristics: see bug 290782.

  try {
    uri = Services.uriFixup.createFixupURI(aArgument, 0);
  } catch (e) {
    Cu.reportError(e);
  }

  return uri;
}

function handleIndexerResult(aFile) {
  // Do this here because xpcshell isn't too happy with this at startup
  var { MailUtils } = ChromeUtils.import("resource:///modules/MailUtils.jsm");
  // Make sure the folder tree is initialized
  MailUtils.discoverFolders();

  // Use the search integration module to convert the indexer result into a
  // message header
  const { SearchIntegration } = ChromeUtils.import(
    "resource:///modules/SearchIntegration.jsm"
  );
  let msgHdr = SearchIntegration.handleResult(aFile);

  // If we found a message header, open it, otherwise throw an exception
  if (msgHdr) {
    MailUtils.displayMessage(msgHdr);
  } else {
    throw Components.Exception("", Cr.NS_ERROR_FAILURE);
  }
}

function mayOpenURI(uri) {
  var ext = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(
    Ci.nsIExternalProtocolService
  );

  return ext.isExposedProtocol(uri.scheme);
}

function openURI(uri) {
  if (!mayOpenURI(uri)) {
    throw Components.Exception("", Cr.NS_ERROR_FAILURE);
  }

  var channel = Services.io.newChannelFromURI(
    uri,
    null,
    Services.scriptSecurityManager.getSystemPrincipal(),
    null,
    Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_IS_NULL,
    Ci.nsIContentPolicy.TYPE_OTHER
  );
  var loader = Cc["@mozilla.org/uriloader;1"].getService(Ci.nsIURILoader);

  // We cannot load a URI on startup asynchronously without protecting
  // the startup

  var loadgroup = Cc["@mozilla.org/network/load-group;1"].createInstance(
    Ci.nsILoadGroup
  );

  var loadlistener = {
    onStartRequest(aRequest) {
      Services.startup.enterLastWindowClosingSurvivalArea();
    },

    onStopRequest(aRequest, aStatusCode) {
      Services.startup.exitLastWindowClosingSurvivalArea();
    },

    QueryInterface: ChromeUtils.generateQI([
      Ci.nsIRequestObserver,
      Ci.nsISupportsWeakReference,
    ]),
  };

  loadgroup.groupObserver = loadlistener;

  var listener = {
    doContent(ctype, preferred, request, handler) {
      var newHandler = Cc[
        "@mozilla.org/uriloader/content-handler;1?type=application/x-message-display"
      ].createInstance(Ci.nsIContentHandler);
      newHandler.handleContent("application/x-message-display", this, request);
      return true;
    },
    isPreferred(ctype, desired) {
      if (ctype == "message/rfc822") {
        return true;
      }
      return false;
    },
    canHandleContent(ctype, preferred, desired) {
      return false;
    },
    loadCookie: null,
    parentContentListener: null,
    getInterface(iid) {
      if (iid.equals(Ci.nsIURIContentListener)) {
        return this;
      }

      if (iid.equals(Ci.nsILoadGroup)) {
        return loadgroup;
      }

      throw Components.Exception("", Cr.NS_ERROR_NO_INTERFACE);
    },
  };
  loader.openURI(channel, true, listener);
}

function MailDefaultHandler() {}

MailDefaultHandler.prototype = {
  QueryInterface: ChromeUtils.generateQI([
    Ci.nsICommandLineHandler,
    Ci.nsICommandLineValidator,
    Ci.nsIFactory,
  ]),

  /* nsICommandLineHandler */

  /* eslint-disable complexity */
  handle(cmdLine) {
    var uri;

    try {
      var remoteCommand = cmdLine.handleFlagWithParam("remote", true);
    } catch (e) {
      throw Components.Exception("", Cr.NS_ERROR_ABORT);
    }

    if (remoteCommand != null) {
      try {
        var a = /^\s*(\w+)\(([^\)]*)\)\s*$/.exec(remoteCommand);
        var remoteVerb = a[1].toLowerCase();
        var remoteParams = a[2].split(",");

        switch (remoteVerb) {
          case "openurl": {
            let xuri = cmdLine.resolveURI(remoteParams[0]);
            openURI(xuri);
            break;
          }
          case "mailto": {
            let xuri = cmdLine.resolveURI("mailto:" + remoteParams[0]);
            openURI(xuri);
            break;
          }
          case "xfedocommand":
            // xfeDoCommand(openBrowser)
            switch (remoteParams[0].toLowerCase()) {
              case "openinbox": {
                var win = Services.wm.getMostRecentWindow("mail:3pane");
                if (win) {
                  win.focus();
                } else {
                  // Bug 277798 - we have to pass an argument to openWindow(), or
                  // else it won't honor the dialog=no instruction.
                  let argstring = Cc[
                    "@mozilla.org/supports-string;1"
                  ].createInstance(Ci.nsISupportsString);
                  Services.ww.openWindow(
                    null,
                    "chrome://messenger/content/messenger.xhtml",
                    "_blank",
                    "chrome,dialog=no,all",
                    argstring
                  );
                }
                break;
              }
              case "composemessage": {
                let argstring = Cc[
                  "@mozilla.org/supports-string;1"
                ].createInstance(Ci.nsISupportsString);
                remoteParams.shift();
                argstring.data = remoteParams.join(",");
                Services.ww.openWindow(
                  null,
                  "chrome://messenger/content/messengercompose/messengercompose.xhtml",
                  "_blank",
                  "chrome,dialog=no,all",
                  argstring
                );
                break;
              }
              default:
                throw Components.Exception("", Cr.NS_ERROR_ABORT);
            }
            break;

          default:
            // Somebody sent us a remote command we don't know how to process:
            // just abort.
            throw Components.Exception("", Cr.NS_ERROR_ABORT);
        }

        cmdLine.preventDefault = true;
      } catch (e) {
        // If we had a -remote flag but failed to process it, throw
        // NS_ERROR_ABORT so that the xremote code knows to return a failure
        // back to the handling code.
        dump(e);
        throw Components.Exception("", Cr.NS_ERROR_ABORT);
      }
    }

    var chromeParam = cmdLine.handleFlagWithParam("chrome", false);
    if (chromeParam) {
      try {
        let argstring = Cc["@mozilla.org/supports-string;1"].createInstance(
          Ci.nsISupportsString
        );
        let _uri = resolveURIInternal(cmdLine, chromeParam);
        // only load URIs which do not inherit chrome privs
        if (
          !Services.netUtils.URIChainHasFlags(
            _uri,
            URI_INHERITS_SECURITY_CONTEXT
          )
        ) {
          Services.ww.openWindow(
            null,
            _uri.spec,
            "_blank",
            "chrome,dialog=no,all",
            argstring
          );
          cmdLine.preventDefault = true;
        }
      } catch (e) {
        dump(e);
      }
    }

    if (cmdLine.handleFlag("silent", false)) {
      cmdLine.preventDefault = true;
    }

    if (cmdLine.handleFlag("options", false)) {
      // Open the options window
      let instantApply = Services.prefs.getBoolPref(
        "browser.preferences.instantApply"
      );
      let features =
        "chrome,titlebar,toolbar" + (instantApply ? ",dialog=no" : ",modal");

      Services.ww.openWindow(
        null,
        "chrome://messenger/content/preferences/preferences.xhtml",
        "_blank",
        features,
        null
      );
    }

    if (cmdLine.handleFlag("setDefaultMail", false)) {
      var shell = Cc["@mozilla.org/mail/shell-service;1"].getService(
        Ci.nsIShellService
      );
      shell.setDefaultClient(true, Ci.nsIShellService.MAIL);
    }

    // The URI might be passed as the argument to the file parameter
    uri = cmdLine.handleFlagWithParam("file", false);

    var count = cmdLine.length;
    if (count) {
      var i = 0;
      while (i < count) {
        var curarg = cmdLine.getArgument(i);
        if (!curarg.startsWith("-")) {
          break;
        }

        dump("Warning: unrecognized command line flag " + curarg + "\n");
        // To emulate the pre-nsICommandLine behavior, we ignore the
        // argument after an unrecognized flag.
        i += 2;
        // xxxbsmedberg: make me use the console service!
      }

      if (i < count) {
        uri = cmdLine.getArgument(i);

        // mailto: URIs are frequently passed with spaces in them. They should be
        // escaped into %20, but we hack around bad clients, see bug 231032
        if (uri.startsWith("mailto:")) {
          while (++i < count) {
            var testarg = cmdLine.getArgument(i);
            if (testarg.startsWith("-")) {
              break;
            }

            uri += " " + testarg;
          }
        }
      }
    }

    if (!uri && cmdLine.preventDefault) {
      return;
    }

    if (!uri && cmdLine.state != Ci.nsICommandLine.STATE_INITIAL_LAUNCH) {
      try {
        for (let window of Services.wm.getEnumerator("mail:3pane")) {
          window.focus();
          return;
        }
      } catch (e) {
        dump(e);
      }
    }
    if (uri) {
      if (/^https?:/i.test(uri)) {
        Cc["@mozilla.org/newsblog-feed-downloader;1"]
          .getService(Ci.nsINewsBlogFeedDownloader)
          .subscribeToFeed(uri, null, null);
      } else if (
        uri.toLowerCase().endsWith(".mozeml") ||
        uri.toLowerCase().endsWith(".wdseml")
      ) {
        handleIndexerResult(cmdLine.resolveFile(uri));
        cmdLine.preventDefault = true;
      } else if (uri.toLowerCase().endsWith(".eml")) {
        // Open this eml in a new message window
        let file = cmdLine.resolveFile(uri);
        // No point in trying to open a file if it doesn't exist or is empty
        if (file.exists() && file.fileSize > 0) {
          // Get the URL for this file
          let fileURL = Services.io
            .newFileURI(file)
            .QueryInterface(Ci.nsIFileURL);
          fileURL = fileURL
            .mutate()
            .setQuery("type=application/x-message-display")
            .finalize();

          Services.ww.openWindow(
            null,
            "chrome://messenger/content/messageWindow.xhtml",
            "_blank",
            "all,chrome,dialog=no,status,toolbar",
            fileURL
          );
          cmdLine.preventDefault = true;
        } else {
          let bundle = Services.strings.createBundle(
            "chrome://messenger/locale/messenger.properties"
          );
          let title, message;
          if (!file.exists()) {
            title = bundle.GetStringFromName("fileNotFoundTitle");
            message = bundle.formatStringFromName("fileNotFoundMsg", [
              file.path,
            ]);
          } else {
            // The file is empty
            title = bundle.GetStringFromName("fileEmptyTitle");
            message = bundle.formatStringFromName("fileEmptyMsg", [file.path]);
          }

          Services.prompt.alert(null, title, message);
        }
      } else if (uri.toLowerCase().endsWith(".vcf")) {
        // A VCard! Be smart and open the "add contact" dialog.
        let file = cmdLine.resolveFile(uri);
        if (file.exists() && file.fileSize > 0) {
          let uriSpec = Services.io.newFileURI(file).spec;
          NetUtil.asyncFetch(
            { uri: uriSpec, loadUsingSystemPrincipal: true },
            function(inputStream, status) {
              if (!Components.isSuccessCode(status)) {
                return;
              }

              let data = NetUtil.readInputStreamToString(
                inputStream,
                inputStream.available()
              );

              // Try to detect the character set and decode. Only UTF-8 is
              // valid from vCard 4.0, but we support older versions, so other
              // charsets are possible.
              let charset = Cc["@mozilla.org/messengercompose/computils;1"]
                .createInstance(Ci.nsIMsgCompUtils)
                .detectCharset(data);
              let buffer = new Uint8Array(
                Array.from(data, c => c.charCodeAt(0))
              );
              data = new TextDecoder(charset).decode(buffer);

              let card = Cc["@mozilla.org/addressbook/msgvcardservice;1"]
                .getService(Ci.nsIMsgVCardService)
                .vCardToAbCard(data);
              Services.ww.openWindow(
                null,
                "chrome://messenger/content/addressbook/abNewCardDialog.xhtml",
                "_blank",
                "chrome,resizable=no,titlebar,modal,centerscreen",
                card
              );
            }
          );
        }
      } else if (uri.toLowerCase().endsWith(".ics")) {
        // An .ics calendar file! Open the ics file dialog.
        let file = cmdLine.resolveFile(uri);
        if (file.exists() && file.fileSize > 0) {
          Services.ww.openWindow(
            null,
            "chrome://calendar/content/calendar-ics-file-dialog.xhtml",
            "_blank",
            "chrome,titlebar,modal,centerscreen",
            file
          );
        }
      } else {
        // This must be a regular filename. Use it to create a new message with attachment.
        let msgParams = Cc[
          "@mozilla.org/messengercompose/composeparams;1"
        ].createInstance(Ci.nsIMsgComposeParams);
        let composeFields = Cc[
          "@mozilla.org/messengercompose/composefields;1"
        ].createInstance(Ci.nsIMsgCompFields);
        let attachment = Cc[
          "@mozilla.org/messengercompose/attachment;1"
        ].createInstance(Ci.nsIMsgAttachment);
        let localFile = Cc["@mozilla.org/file/local;1"].createInstance(
          Ci.nsIFile
        );
        let fileHandler = Services.io
          .getProtocolHandler("file")
          .QueryInterface(Ci.nsIFileProtocolHandler);

        try {
          // Unescape the URI so that we work with clients that escape spaces.
          localFile.initWithPath(unescape(uri));
          attachment.url = fileHandler.getURLSpecFromFile(localFile);
          composeFields.addAttachment(attachment);

          msgParams.type = Ci.nsIMsgCompType.New;
          msgParams.format = Ci.nsIMsgCompFormat.Default;
          msgParams.composeFields = composeFields;

          MailServices.compose.OpenComposeWindowWithParams(null, msgParams);
        } catch (e) {
          openURI(cmdLine.resolveURI(uri));
        }
      }
    } else {
      var argstring = Cc["@mozilla.org/supports-string;1"].createInstance(
        Ci.nsISupportsString
      );

      Services.ww.openWindow(
        null,
        "chrome://messenger/content/messenger.xhtml",
        "_blank",
        "chrome,dialog=no,all",
        argstring
      );
    }
  },
  /* eslint-enable complexity */

  /* nsICommandLineValidator */
  validate(cmdLine) {
    var osintFlagIdx = cmdLine.findFlag("osint", false);
    if (osintFlagIdx == -1) {
      return;
    }

    // Other handlers may use osint so only handle the osint flag if the mail
    // or compose flag is also present and the command line is valid.
    var mailFlagIdx = cmdLine.findFlag("mail", false);
    var composeFlagIdx = cmdLine.findFlag("compose", false);
    if (mailFlagIdx == -1 && composeFlagIdx == -1) {
      return;
    }

    // If both flags are present use the first flag found so the command line
    // length test will fail.
    if (mailFlagIdx > -1 && composeFlagIdx > -1) {
      var actionFlagIdx =
        mailFlagIdx > composeFlagIdx ? composeFlagIdx : mailFlagIdx;
    } else {
      actionFlagIdx = mailFlagIdx > -1 ? mailFlagIdx : composeFlagIdx;
    }

    if (actionFlagIdx && osintFlagIdx > -1) {
      var param = cmdLine.getArgument(actionFlagIdx + 1);
      if (
        cmdLine.length != actionFlagIdx + 2 ||
        /thunderbird.url.(mailto|news):/.test(param)
      ) {
        throw Components.Exception("", Cr.NS_ERROR_ABORT);
      }
      cmdLine.handleFlag("osint", false);
    }
  },

  openInExternal(uri) {
    Cc["@mozilla.org/uriloader/external-protocol-service;1"]
      .getService(Ci.nsIExternalProtocolService)
      .loadURI(uri);
  },

  handleContent(aContentType, aWindowContext, aRequest) {
    try {
      if (
        !Cc["@mozilla.org/webnavigation-info;1"]
          .getService(Ci.nsIWebNavigationInfo)
          .isTypeSupported(aContentType, null)
      ) {
        throw Components.Exception("", Cr.NS_ERROR_WONT_HANDLE_CONTENT);
      }
    } catch (e) {
      throw Components.Exception("", Cr.NS_ERROR_WONT_HANDLE_CONTENT);
    }

    aRequest.QueryInterface(Ci.nsIChannel);

    // For internal protocols (e.g. imap, mailbox, mailto), we want to handle
    // them internally as we know what to do. For http and https we don't
    // actually deal with external windows very well, so we redirect them to
    // the external browser.
    if (!aRequest.URI.schemeIs("http") && !aRequest.URI.schemeIs("https")) {
      throw Components.Exception("", Cr.NS_ERROR_WONT_HANDLE_CONTENT);
    }

    this.openInExternal(aRequest.URI);
    aRequest.cancel(Cr.NS_BINDING_ABORTED);
  },

  helpInfo:
    "  -options           Open the options dialog.\n" +
    "  -file              Open the specified email file or ICS calendar file.\n" +
    "  -setDefaultMail    Set this app as the default mail client.\n",

  /* nsIFactory */

  createInstance(outer, iid) {
    if (outer != null) {
      throw Components.Exception("", Cr.NS_ERROR_NO_AGGREGATION);
    }

    return this.QueryInterface(iid);
  },

  lockFactory(lock) {
    /* no-op */
  },
};

function MessengerContentHandler() {
  if (!gMessengerContentHandler) {
    gMessengerContentHandler = this;
  }
  return gMessengerContentHandler;
}

MessengerContentHandler.prototype = {
  QueryInterface: ChromeUtils.generateQI([Ci.nsIModule, Ci.nsIContentHandler]),
};

var gMessengerContentHandler = new MailDefaultHandler();
