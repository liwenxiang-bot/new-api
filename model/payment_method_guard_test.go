package model

import (
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertUserForPaymentGuardTest(t *testing.T, id int, quota int) *User {
	t.Helper()
	user := &User{
		Id:       id,
		Username: "payment_guard_user",
		Status:   common.UserStatusEnabled,
		Quota:    quota,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func insertSubscriptionPlanForPaymentGuardTest(t *testing.T, id int) *SubscriptionPlan {
	t.Helper()
	plan := &SubscriptionPlan{
		Id:            id,
		Title:         "Guard Plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func insertSubscriptionOrderForPaymentGuardTest(t *testing.T, tradeNo string, userID int, planID int, paymentProvider string) {
	t.Helper()
	order := &SubscriptionOrder{
		UserId:          userID,
		PlanId:          planID,
		Money:           9.99,
		TradeNo:         tradeNo,
		PaymentMethod:   paymentProvider,
		PaymentProvider: paymentProvider,
		Status:          common.TopUpStatusPending,
		CreateTime:      time.Now().Unix(),
	}
	require.NoError(t, order.Insert())
}

func insertTopUpForPaymentGuardTest(t *testing.T, tradeNo string, userID int, paymentProvider string) {
	t.Helper()
	topUp := &TopUp{
		UserId:          userID,
		Amount:          2,
		Money:           9.99,
		TradeNo:         tradeNo,
		PaymentMethod:   paymentProvider,
		PaymentProvider: paymentProvider,
		Status:          common.TopUpStatusPending,
		CreateTime:      time.Now().Unix(),
	}
	require.NoError(t, topUp.Insert())
}

func getTopUpStatusForPaymentGuardTest(t *testing.T, tradeNo string) string {
	t.Helper()
	topUp := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, topUp)
	return topUp.Status
}

func countUserSubscriptionsForPaymentGuardTest(t *testing.T, userID int) int64 {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", userID).Count(&count).Error)
	return count
}

func getUserQuotaForPaymentGuardTest(t *testing.T, userID int) int {
	t.Helper()
	var user User
	require.NoError(t, DB.Select("quota").Where("id = ?", userID).First(&user).Error)
	return user.Quota
}

func TestAffiliateRewardHistoryScopesAndPaginatesCommissionRecords(t *testing.T) {
	truncateTables(t)
	records := []AffiliateReward{
		{TopUpId: 1, InviterId: 10, InviteeId: 20, RecipientId: 10, RewardType: affiliateRewardTypeCommission, Quota: 100, CreatedAt: 1000},
		{TopUpId: 2, InviterId: 11, InviteeId: 21, RecipientId: 11, RewardType: affiliateRewardTypeCommission, Quota: 200, CreatedAt: 1001},
		{TopUpId: 1, InviterId: 10, InviteeId: 20, RecipientId: 20, RewardType: affiliateRewardTypeInvitee, Quota: 50, CreatedAt: 1000},
		{TopUpId: 3, InviterId: 10, InviteeId: 22, RecipientId: 10, RewardType: affiliateRewardTypeCommission, Quota: 300, CreatedAt: 1002},
	}
	require.NoError(t, DB.Create(&records).Error)
	items, total, err := GetAffiliateRewardHistory(10, 0, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	assert.Equal(t, []AffiliateRewardHistoryItem{{Id: records[3].Id, InviteeId: 22, Quota: 300, CreatedAt: 1002}}, items)
	items, total, err = GetAffiliateRewardHistory(10, 1, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	assert.Equal(t, []AffiliateRewardHistoryItem{{Id: records[0].Id, InviteeId: 20, Quota: 100, CreatedAt: 1000}}, items)
	items, total, err = GetAffiliateRewardHistory(99, 0, 10)
	require.NoError(t, err)
	assert.Empty(t, items)
	assert.Zero(t, total)
}

func prepareAffiliateRewardTest(t *testing.T) {
	t.Helper()
	setting := operation_setting.GetPaymentSetting()
	originalConfirmed := setting.ComplianceConfirmed
	originalTermsVersion := setting.ComplianceTermsVersion
	originalEnabled := common.AffiliateRewardEnabled
	originalRatio := common.AffiliateRewardRatio
	originalMinimum := common.AffiliateRewardMinTopUp
	originalInviterReward := common.QuotaForInviter
	originalInviteeReward := common.QuotaForInvitee
	originalQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		setting.ComplianceConfirmed = originalConfirmed
		setting.ComplianceTermsVersion = originalTermsVersion
		common.AffiliateRewardEnabled = originalEnabled
		common.AffiliateRewardRatio = originalRatio
		common.AffiliateRewardMinTopUp = originalMinimum
		common.QuotaForInviter = originalInviterReward
		common.QuotaForInvitee = originalInviteeReward
		common.QuotaPerUnit = originalQuotaPerUnit
	})
	setting.ComplianceConfirmed = true
	setting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	common.AffiliateRewardEnabled = true
	common.AffiliateRewardRatio = 10
	common.AffiliateRewardMinTopUp = 10
	common.QuotaForInvitee = 50
	common.QuotaPerUnit = 100
}

func createAffiliateRewardTestUser(t *testing.T, id int, username string, inviterID int) *User {
	t.Helper()
	user := &User{
		Id:        id,
		Username:  username,
		Status:    common.UserStatusEnabled,
		InviterId: inviterID,
		AffCode:   fmt.Sprintf("affiliate-code-%d", id),
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func createAffiliateRewardTestTopUp(t *testing.T, userID int, tradeNo string, provider string, amount int64) TopUp {
	t.Helper()
	topUp := TopUp{
		UserId:          userID,
		Amount:          amount,
		Money:           float64(amount),
		TradeNo:         tradeNo,
		PaymentMethod:   provider,
		PaymentProvider: provider,
		CreateTime:      common.GetTimestamp(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
	return topUp
}

func getAffiliateRewardTestUser(t *testing.T, userID int) User {
	t.Helper()
	var user User
	require.NoError(t, DB.First(&user, userID).Error)
	return user
}

func countAffiliateRewards(t *testing.T, inviteeID int, rewardType string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("invitee_id = ? AND reward_type = ?", inviteeID, rewardType).Count(&count).Error)
	return count
}

func TestAffiliateTopUpRewardPercentageAndIdempotency(t *testing.T) {
	truncateTables(t)
	prepareAffiliateRewardTest(t)

	inviter := createAffiliateRewardTestUser(t, 601, "affiliate-inviter", 0)
	invitee := createAffiliateRewardTestUser(t, 602, "affiliate-invitee", inviter.Id)
	first := createAffiliateRewardTestTopUp(t, invitee.Id, "AFFILIATE-REWARD-1", PaymentProviderEpay, 20)

	alreadyDone, err := RechargeEpay(first.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)

	gotInviter := getAffiliateRewardTestUser(t, inviter.Id)
	gotInvitee := getAffiliateRewardTestUser(t, invitee.Id)
	assert.Equal(t, 200, gotInviter.AffQuota, "10%% of 20*100 quota")
	assert.Equal(t, 200, gotInviter.AffHistoryQuota)
	assert.Equal(t, 1, gotInviter.AffCount)
	assert.Equal(t, 2050, gotInvitee.Quota, "top-up plus one-time invitee reward")
	assert.Equal(t, int64(1), countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
	assert.Equal(t, int64(1), countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))

	alreadyDone, err = RechargeEpay(first.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	gotInviter = getAffiliateRewardTestUser(t, inviter.Id)
	gotInvitee = getAffiliateRewardTestUser(t, invitee.Id)
	assert.Equal(t, 200, gotInviter.AffQuota)
	assert.Equal(t, 2050, gotInvitee.Quota)

	second := createAffiliateRewardTestTopUp(t, invitee.Id, "AFFILIATE-REWARD-2", PaymentProviderEpay, 20)
	_, err = RechargeEpay(second.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	gotInviter = getAffiliateRewardTestUser(t, inviter.Id)
	assert.Equal(t, 400, gotInviter.AffQuota)
	assert.Equal(t, 1, gotInviter.AffCount, "one invitee counts once across recurring top-ups")
	assert.Equal(t, int64(2), countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
	assert.Equal(t, 1, GetAffiliateQualifiedInviteCount(inviter.Id))
	assert.Equal(t, 4050, getAffiliateRewardTestUser(t, invitee.Id).Quota)
	assert.Equal(t, int64(1), countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))
}

func TestAffiliateTransferConservesBalancesAndUpdatesCache(t *testing.T) {
	truncateTables(t)
	prepareAffiliateRewardTest(t)
	useUserCacheMiniRedis(t)
	user := createAffiliateRewardTestUser(t, 630, "affiliate-transfer", 0)
	require.NoError(t, DB.Model(user).Updates(map[string]any{"quota": 200, "aff_quota": 300, "aff_history": 700}).Error)
	*user = getAffiliateRewardTestUser(t, user.Id)
	require.NoError(t, populateUserCache(*user))

	require.NoError(t, user.TransferAffQuotaToQuota(300))
	stored := getAffiliateRewardTestUser(t, user.Id)
	assert.Equal(t, 500, stored.Quota)
	assert.Zero(t, stored.AffQuota)
	assert.Equal(t, 700, stored.AffHistoryQuota)
	assert.Equal(t, 500, stored.Quota+stored.AffQuota)
	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, stored.Quota, cached.Quota)

	require.Error(t, user.TransferAffQuotaToQuota(300), "spent rewards cannot be transferred again")
	stored = getAffiliateRewardTestUser(t, user.Id)
	assert.Equal(t, 500, stored.Quota)
	assert.Zero(t, stored.AffQuota)
	cached, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 500, cached.Quota)
}

func TestAffiliateTransferEnforcesWalletLimit(t *testing.T) {
	for _, tc := range []struct {
		name    string
		wallet  int
		amount  int
		wantErr bool
	}{
		{name: "exact wallet limit", wallet: common.MaxWalletQuota - 100, amount: 100},
		{name: "exceeds wallet limit", wallet: common.MaxWalletQuota - 99, amount: 100, wantErr: true},
		{name: "negative transfer", wallet: 100, amount: -100, wantErr: true},
		{name: "zero transfer", wallet: 100, amount: 0, wantErr: true},
		{name: "below minimum", wallet: 100, amount: 99, wantErr: true},
		{name: "out of range transfer", wallet: 100, amount: common.MaxWalletQuota + 1, wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			prepareAffiliateRewardTest(t)
			user := createAffiliateRewardTestUser(t, 631, "affiliate-transfer-limit", 0)
			require.NoError(t, DB.Model(user).Updates(map[string]any{"quota": tc.wallet, "aff_quota": 100, "aff_history": 100}).Error)
			err := user.TransferAffQuotaToQuota(tc.amount)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			stored := getAffiliateRewardTestUser(t, user.Id)
			if tc.wantErr {
				assert.Equal(t, tc.wallet, stored.Quota)
				assert.Equal(t, 100, stored.AffQuota)
			} else {
				assert.Equal(t, common.MaxWalletQuota, stored.Quota)
				assert.Zero(t, stored.AffQuota)
			}
			assert.Equal(t, 100, stored.AffHistoryQuota)
		})
	}
}

func TestAffiliateOptionalRewardLimitsDoNotBlockTopUp(t *testing.T) {
	for _, tc := range []struct {
		name             string
		inviteeQuota     int
		inviteeReward    int
		inviterQuota     int
		wantInviteeQuota int
		wantInviterQuota int
		wantBonusCount   int64
		wantRewardCount  int64
	}{
		{name: "invitee wallet at limit", inviteeQuota: common.MaxWalletQuota - 2000, inviteeReward: 50, wantInviteeQuota: common.MaxWalletQuota, wantInviterQuota: 200, wantRewardCount: 1},
		{name: "invitee reward out of range", inviteeReward: common.MaxWalletQuota + 1, wantInviteeQuota: 2000, wantInviterQuota: 200, wantRewardCount: 1},
		{name: "inviter reward wallet at limit", inviterQuota: common.MaxWalletQuota, inviteeReward: 50, wantInviteeQuota: 2050, wantInviterQuota: common.MaxWalletQuota, wantBonusCount: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			prepareAffiliateRewardTest(t)
			common.QuotaForInvitee = tc.inviteeReward
			inviter := createAffiliateRewardTestUser(t, 641, "affiliate-limit-inviter", 0)
			invitee := createAffiliateRewardTestUser(t, 642, "affiliate-limit-invitee", inviter.Id)
			require.NoError(t, DB.Model(inviter).Updates(map[string]any{"aff_quota": tc.inviterQuota, "aff_history": tc.inviterQuota}).Error)
			require.NoError(t, DB.Model(invitee).Update("quota", tc.inviteeQuota).Error)
			order := createAffiliateRewardTestTopUp(t, invitee.Id, "AFFILIATE-OPTIONAL-LIMIT", PaymentProviderEpay, 20)
			_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
			require.NoError(t, err)
			assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
			assert.Equal(t, tc.wantInviteeQuota, getAffiliateRewardTestUser(t, invitee.Id).Quota)
			assert.Equal(t, tc.wantInviterQuota, getAffiliateRewardTestUser(t, inviter.Id).AffQuota)
			assert.Equal(t, tc.wantBonusCount, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))
			assert.Equal(t, tc.wantRewardCount, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
		})
	}
}

func TestAffiliateInvalidConfigurationDoesNotBlockTopUp(t *testing.T) {
	for _, tc := range []struct {
		name    string
		ratio   float64
		minimum float64
	}{
		{name: "NaN rate", ratio: math.NaN(), minimum: 10},
		{name: "infinite rate", ratio: math.Inf(1), minimum: 10},
		{name: "negative infinite rate", ratio: math.Inf(-1), minimum: 10},
		{name: "rate above limit", ratio: 101, minimum: 10},
		{name: "NaN minimum", ratio: 10, minimum: math.NaN()},
		{name: "infinite minimum", ratio: 10, minimum: math.Inf(1)},
		{name: "negative minimum", ratio: 10, minimum: -1},
		{name: "minimum conversion overflow", ratio: 10, minimum: math.MaxFloat64},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			prepareAffiliateRewardTest(t)
			common.AffiliateRewardRatio = tc.ratio
			common.AffiliateRewardMinTopUp = tc.minimum
			inviter := createAffiliateRewardTestUser(t, 651, "affiliate-config-inviter", 0)
			invitee := createAffiliateRewardTestUser(t, 652, "affiliate-config-invitee", inviter.Id)
			order := createAffiliateRewardTestTopUp(t, invitee.Id, "AFFILIATE-INVALID-CONFIG", PaymentProviderEpay, 20)
			_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
			require.NoError(t, err)
			assert.Equal(t, common.TopUpStatusSuccess, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
			assert.Equal(t, 2000, getAffiliateRewardTestUser(t, invitee.Id).Quota)
			assert.Zero(t, getAffiliateRewardTestUser(t, inviter.Id).AffQuota)
			assert.Zero(t, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))
			assert.Zero(t, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
		})
	}
}

func TestAffiliateRejectsInvalidQuotaUnitWithoutMutation(t *testing.T) {
	for _, tc := range []struct {
		name string
		unit float64
	}{
		{name: "NaN", unit: math.NaN()},
		{name: "infinite", unit: math.Inf(1)},
		{name: "zero", unit: 0},
		{name: "negative", unit: -1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			prepareAffiliateRewardTest(t)
			user := createAffiliateRewardTestUser(t, 655, "affiliate-invalid-unit", 0)
			require.NoError(t, DB.Model(user).Updates(map[string]any{"quota": 200, "aff_quota": 100}).Error)
			order := createAffiliateRewardTestTopUp(t, user.Id, "AFFILIATE-INVALID-UNIT", PaymentProviderEpay, 20)
			common.QuotaPerUnit = tc.unit
			_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
			require.ErrorIs(t, err, ErrInvalidTopUpQuota)
			require.Error(t, user.TransferAffQuotaToQuota(100))
			stored := getAffiliateRewardTestUser(t, user.Id)
			assert.Equal(t, 200, stored.Quota)
			assert.Equal(t, 100, stored.AffQuota)
			assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
		})
	}
}

func TestAffiliateTopUpProviderUnits(t *testing.T) {
	for _, tc := range []struct {
		provider string
		amount   int64
		money    float64
		quota    int
	}{
		{provider: PaymentProviderEpay, amount: 20, money: 15, quota: 2000},
		{provider: PaymentProviderStripe, amount: 20, money: 15, quota: 1500},
		{provider: PaymentProviderCreem, amount: 2000, money: 15, quota: 2000},
		{provider: PaymentProviderWaffo, amount: 20, money: 15, quota: 2000},
		{provider: PaymentProviderWaffoPancake, amount: 20, money: 15, quota: 2000},
	} {
		for _, completion := range []string{"callback", "manual"} {
			t.Run(tc.provider+"/"+completion, func(t *testing.T) {
				truncateTables(t)
				prepareAffiliateRewardTest(t)
				inviter := createAffiliateRewardTestUser(t, 661, "affiliate-provider-inviter", 0)
				invitee := createAffiliateRewardTestUser(t, 662, "affiliate-provider-invitee", inviter.Id)
				order := createAffiliateRewardTestTopUp(t, invitee.Id, "AFFILIATE-PROVIDER-UNITS", tc.provider, tc.amount)
				require.NoError(t, DB.Model(&order).Update("money", tc.money).Error)
				if completion == "manual" {
					require.NoError(t, ManualCompleteTopUp(order.TradeNo, "127.0.0.1"))
				} else {
					switch tc.provider {
					case PaymentProviderEpay:
						_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
						require.NoError(t, err)
					case PaymentProviderStripe:
						require.NoError(t, Recharge(order.TradeNo, "customer-id", "127.0.0.1"))
					case PaymentProviderCreem:
						require.NoError(t, RechargeCreem(order.TradeNo, "", "", "127.0.0.1"))
					case PaymentProviderWaffo:
						require.NoError(t, RechargeWaffo(order.TradeNo, "127.0.0.1"))
					case PaymentProviderWaffoPancake:
						require.NoError(t, RechargeWaffoPancake(order.TradeNo))
					}
				}
				assert.Equal(t, tc.quota+50, getAffiliateRewardTestUser(t, invitee.Id).Quota)
				assert.Equal(t, tc.quota/10, getAffiliateRewardTestUser(t, inviter.Id).AffQuota)
				require.NoError(t, ManualCompleteTopUp(order.TradeNo, "127.0.0.1"))
				assert.Equal(t, tc.quota+50, getAffiliateRewardTestUser(t, invitee.Id).Quota)
				assert.Equal(t, int64(1), countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
				assert.Equal(t, int64(1), countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))
			})
		}
	}
}

func TestAffiliateTopUpRewardSkipsBelowMinimum(t *testing.T) {
	truncateTables(t)
	prepareAffiliateRewardTest(t)

	inviter := createAffiliateRewardTestUser(t, 611, "affiliate-minimum-inviter", 0)
	invitee := createAffiliateRewardTestUser(t, 612, "affiliate-minimum-invitee", inviter.Id)
	topUp := createAffiliateRewardTestTopUp(t, invitee.Id, "AFFILIATE-REWARD-MINIMUM", PaymentProviderEpay, 5)

	_, err := RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, 0, getAffiliateRewardTestUser(t, inviter.Id).AffQuota)
	assert.Equal(t, 500, getAffiliateRewardTestUser(t, invitee.Id).Quota)
	assert.Zero(t, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
	assert.Zero(t, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))
}

func TestAffiliatePercentageModeDoesNotRewardRegistrationAlone(t *testing.T) {
	truncateTables(t)
	prepareAffiliateRewardTest(t)
	common.QuotaForInviter = 100

	inviter := createAffiliateRewardTestUser(t, 616, "affiliate-registration-inviter", 0)
	invitee := createAffiliateRewardTestUser(t, 617, "affiliate-registration-invitee", 0)

	invitee.FinishInsert(inviter.Id)

	assert.Equal(t, 0, getAffiliateRewardTestUser(t, inviter.Id).AffQuota)
	assert.Equal(t, 0, getAffiliateRewardTestUser(t, inviter.Id).AffCount)
	assert.Equal(t, 0, getAffiliateRewardTestUser(t, invitee.Id).Quota)
}

func TestAffiliateTopUpRewardRejectsNonCashManualTopUp(t *testing.T) {
	truncateTables(t)
	prepareAffiliateRewardTest(t)

	inviter := createAffiliateRewardTestUser(t, 621, "affiliate-noncash-inviter", 0)
	invitee := createAffiliateRewardTestUser(t, 622, "affiliate-noncash-invitee", inviter.Id)
	topUp := createAffiliateRewardTestTopUp(t, invitee.Id, "AFFILIATE-REWARD-BALANCE", PaymentProviderBalance, 20)

	require.NoError(t, ManualCompleteTopUp(topUp.TradeNo, "127.0.0.1"))
	assert.Equal(t, 0, getAffiliateRewardTestUser(t, inviter.Id).AffQuota)
	assert.Equal(t, 2000, getAffiliateRewardTestUser(t, invitee.Id).Quota)
	assert.Zero(t, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeCommission))
	assert.Zero(t, countAffiliateRewards(t, invitee.Id, affiliateRewardTypeInvitee))
}

func TestRechargeWaffoPancake_RejectsMismatchedPaymentMethod(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 101, 0)
	insertTopUpForPaymentGuardTest(t, "waffo-pancake-guard", 101, PaymentProviderStripe)

	err := RechargeWaffoPancake("waffo-pancake-guard")
	require.Error(t, err)

	topUp := GetTopUpByTradeNo("waffo-pancake-guard")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, 101))
}

func TestUpdatePendingTopUpStatus_RejectsMismatchedPaymentProvider(t *testing.T) {
	testCases := []struct {
		name                    string
		tradeNo                 string
		storedPaymentProvider   string
		expectedPaymentProvider string
		targetStatus            string
	}{
		{
			name:                    "stripe expire",
			tradeNo:                 "stripe-expire-guard",
			storedPaymentProvider:   PaymentProviderCreem,
			expectedPaymentProvider: PaymentProviderStripe,
			targetStatus:            common.TopUpStatusExpired,
		},
		{
			name:                    "waffo failed",
			tradeNo:                 "waffo-failed-guard",
			storedPaymentProvider:   PaymentProviderStripe,
			expectedPaymentProvider: PaymentProviderWaffo,
			targetStatus:            common.TopUpStatusFailed,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			insertUserForPaymentGuardTest(t, 150, 0)
			insertTopUpForPaymentGuardTest(t, tc.tradeNo, 150, tc.storedPaymentProvider)

			err := UpdatePendingTopUpStatus(tc.tradeNo, tc.expectedPaymentProvider, tc.targetStatus)
			require.ErrorIs(t, err, ErrPaymentMethodMismatch)
			assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, tc.tradeNo))
		})
	}
}

func TestCompleteSubscriptionOrder_RejectsMismatchedPaymentProvider(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 202, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 301)
	insertSubscriptionOrderForPaymentGuardTest(t, "sub-guard-order", 202, plan.Id, PaymentProviderStripe)

	err := CompleteSubscriptionOrder("sub-guard-order", `{"provider":"epay"}`, PaymentProviderEpay, "alipay")
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)

	order := GetSubscriptionOrderByTradeNo("sub-guard-order")
	require.NotNil(t, order)
	assert.Equal(t, common.TopUpStatusPending, order.Status)
	assert.Zero(t, countUserSubscriptionsForPaymentGuardTest(t, 202))

	topUp := GetTopUpByTradeNo("sub-guard-order")
	assert.Nil(t, topUp)
}

func TestExpireSubscriptionOrder_RejectsMismatchedPaymentProvider(t *testing.T) {
	truncateTables(t)

	insertUserForPaymentGuardTest(t, 303, 0)
	plan := insertSubscriptionPlanForPaymentGuardTest(t, 401)
	insertSubscriptionOrderForPaymentGuardTest(t, "sub-expire-guard", 303, plan.Id, PaymentProviderStripe)

	err := ExpireSubscriptionOrder("sub-expire-guard", PaymentProviderCreem)
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)

	order := GetSubscriptionOrderByTradeNo("sub-expire-guard")
	require.NotNil(t, order)
	assert.Equal(t, common.TopUpStatusPending, order.Status)
}

func createEpayTestOrder(t *testing.T, userId int, tradeNo string, provider string, status string) TopUp {
	t.Helper()
	topUp := TopUp{
		UserId:          userId,
		Amount:          2,
		Money:           10.0,
		TradeNo:         tradeNo,
		PaymentMethod:   "alipay",
		PaymentProvider: provider,
		CreateTime:      common.GetTimestamp(),
		Status:          status,
	}
	require.NoError(t, DB.Create(&topUp).Error)
	return topUp
}

func TestRechargeEpayCreditsQuotaExactlyOnce(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 501, 0)
	order := createEpayTestOrder(t, user.Id, "EPAYTESTONCE", PaymentProviderEpay, common.TopUpStatusPending)

	alreadyDone, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.NotZero(t, reloaded.CompleteTime)

	alreadyDone, err = RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeEpayKeepsRedisAndDatabaseCreditInSync(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 5
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 502, 7)
	require.NoError(t, populateUserCache(*user))
	order := createEpayTestOrder(t, user.Id, "EPAYTESTREDISSYNC", PaymentProviderEpay, common.TopUpStatusPending)

	alreadyDone, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 17, getUserQuotaForPaymentGuardTest(t, user.Id))
	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 17, cached.Quota)

	alreadyDone, err = RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)
	cached, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 17, cached.Quota)
}

func TestRechargeEpayUpdatesPaymentMethodToActual(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 503, 0)
	order := createEpayTestOrder(t, user.Id, "EPAYTESTMETHOD", PaymentProviderEpay, common.TopUpStatusPending)

	alreadyDone, err := RechargeEpay(order.TradeNo, "wxpay", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, "wxpay", reloaded.PaymentMethod)
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeEpayRejectsForeignAndNonPendingOrders(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 504, 7)

	t.Run("order from another payment provider", func(t *testing.T) {
		order := createEpayTestOrder(t, user.Id, "EPAYTESTSTRIPE", PaymentProviderStripe, common.TopUpStatusPending)
		_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
		assert.ErrorIs(t, err, ErrPaymentMethodMismatch)
		assert.Equal(t, 7, getUserQuotaForPaymentGuardTest(t, user.Id))
	})

	t.Run("order that is not pending", func(t *testing.T) {
		order := createEpayTestOrder(t, user.Id, "EPAYTESTEXPIRED", PaymentProviderEpay, common.TopUpStatusExpired)
		_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
		assert.ErrorIs(t, err, ErrTopUpStatusInvalid)
		assert.Equal(t, 7, getUserQuotaForPaymentGuardTest(t, user.Id))
	})

	t.Run("missing order", func(t *testing.T) {
		_, err := RechargeEpay("EPAYTESTMISSING", "alipay", "127.0.0.1")
		assert.ErrorIs(t, err, ErrTopUpNotFound)
	})
}

func TestRechargeEpayRejectsQuotaOverflowBeforeCompletingOrder(t *testing.T) {
	truncateTables(t)

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = float64(common.MaxWalletQuota + 1)
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	user := insertUserForPaymentGuardTest(t, 505, 3)
	order := createEpayTestOrder(t, user.Id, "EPAYTESTOVERFLOW", PaymentProviderEpay, common.TopUpStatusPending)

	_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
	require.Error(t, err)
	assert.Equal(t, 3, getUserQuotaForPaymentGuardTest(t, user.Id))
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
}

func TestRechargeEpayEnforcesFinalWalletQuotaLimit(t *testing.T) {
	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })

	testCases := []struct {
		name         string
		currentQuota int
		wantErr      bool
		wantQuota    int
		wantStatus   string
	}{
		{
			name:         "allows exact highest representable wallet balance",
			currentQuota: common.MaxWalletQuota - 1_000_000,
			wantQuota:    common.MaxWalletQuota,
			wantStatus:   common.TopUpStatusSuccess,
		},
		{
			name:         "rejects balance above wallet quota domain",
			currentQuota: common.MaxWalletQuota - 999_999,
			wantErr:      true,
			wantQuota:    common.MaxWalletQuota - 999_999,
			wantStatus:   common.TopUpStatusPending,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			user := insertUserForPaymentGuardTest(t, 506, tc.currentQuota)
			order := createEpayTestOrder(t, user.Id, "EPAYTESTWALLETLIMIT", PaymentProviderEpay, common.TopUpStatusPending)

			_, err := RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
			if tc.wantErr {
				require.ErrorIs(t, err, ErrTopUpQuotaLimitExceeded)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tc.wantQuota, getUserQuotaForPaymentGuardTest(t, user.Id))
			assert.Equal(t, tc.wantStatus, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
		})
	}
}
