#!/bin/bash

patch -p1 < ./debian/patches/thunderbird-l10n/sl-change-Edit-Uredi-to-CTRL-E.patch
patch -p1 < ./debian/patches/debian-hacks/Strip-version-number-from-application-before-installation.patch
patch -p1 < ./debian/patches/debian-hacks/Add-another-preferences-directory-for-applications-p.patch
patch -p1 < ./debian/patches/porting-kfreebsd-hurd/LDAP-support-building-on-GNU-kFreeBSD-and-GNU-Hurd.patch
patch -p1 < ./debian/patches/porting/Disable-optimization-on-alpha-for-the-url-classifier.patch
patch -p1 < ./debian/patches/fixes/Properly-launch-applications-set-in-HOME-.mailcap.patch
patch -p1 < ./debian/patches/fixes/Appdata-Adding-some-German-translations.patch
patch -p1 < ./debian/patches/fixes/Appdata-Fix-up-AppStream-error-by-adding-missing-field.patch
patch -p1 < ./debian/patches/debian-hacks/Don-t-error-out-when-run-time-libsqlite-is-older-tha.patch
patch -p1 < ./debian/patches/porting-kfreebsd-hurd/Allow-ipc-code-to-build-on-GNU-kfreebsd.patch
patch -p1 < ./debian/patches/debian-hacks/Don-t-register-plugins-if-the-MOZILLA_DISABLE_PLUGIN.patch
patch -p1 < ./debian/patches/porting-kfreebsd-hurd/Allow-ipc-code-to-build-on-GNU-hurd.patch
patch -p1 < ./debian/patches/fixes/Load-dependent-libraries-with-their-real-path-to-avo.patch
patch -p1 < ./debian/patches/prefs/Set-javascript.options.showInConsole.patch
patch -p1 < ./debian/patches/prefs/Don-t-auto-disable-extensions-in-system-directories.patch
patch -p1 < ./debian/patches/fixes/Bug-628252-os2.cc-fails-to-compile-against-GCC-4.6-m.patch
patch -p1 < ./debian/patches/porting-kfreebsd-hurd/ipc-chromium-fix-if-define-for-kFreeBSD-and-Hurd.patch
patch -p1 < ./debian/patches/porting-kfreebsd-hurd/FTBFS-hurd-fixing-unsupported-platform-Hurd.patch
patch -p1 < ./debian/patches/porting-kfreebsd-hurd/adding-missed-HURD-adoptions.patch
patch -p1 < ./debian/patches/porting-m68k/Add-m68k-support-to-Thunderbird.patch
patch -p1 < ./debian/patches/porting-sh4/Add-sh4-support-to-Thunderbird.patch
patch -p1 < ./debian/patches/porting-armel/Bug-1463035-Remove-MOZ_SIGNAL_TRAMPOLINE.-r-darchons.patch
patch -p1 < ./debian/patches/porting-armel/Avoid-using-vmrs-vmsr-on-armel.patch
patch -p1 < ./debian/patches/porting-armhf/Bug-1526653-Include-struct-definitions-for-user_vfp-and-u.patch
patch -p1 < ./debian/patches/fixes/Allow-.js-preference-files-to-set-locked-prefs-with-lockP.patch
patch -p1 < ./debian/patches/fixes/Bug-1556197-amend-Bug-1544631-for-fixing-mips32.patch
patch -p1 < ./debian/patches/debian-hacks/Work-around-Debian-bug-844357.patch
patch -p1 < ./debian/patches/debian-hacks/Set-program-name-from-the-remoting-name.patch
patch -p1 < ./debian/patches/debian-hacks/Use-remoting-name-for-call-to-gdk_set_program_class.patch
patch -p1 < ./debian/patches/porting/Work-around-GCC-ICE-on-mips-i386-and-s390x.patch
patch -p1 < ./debian/patches/porting-ppc64el/work-around-a-build-failure-with-clang-on-ppc64el.patch
patch -p1 < ./debian/patches/porting-armhf/Don-t-use-LLVM-internal-assembler-on-armhf.patch
patch -p1 < ./debian/patches/porting-arm/Reduce-memory-usage-while-linking-on-arm-el-hf-platforms.patch
patch -p1 < ./debian/patches/debian-hacks/Make-Thunderbird-build-reproducible.patch
patch -p1 < ./debian/patches/porting-s390x/Use-more-recent-embedded-version-of-sqlite3.patch
patch -p1 < ./debian/patches/fixes/Add-missing-bindings-for-mips-in-the-authenticator-crate.patch
patch -p1 < ./debian/patches/fixes/reduce-the-rust-debuginfo-level-on-selected-architectures.patch
patch -p1 < ./debian/patches/fixes/Bug-1650299-Unify-the-inclusion-of-the-ICU-data-file.-r-f.patch
patch -p1 < ./debian/patches/fixes/Don-t-build-ICU-in-parallel.patch
# patch -p1 < porting-loongarch64/Add-loongarch64-support-to-Thunderbird78.patch

exit 0
