/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * Test telemetry related to mails sent.
 */

let { TelemetryTestUtils } = ChromeUtils.import(
  "resource://testing-common/TelemetryTestUtils.jsm"
);

let server;

let kIdentityMail = "identity@foo.invalid";
let kSender = "from@foo.invalid";
let kTo = "to@foo.invalid";

/**
 * Check that we're counting mails sent.
 */
add_task(async function test_mails_sent() {
  Services.telemetry.clearScalars();
  const NUM_MAILS = 3;

  server = setupServerDaemon();

  // Test file
  let testFile = do_get_file("data/message1.eml");

  // Ensure we have at least one mail account
  localAccountUtils.loadLocalMailAccount();

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start();
    let smtpServer = getBasicSmtpServer(server.port);
    let identity = getSmtpIdentity(kIdentityMail, smtpServer);

    for (let i = 0; i < NUM_MAILS; i++) {
      MailServices.smtp.sendMailMessage(
        testFile,
        kTo,
        identity,
        kSender,
        null,
        null,
        null,
        null,
        false,
        {},
        {}
      );
    }
  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();
  }
  let scalars = TelemetryTestUtils.getProcessScalars("parent");
  Assert.equal(
    scalars["tb.mails.sent"],
    NUM_MAILS,
    "Count of mails sent must be correct."
  );
});
