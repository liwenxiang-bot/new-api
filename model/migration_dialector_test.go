package model

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type MigrationIdentityFields struct {
	ID        int    `gorm:"primaryKey"`
	Name      string `gorm:"size:64;unique"`
	Reference string `gorm:"size:64;uniqueIndex"`
	Provider  string `gorm:"size:32;uniqueIndex:,composite:provider_subject"`
	Subject   string `gorm:"size:64;uniqueIndex:,composite:provider_subject"`
}

type migrationIdentityV1 struct {
	MigrationIdentityFields
	Digest string `gorm:"type:char(32)"`
}

type migrationIdentityV2 struct {
	MigrationIdentityFields
	Digest string `gorm:"type:char(64)"`
	Note   string `gorm:"size:128"`
}

type migrationConstraintV1 struct {
	ID   int    `gorm:"primaryKey"`
	Name string `gorm:"size:64"`
}

type migrationConstraintV2 struct {
	ID   int    `gorm:"primaryKey"`
	Name string `gorm:"size:64;unique"`
}

type migrationDecimalV1 struct {
	ID    int     `gorm:"primaryKey"`
	Price float64 `gorm:"type:decimal(10,6);default:0"`
}

type migrationDecimalV2 struct {
	ID    int     `gorm:"primaryKey"`
	Price float64 `gorm:"type:decimal(12,6);not null;default:0"`
}

type migrationDecimalV3 struct {
	ID    int     `gorm:"primaryKey"`
	Price float64 `gorm:"type:decimal(12,6);not null;default:1.25"`
}

func TestMigrationSchemaStability(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dsn string
			switch dialect {
			case "sqlite":
				dsn = "local"
				previousPath := common.SQLitePath
				common.SQLitePath = filepath.Join(t.TempDir(), "migration.db")
				t.Cleanup(func() { common.SQLitePath = previousPath })
			case "mysql":
				dsn = os.Getenv("TEST_MYSQL_DSN")
			case "postgres":
				dsn = os.Getenv("TEST_POSTGRES_DSN")
			}
			if dsn == "" {
				t.Skip("test database DSN is not configured")
			}
			t.Setenv("MIGRATION_TEST_DSN", dsn)
			db, _, err := chooseDB("MIGRATION_TEST_DSN", false)
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			recorder := &migrationSQLRecorder{}
			db = db.Session(&gorm.Session{Logger: recorder})

			t.Run("identity_and_indexes", func(t *testing.T) {
				const table = "migration_identity_test"
				t.Cleanup(func() { _ = db.Migrator().DropTable(table) })
				require.NoError(t, db.Table(table).AutoMigrate(&migrationIdentityV1{}))
				row := migrationIdentityV1{
					MigrationIdentityFields: MigrationIdentityFields{ID: 1, Name: "root", Reference: "token-reference", Provider: "oidc", Subject: "subject"},
					Digest:                  "old-digest",
				}
				require.NoError(t, db.Table(table).Create(&row).Error)
				recorder.reset()
				require.NoError(t, db.Table(table).AutoMigrate(&migrationIdentityV1{}))
				assert.Empty(t, recorder.schemaMutations())

				require.NoError(t, db.Table(table).AutoMigrate(&migrationIdentityV2{}))
				columns, err := db.Table(table).Migrator().ColumnTypes(&migrationIdentityV2{})
				require.NoError(t, err)
				for _, column := range columns {
					if column.Name() == "digest" {
						length, ok := column.Length()
						require.True(t, ok)
						assert.EqualValues(t, 64, length)
					}
				}
				assert.True(t, db.Table(table).Migrator().HasColumn(&migrationIdentityV2{}, "note"))
				recorder.reset()
				require.NoError(t, db.Table(table).AutoMigrate(&migrationIdentityV2{}))
				assert.Empty(t, recorder.schemaMutations())
				var saved migrationIdentityV2
				require.NoError(t, db.Table(table).First(&saved, 1).Error)
				assert.Equal(t, row.MigrationIdentityFields, saved.MigrationIdentityFields)
				expectedDigest := row.Digest
				if dialect == "postgres" {
					expectedDigest += strings.Repeat(" ", 64-len(row.Digest))
				}
				assert.Equal(t, expectedDigest, saved.Digest)
				for _, duplicate := range []migrationIdentityV2{
					{MigrationIdentityFields: MigrationIdentityFields{Name: "root", Reference: "other-1", Provider: "other", Subject: "1"}},
					{MigrationIdentityFields: MigrationIdentityFields{Name: "other-2", Reference: "token-reference", Provider: "other", Subject: "2"}},
					{MigrationIdentityFields: MigrationIdentityFields{Name: "other-3", Reference: "other-3", Provider: "oidc", Subject: "subject"}},
				} {
					assert.Error(t, db.Table(table).Create(&duplicate).Error)
				}
			})

			t.Run("unique_constraint_changes", func(t *testing.T) {
				const table = "migration_constraint_test"
				t.Cleanup(func() { _ = db.Migrator().DropTable(table) })
				require.NoError(t, db.Table(table).AutoMigrate(&migrationConstraintV1{}))
				require.NoError(t, db.Table(table).Create(&migrationConstraintV1{Name: "existing"}).Error)
				require.NoError(t, db.Table(table).AutoMigrate(&migrationConstraintV2{}))
				assert.Error(t, db.Table(table).Create(&migrationConstraintV2{Name: "existing"}).Error)
				recorder.reset()
				require.NoError(t, db.Table(table).AutoMigrate(&migrationConstraintV2{}))
				assert.Empty(t, recorder.schemaMutations())
				require.NoError(t, db.Table(table).AutoMigrate(&migrationConstraintV1{}))
				require.NoError(t, db.Table(table).Create(&migrationConstraintV1{Name: "existing"}).Error)
			})

			if dialect == "postgres" {
				t.Run("renamed_unique_constraints", func(t *testing.T) {
					const table = "migration_renamed_unique"
					t.Cleanup(func() { _ = db.Migrator().DropTable(table) })
					tableDB := db.Table(table).Session(&gorm.Session{})
					require.NoError(t, tableDB.AutoMigrate(&migrationConstraintV1{}))
					original := migrationConstraintV1{Name: "existing"}
					require.NoError(t, tableDB.Create(&original).Error)
					for _, name := range []string{"models_model_name_key", `imported "model" name`} {
						require.NoError(t, db.Exec("ALTER TABLE ? ADD CONSTRAINT ? UNIQUE (name)", clause.Table{Name: table}, clause.Column{Name: name}).Error)
					}
					require.NoError(t, db.Exec("ALTER TABLE ? ADD CONSTRAINT keep_composite UNIQUE (id, name)", clause.Table{Name: table}).Error)
					require.NoError(t, db.Exec("CREATE INDEX keep_name_lookup ON ? (name)", clause.Table{Name: table}).Error)
					// A unique field must keep the old names and still reject duplicates.
					require.NoError(t, tableDB.AutoMigrate(&migrationConstraintV2{}))
					require.Error(t, tableDB.Create(&migrationConstraintV2{Name: "existing"}).Error)
					require.NoError(t, db.Exec("CREATE TABLE migration_unique_reference (name varchar(64) REFERENCES migration_renamed_unique(name))").Error)
					t.Cleanup(func() { _ = db.Migrator().DropTable("migration_unique_reference") })
					require.NoError(t, db.Exec("INSERT INTO migration_unique_reference (name) VALUES (?)", "existing").Error)
					require.Error(t, tableDB.AutoMigrate(&migrationConstraintV1{}), "dependent foreign keys must not be cascaded away")
					for _, name := range []string{"models_model_name_key", `imported "model" name`} {
						assert.True(t, tableDB.Migrator().HasConstraint(&migrationConstraintV1{}, name), "all old constraints must survive rollback")
					}
					var references int64
					require.NoError(t, db.Table("migration_unique_reference").Count(&references).Error)
					assert.EqualValues(t, 1, references)
					require.NoError(t, db.Migrator().DropTable("migration_unique_reference"))
					// Removing column uniqueness must resolve both actual constraint names.
					require.NoError(t, tableDB.AutoMigrate(&migrationConstraintV1{}))
					recorder.reset()
					require.NoError(t, tableDB.AutoMigrate(&migrationConstraintV1{}))
					assert.Empty(t, recorder.schemaMutations())
					require.NoError(t, tableDB.Create(&migrationConstraintV1{Name: "existing"}).Error)
					assert.True(t, tableDB.Migrator().HasConstraint(&migrationConstraintV1{}, "keep_composite"))
					assert.True(t, tableDB.Migrator().HasIndex(&migrationConstraintV1{}, "keep_name_lookup"))
					var rows []migrationConstraintV1
					require.NoError(t, tableDB.Order("id").Find(&rows).Error)
					require.Len(t, rows, 2)
					assert.Equal(t, original, rows[0])
				})
			}

			if dialect == "mysql" {
				t.Run("decimal_default_and_real_changes", func(t *testing.T) {
					const table = "migration_decimal_test"
					t.Cleanup(func() { _ = db.Migrator().DropTable(table) })
					require.NoError(t, db.Table(table).AutoMigrate(&migrationDecimalV1{}))
					require.NoError(t, db.Table(table).Create(&migrationDecimalV1{ID: 1, Price: 12.345678}).Error)
					for _, target := range []any{&migrationDecimalV1{}, &migrationDecimalV2{}, &migrationDecimalV3{}} {
						require.NoError(t, db.Table(table).AutoMigrate(target))
						recorder.reset()
						require.NoError(t, db.Table(table).AutoMigrate(target))
						assert.Empty(t, recorder.schemaMutations())
					}
					columns, err := db.Table(table).Migrator().ColumnTypes(&migrationDecimalV3{})
					require.NoError(t, err)
					for _, column := range columns {
						if column.Name() == "price" {
							precision, scale, ok := column.DecimalSize()
							require.True(t, ok)
							assert.EqualValues(t, 12, precision)
							assert.EqualValues(t, 6, scale)
							nullable, ok := column.Nullable()
							require.True(t, ok)
							assert.False(t, nullable)
						}
					}
					require.NoError(t, db.Table(table).Create(&map[string]any{"id": 2}).Error)
					var prices []float64
					require.NoError(t, db.Table(table).Order("id").Pluck("price", &prices).Error)
					assert.Equal(t, []float64{12.345678, 1.25}, prices)
				})
			}
		})
	}
}

func TestAffiliateRewardDatabaseMatrix(t *testing.T) {
	prepareAffiliateRewardTest(t)
	previousDB, previousLogDB := DB, LOG_DB
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis, previousBatch := common.RedisEnabled, common.BatchUpdateEnabled
	previousPolicy := requestPolicySnapshot.Load()
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		common.RedisEnabled, common.BatchUpdateEnabled = previousRedis, previousBatch
		requestPolicySnapshot.Store(previousPolicy)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
		initCol()
	})
	common.RedisEnabled, common.BatchUpdateEnabled = false, false

	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dsn string
			switch dialect {
			case "sqlite":
				dsn = "local"
				previousPath := common.SQLitePath
				common.SQLitePath = filepath.Join(t.TempDir(), "affiliate.db")
				t.Cleanup(func() { common.SQLitePath = previousPath })
			case "mysql":
				dsn = os.Getenv("TEST_MYSQL_DSN")
			case "postgres":
				dsn = os.Getenv("TEST_POSTGRES_DSN")
			}
			if dsn == "" {
				t.Skip("test database DSN is not configured")
			}
			t.Setenv("AFFILIATE_MATRIX_DSN", dsn)
			db, dbType, err := chooseDB("AFFILIATE_MATRIX_DSN", false)
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			sqlDB.SetMaxOpenConns(1)
			recorder := &migrationSQLRecorder{}
			db = db.Session(&gorm.Session{Logger: recorder})
			DB, LOG_DB = db, db
			common.SetDatabaseTypes(dbType, dbType)
			initCol()
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)

			for _, scenario := range []string{"fresh", "upgrade"} {
				t.Run(scenario, func(t *testing.T) {
					common.AffiliateRewardMinTransfer = 1
					models := []any{&User{}, &TopUp{}, &Log{}, &AffiliateReward{}, &Option{}}
					for _, model := range models {
						require.False(t, db.Migrator().HasTable(model), "use an empty dedicated test database")
					}
					t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(models...)) })
					// User, TopUp and Log schema match release v1.0.0-rc.40
					// (0aec08fee811ec6136828fda790551b49e410301).
					// The upgrade fixture has real existing balances and a paid order,
					// with no affiliate ledger until the new migration runs.
					if scenario == "upgrade" {
						require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}, &Log{}, &Option{}))
					} else {
						require.NoError(t, db.AutoMigrate(models...))
					}
					inviter := createAffiliateRewardTestUser(t, 701, "matrix-inviter", 0)
					invitee := createAffiliateRewardTestUser(t, 702, "matrix-invitee", inviter.Id)
					require.NoError(t, db.Model(inviter).Updates(map[string]any{
						"quota": 75, "aff_quota": 30, "aff_history": 90, "aff_count": 2,
					}).Error)
					require.NoError(t, db.Model(invitee).Update("quota", 25).Error)
					originalInviter := getAffiliateRewardTestUser(t, inviter.Id)
					originalInvitee := getAffiliateRewardTestUser(t, invitee.Id)
					historical := createAffiliateRewardTestTopUp(t, invitee.Id, "MATRIX-HISTORICAL", PaymentProviderEpay, 20)
					historical.Status = common.TopUpStatusSuccess
					historical.CompleteTime = historical.CreateTime
					require.NoError(t, db.Save(&historical).Error)

					require.NoError(t, db.AutoMigrate(models...))
					recorder.reset()
					require.NoError(t, db.AutoMigrate(models...))
					assert.Empty(t, recorder.schemaMutations(), "second migration must not change schema")
					require.NoError(t, ensureUserQuotaColumns(db, dbType))
					assert.Equal(t, originalInviter, getAffiliateRewardTestUser(t, inviter.Id))
					assert.Equal(t, originalInvitee, getAffiliateRewardTestUser(t, invitee.Id))
					var savedOrder TopUp
					require.NoError(t, db.First(&savedOrder, historical.Id).Error)
					assert.Equal(t, historical, savedOrder)
					assert.True(t, db.Migrator().HasIndex(&AffiliateReward{}, "idx_affiliate_reward_topup_type"))
					duplicateUser := originalInviter
					duplicateUser.Id, duplicateUser.AffCode = 0, "different-affiliate-code"
					assert.Error(t, db.Create(&duplicateUser).Error, "username uniqueness must survive migration")
					duplicateUser = originalInviter
					duplicateUser.Id, duplicateUser.Username = 0, "different-username"
					assert.Error(t, db.Create(&duplicateUser).Error, "referral-code uniqueness must survive migration")
					duplicateOrder := historical
					duplicateOrder.Id = 0
					assert.Error(t, db.Create(&duplicateOrder).Error, "payment order uniqueness must survive migration")

					alreadyDone, err := RechargeEpay(historical.TradeNo, "alipay", "127.0.0.1")
					require.NoError(t, err)
					assert.True(t, alreadyDone)
					assert.Zero(t, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission), "old paid orders must not earn rewards retroactively")
					first := createAffiliateRewardTestTopUp(t, invitee.Id, "MATRIX-FIRST", PaymentProviderEpay, 20)
					alreadyDone, err = RechargeEpay(first.TradeNo, "alipay", "127.0.0.1")
					require.NoError(t, err)
					assert.False(t, alreadyDone)
					gotInviter := getAffiliateRewardTestUser(t, inviter.Id)
					gotInvitee := getAffiliateRewardTestUser(t, invitee.Id)
					assert.Equal(t, 230, gotInviter.AffQuota, "existing balance plus 10%% of a 2000-quota recharge")
					assert.Equal(t, 290, gotInviter.AffHistoryQuota)
					assert.Equal(t, 3, gotInviter.AffCount)
					assert.Equal(t, 75, gotInviter.Quota, "commission stays in the affiliate balance")
					assert.Equal(t, 2075, gotInvitee.Quota)
					assert.EqualValues(t, 1, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
					assert.EqualValues(t, 1, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))
					alreadyDone, err = RechargeEpay(first.TradeNo, "alipay", "127.0.0.1")
					require.NoError(t, err)
					assert.True(t, alreadyDone)
					assert.Equal(t, gotInviter, getAffiliateRewardTestUser(t, inviter.Id))
					assert.Equal(t, gotInvitee, getAffiliateRewardTestUser(t, invitee.Id))

					var reward AffiliateReward
					require.NoError(t, db.Where("top_up_id = ? AND reward_type = ?", first.Id, affiliateRewardTypeCommission).First(&reward).Error)
					reward.Id = 0
					assert.Error(t, db.Create(&reward).Error, "the database must reject a duplicate top-up reward")
					second := createAffiliateRewardTestTopUp(t, invitee.Id, "MATRIX-SECOND", PaymentProviderEpay, 20)
					alreadyDone, err = RechargeEpay(second.TradeNo, "alipay", "127.0.0.1")
					require.NoError(t, err)
					assert.False(t, alreadyDone)
					gotInviter = getAffiliateRewardTestUser(t, inviter.Id)
					assert.Equal(t, 430, gotInviter.AffQuota)
					assert.Equal(t, 490, gotInviter.AffHistoryQuota)
					assert.Equal(t, 3, gotInviter.AffCount)
					assert.Equal(t, 4075, getAffiliateRewardTestUser(t, invitee.Id).Quota)
					assert.EqualValues(t, 2, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
					assert.EqualValues(t, 1, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))
					assert.Equal(t, 1, GetAffiliateQualifiedInviteCount(inviter.Id))
					var earnedRewards []AffiliateReward
					require.NoError(t, db.Order("id").Find(&earnedRewards).Error)
					recorder.reset()
					require.NoError(t, db.AutoMigrate(models...))
					assert.Empty(t, recorder.schemaMutations(), "restart after settlement must not change schema")
					var persistedRewards []AffiliateReward
					require.NoError(t, db.Order("id").Find(&persistedRewards).Error)
					assert.Equal(t, earnedRewards, persistedRewards)
					require.Len(t, persistedRewards, 3)
					firstReward, secondReward := persistedRewards[0], persistedRewards[2]
					for _, historyCase := range []struct {
						userID int
						offset int
						total  int64
						items  []AffiliateRewardHistoryItem
					}{
						{inviter.Id, 0, 2, []AffiliateRewardHistoryItem{{Id: secondReward.Id, InviteeId: invitee.Id, Quota: 200, CreatedAt: secondReward.CreatedAt}}},
						{inviter.Id, 1, 2, []AffiliateRewardHistoryItem{{Id: firstReward.Id, InviteeId: invitee.Id, Quota: 200, CreatedAt: firstReward.CreatedAt}}},
						{inviter.Id, 2, 2, []AffiliateRewardHistoryItem{}},
						{invitee.Id, 0, 0, []AffiliateRewardHistoryItem{}},
						{799, 0, 0, []AffiliateRewardHistoryItem{}},
					} {
						items, total, err := GetAffiliateRewardHistory(historyCase.userID, historyCase.offset, 1)
						require.NoError(t, err)
						assert.Equal(t, historyCase.total, total)
						assert.Equal(t, historyCase.items, items, "history must paginate only the requesting inviter's commissions")
					}

					require.NoError(t, UpdateOption("AffiliateRewardMinTransfer", "2.01"))
					var savedMinimum Option
					require.NoError(t, db.Where(map[string]any{"key": "AffiliateRewardMinTransfer"}).First(&savedMinimum).Error)
					assert.Equal(t, "2.01", savedMinimum.Value)
					common.AffiliateRewardMinTransfer = 0
					loadOptionsFromDatabase()
					loadOptionsFromDatabase()
					assert.Equal(t, 2.01, common.AffiliateRewardMinTransfer, "a persisted threshold must survive repeated option reloads")
					assert.Error(t, gotInviter.TransferAffQuotaToQuota(200), "a changed threshold must apply before a transfer")
					assert.Equal(t, gotInviter, getAffiliateRewardTestUser(t, inviter.Id), "a below-threshold transfer must leave balances unchanged")
					require.NoError(t, UpdateOption("AffiliateRewardMinTransfer", "2"))
					common.AffiliateRewardMinTransfer = 0
					loadOptionsFromDatabase()
					assert.Equal(t, 2.0, common.AffiliateRewardMinTransfer)

					expected := gotInviter
					expected.Quota += 200
					expected.AffQuota -= 200
					require.NoError(t, gotInviter.TransferAffQuotaToQuota(200))
					transferred := getAffiliateRewardTestUser(t, inviter.Id)
					assert.Equal(t, 275, transferred.Quota)
					assert.Equal(t, 230, transferred.AffQuota)
					assert.Equal(t, 490, transferred.AffHistoryQuota)
					assert.Equal(t, 3, transferred.AffCount)
					assert.Equal(t, expected, transferred)
					for _, quota := range []int{300, 0, -100, common.MaxWalletQuota + 1} {
						assert.Error(t, gotInviter.TransferAffQuotaToQuota(quota))
						assert.Equal(t, transferred, getAffiliateRewardTestUser(t, inviter.Id), "a rejected transfer must leave all balances unchanged")
					}
					sqlDB.SetMaxOpenConns(2)
					start := make(chan struct{})
					results := make(chan error, 2)
					for range 2 {
						go func() {
							user := User{Id: inviter.Id}
							<-start
							results <- user.TransferAffQuotaToQuota(200)
						}()
					}
					close(start)
					transferErrors := []error{<-results, <-results}
					successes := 0
					for _, err := range transferErrors {
						if err == nil {
							successes++
						}
					}
					assert.Equal(t, 1, successes, "only one competing transfer fits the balance: %v", transferErrors)
					concurrentResult := getAffiliateRewardTestUser(t, inviter.Id)
					assert.Equal(t, transferred.Quota+transferred.AffQuota, concurrentResult.Quota+concurrentResult.AffQuota)
					expected.Quota += 200
					expected.AffQuota -= 200
					assert.Equal(t, expected, concurrentResult)
					sqlDB.SetMaxOpenConns(1)
					var logCount int64
					require.NoError(t, db.Model(&Log{}).Where("type = ?", LogTypeTopup).Count(&logCount).Error)
					assert.EqualValues(t, 2, logCount, "only new successful recharges write top-up logs")
				})
			}
		})
	}
}
