/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsAddrDatabase_H_
#define _nsAddrDatabase_H_

#include "mozilla/Attributes.h"
#include "nsIAddrDatabase.h"
#include "nsIFile.h"
#include "mdb.h"
#include "nsString.h"
#include "nsCOMPtr.h"
#include "nsTObserverArray.h"
#include "nsIWeakReferenceUtils.h"

typedef enum {
  AB_NotifyInserted,
  AB_NotifyDeleted,
  AB_NotifyPropertyChanged
} AB_NOTIFY_CODE;

class nsAddrDatabase : public nsIAddrDatabase {
  using PathString = mozilla::PathString;

 public:
  NS_DECL_THREADSAFE_ISUPPORTS
  //////////////////////////////////////////////////////////////////////////////
  // nsIAddrDatabase methods:

  NS_IMETHOD GetDbPath(nsIFile** aDbPath) override;
  NS_IMETHOD SetDbPath(nsIFile* aDbPath) override;
  NS_IMETHOD Open(nsIFile* aMabFile, bool aCreate, bool upgrading,
                  nsIAddrDatabase** pCardDB) override;
  NS_IMETHOD Close(bool forceCommit) override;
  NS_IMETHOD OpenMDB(nsIFile* dbName, bool create) override;
  NS_IMETHOD CloseMDB(bool commit) override;
  NS_IMETHOD ForceClosed() override;

  NS_IMETHOD EnumerateCards(nsIAbDirectory* directory,
                            nsISimpleEnumerator** result) override;
  NS_IMETHOD EnumerateListAddresses(nsIAbDirectory* directory,
                                    uint32_t listRowID,
                                    nsISimpleEnumerator** result) override;

  nsAddrDatabase();

  nsresult GetMDBFactory(nsIMdbFactory** aMdbFactory);
  nsIMdbEnv* GetEnv() { return m_mdbEnv; }
  uint32_t GetCurVersion();
  nsIMdbTableRowCursor* GetTableRowCursor();
  nsIMdbTable* GetPabTable() { return m_mdbPabTable; }

  static already_AddRefed<nsAddrDatabase> FindInCache(nsIFile* dbName);

  static void CleanupCache();

  nsresult CreateABCard(nsIMdbRow* cardRow, mdb_id listRowID,
                        nsIAbCard** result);
  nsresult CreateABListCard(nsIMdbRow* listRow, nsIAbCard** result);

  bool IsListRowScopeToken(mdb_scope scope) {
    return (scope == m_ListRowScopeToken) ? true : false;
  }
  bool IsCardRowScopeToken(mdb_scope scope) {
    return (scope == m_CardRowScopeToken) ? true : false;
  }
  bool IsDataRowScopeToken(mdb_scope scope) {
    return (scope == m_DataRowScopeToken) ? true : false;
  }
  nsresult GetCardRowByRowID(mdb_id rowID, nsIMdbRow** dbRow);
  nsresult GetListRowByRowID(mdb_id rowID, nsIMdbRow** dbRow);

  uint32_t GetListAddressTotal(nsIMdbRow* listRow);
  nsresult GetAddressRowByPos(nsIMdbRow* listRow, uint16_t pos,
                              nsIMdbRow** cardRow);

  nsresult InitCardFromRow(nsIAbCard* aNewCard, nsIMdbRow* aCardRow);

 protected:
  virtual ~nsAddrDatabase();

  static void RemoveFromCache(nsAddrDatabase* pAddrDB);
  bool MatchDbName(nsIFile* dbName);  // returns TRUE if they match

  void YarnToUInt32(struct mdbYarn* yarn, uint32_t* pResult);
  nsresult GetStringColumn(nsIMdbRow* cardRow, mdb_token outToken,
                           nsString& str);
  nsresult GetIntColumn(nsIMdbRow* cardRow, mdb_token outToken,
                        uint32_t* pValue, uint32_t defaultValue);
  nsresult GetListCardFromDB(nsIAbCard* listCard, nsIMdbRow* listRow);
  nsresult CreateCard(nsIMdbRow* cardRow, mdb_id listRowID, nsIAbCard** result);

  static nsTArray<nsAddrDatabase*>* m_dbCache;
  static nsTArray<nsAddrDatabase*>* GetDBCache();

  // mdb bookkeeping stuff
  nsresult InitExistingDB();
  nsresult InitMDBInfo();
  nsresult InitPabTable();

  nsIMdbEnv* m_mdbEnv;  // to be used in all the db calls.
  nsIMdbStore* m_mdbStore;
  nsIMdbTable* m_mdbPabTable;
  nsCOMPtr<nsIFile> m_dbName;
  bool m_mdbTokensInitialized;

  mdb_kind m_PabTableKind;
  mdb_kind m_DeletedCardsTableKind;

  mdb_scope m_CardRowScopeToken;
  mdb_scope m_ListRowScopeToken;
  mdb_scope m_DataRowScopeToken;

  mdb_token m_UIDColumnToken;
  mdb_token m_FirstNameColumnToken;
  mdb_token m_LastNameColumnToken;
  mdb_token m_PhoneticFirstNameColumnToken;
  mdb_token m_PhoneticLastNameColumnToken;
  mdb_token m_DisplayNameColumnToken;
  mdb_token m_NickNameColumnToken;
  mdb_token m_PriEmailColumnToken;
  mdb_token m_2ndEmailColumnToken;
  mdb_token m_DefaultEmailColumnToken;
  mdb_token m_CardTypeColumnToken;
  mdb_token m_WorkPhoneColumnToken;
  mdb_token m_HomePhoneColumnToken;
  mdb_token m_FaxColumnToken;
  mdb_token m_PagerColumnToken;
  mdb_token m_CellularColumnToken;
  mdb_token m_WorkPhoneTypeColumnToken;
  mdb_token m_HomePhoneTypeColumnToken;
  mdb_token m_FaxTypeColumnToken;
  mdb_token m_PagerTypeColumnToken;
  mdb_token m_CellularTypeColumnToken;
  mdb_token m_HomeAddressColumnToken;
  mdb_token m_HomeAddress2ColumnToken;
  mdb_token m_HomeCityColumnToken;
  mdb_token m_HomeStateColumnToken;
  mdb_token m_HomeZipCodeColumnToken;
  mdb_token m_HomeCountryColumnToken;
  mdb_token m_WorkAddressColumnToken;
  mdb_token m_WorkAddress2ColumnToken;
  mdb_token m_WorkCityColumnToken;
  mdb_token m_WorkStateColumnToken;
  mdb_token m_WorkZipCodeColumnToken;
  mdb_token m_WorkCountryColumnToken;
  mdb_token m_JobTitleColumnToken;
  mdb_token m_DepartmentColumnToken;
  mdb_token m_CompanyColumnToken;
  mdb_token m_AimScreenNameColumnToken;
  mdb_token m_AnniversaryYearColumnToken;
  mdb_token m_AnniversaryMonthColumnToken;
  mdb_token m_AnniversaryDayColumnToken;
  mdb_token m_SpouseNameColumnToken;
  mdb_token m_FamilyNameColumnToken;
  mdb_token m_DefaultAddressColumnToken;
  mdb_token m_CategoryColumnToken;
  mdb_token m_WebPage1ColumnToken;
  mdb_token m_WebPage2ColumnToken;
  mdb_token m_BirthYearColumnToken;
  mdb_token m_BirthMonthColumnToken;
  mdb_token m_BirthDayColumnToken;
  mdb_token m_Custom1ColumnToken;
  mdb_token m_Custom2ColumnToken;
  mdb_token m_Custom3ColumnToken;
  mdb_token m_Custom4ColumnToken;
  mdb_token m_NotesColumnToken;
  mdb_token m_LastModDateColumnToken;
  mdb_token m_RecordKeyColumnToken;
  mdb_token m_LowerPriEmailColumnToken;
  mdb_token m_Lower2ndEmailColumnToken;

  mdb_token m_MailFormatColumnToken;
  mdb_token m_PopularityIndexColumnToken;

  mdb_token m_AddressCharSetColumnToken;
  mdb_token m_LastRecordKeyColumnToken;

  mdb_token m_ListNameColumnToken;
  mdb_token m_ListNickNameColumnToken;
  mdb_token m_ListDescriptionColumnToken;
  mdb_token m_ListTotalColumnToken;
  mdb_token m_LowerListNameColumnToken;

  nsWeakPtr m_dbDirectory;
  nsCOMPtr<nsIMdbFactory> mMdbFactory;

 private:
  nsresult OpenInternal(nsIFile* aMabFile, bool aCreate,
                        nsIAddrDatabase** pCardDB);
  nsresult AlertAboutCorruptMabFile(const nsString& aOldFileName,
                                    const nsString& aNewFileName);
  nsresult AlertAboutLockedMabFile(const nsString& aFileName);
  nsresult DisplayAlert(const char16_t* titleName,
                        const char16_t* alertStringName,
                        nsTArray<nsString>& formatStrings);
};

#endif
