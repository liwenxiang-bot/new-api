package model

import (
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	affiliateRewardTypeCommission = "commission"
	affiliateRewardTypeInvitee    = "invitee"
)

// AffiliateReward records a wallet credit that was earned through a referred
// user's successful external top-up. The unique top-up/type index makes the
// settlement idempotent even if a payment provider retries its callback.
type AffiliateReward struct {
	Id          int    `json:"id"`
	TopUpId     int    `json:"top_up_id" gorm:"uniqueIndex:idx_affiliate_reward_topup_type"`
	InviterId   int    `json:"inviter_id" gorm:"index"`
	InviteeId   int    `json:"invitee_id" gorm:"index"`
	RecipientId int    `json:"recipient_id" gorm:"index"`
	RewardType  string `json:"reward_type" gorm:"type:varchar(32);uniqueIndex:idx_affiliate_reward_topup_type"`
	Quota       int    `json:"quota"`
	CreatedAt   int64  `json:"created_at"`
}

type AffiliateRewardResult struct {
	InviteeQuota int
}

// GetAffiliateMinimumTransferQuota returns the current transfer threshold in
// integral quota units. Rounding up ensures even fractional USD thresholds
// cannot be bypassed; a transfer must remain positive when the threshold is zero.
func GetAffiliateMinimumTransferQuota() (int, error) {
	minimum := common.AffiliateRewardMinTransfer
	if math.IsNaN(minimum) || math.IsInf(minimum, 0) || minimum < 0 || minimum > 1_000_000 {
		return 0, errors.New("邀请奖励最低划转金额配置无效，请联系管理员！")
	}
	quotaPerUnit := common.QuotaPerUnit
	if math.IsNaN(quotaPerUnit) || math.IsInf(quotaPerUnit, 0) || quotaPerUnit <= 0 {
		return 0, errors.New("邀请额度单位配置无效，请联系管理员！")
	}
	quota, err := common.WalletQuotaFromDecimalStrict(
		decimal.NewFromFloat(minimum).Mul(decimal.NewFromFloat(quotaPerUnit)).Ceil(),
	)
	if err != nil {
		return 0, errors.New("邀请奖励最低划转额度超出有效范围，请联系管理员！")
	}
	return max(1, quota), nil
}

// GetAffiliateQualifiedInviteCount returns the number of distinct invitees
// whose qualifying top-up has produced a percentage commission. Keeping this
// in the reward ledger prevents legacy registration counts from being mixed
// into the percentage reward dashboard after the feature is enabled.
func GetAffiliateQualifiedInviteCount(userID int) int {
	if userID <= 0 {
		return 0
	}
	var count int64
	if err := DB.Model(&AffiliateReward{}).
		Where("inviter_id = ? AND reward_type = ?", userID, affiliateRewardTypeCommission).
		Distinct("invitee_id").Count(&count).Error; err != nil {
		common.SysError(fmt.Sprintf("failed to count qualified affiliate invites for user %d: %v", userID, err))
		return 0
	}
	if count > int64(^uint(0)>>1) {
		return int(^uint(0) >> 1)
	}
	return int(count)
}

func affiliateMinimumTopUpQuota() (int, error) {
	minimum := common.AffiliateRewardMinTopUp
	if math.IsNaN(minimum) || math.IsInf(minimum, 0) || minimum < 0 {
		return 0, errors.New("invalid affiliate minimum top-up")
	}
	if minimum == 0 {
		return 0, nil
	}
	if math.IsNaN(common.QuotaPerUnit) || math.IsInf(common.QuotaPerUnit, 0) || common.QuotaPerUnit <= 0 {
		return 0, errors.New("invalid quota per unit")
	}
	return common.WalletQuotaFromDecimalStrict(
		decimal.NewFromFloat(minimum).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	)
}

func affiliateCommissionQuota(creditedQuota int) (int, error) {
	ratio := common.AffiliateRewardRatio
	if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio < 0 || ratio > 100 {
		return 0, errors.New("invalid affiliate commission rate")
	}
	if creditedQuota <= 0 || ratio == 0 {
		return 0, nil
	}
	return common.WalletQuotaFromDecimalStrict(
		decimal.NewFromInt(int64(creditedQuota)).Mul(
			decimal.NewFromFloat(ratio).Div(decimal.NewFromInt(100)),
		),
	)
}

func affiliateRewardExists(tx *gorm.DB, topUpId int, rewardType string) (bool, error) {
	var count int64
	err := tx.Model(&AffiliateReward{}).
		Where("top_up_id = ? AND reward_type = ?", topUpId, rewardType).
		Count(&count).Error
	return count > 0, err
}

func affiliateProviderAllowed(paymentProvider string) bool {
	switch paymentProvider {
	case PaymentProviderEpay, PaymentProviderStripe, PaymentProviderCreem, PaymentProviderWaffo, PaymentProviderWaffoPancake:
		return true
	default:
		return false
	}
}

// ApplyAffiliateTopUpReward settles the inviter commission and the optional
// invitee bonus in the same transaction as the top-up. It only considers
// successful external top-ups; callers must invoke it before committing the
// top-up transaction.
func ApplyAffiliateTopUpReward(tx *gorm.DB, topUpId int, inviteeId int, creditedQuota int, paymentProvider string) (AffiliateRewardResult, error) {
	result := AffiliateRewardResult{}
	if !common.AffiliateRewardEnabled || !operation_setting.IsPaymentComplianceConfirmed() || topUpId <= 0 || inviteeId <= 0 || creditedQuota <= 0 {
		return result, nil
	}
	if !affiliateProviderAllowed(paymentProvider) {
		return result, nil
	}

	minimumQuota, err := affiliateMinimumTopUpQuota()
	if err != nil {
		common.SysError(fmt.Sprintf("affiliate reward skipped for top-up %d: %v", topUpId, err))
		return result, nil
	}
	if minimumQuota > 0 && creditedQuota < minimumQuota {
		return result, nil
	}

	// Lock the invitee row so two different orders cannot both grant the
	// one-time invitee reward or qualified-invite count concurrently.
	var invitee User
	if err := lockForUpdate(tx).Select("id", "inviter_id").First(&invitee, inviteeId).Error; err != nil {
		return result, err
	}
	if invitee.InviterId <= 0 || invitee.InviterId == invitee.Id {
		return result, nil
	}

	commissionQuota, err := affiliateCommissionQuota(creditedQuota)
	if err != nil {
		common.SysError(fmt.Sprintf("affiliate reward skipped for top-up %d: %v", topUpId, err))
		return result, nil
	}
	if commissionQuota > 0 {
		exists, err := affiliateRewardExists(tx, topUpId, affiliateRewardTypeCommission)
		if err != nil {
			return result, err
		}
		if !exists {
			var qualifiedInvites int64
			if err := tx.Model(&AffiliateReward{}).
				Where("invitee_id = ? AND reward_type = ?", invitee.Id, affiliateRewardTypeCommission).
				Count(&qualifiedInvites).Error; err != nil {
				return result, err
			}

			maxReward := common.MaxWalletQuota - commissionQuota
			updates := map[string]any{
				"aff_quota":   gorm.Expr("aff_quota + ?", commissionQuota),
				"aff_history": gorm.Expr("aff_history + ?", commissionQuota),
			}
			if qualifiedInvites == 0 {
				updates["aff_count"] = gorm.Expr("aff_count + ?", 1)
			}
			updated := tx.Model(&User{}).Where(
				"id = ? AND aff_quota <= ? AND aff_history <= ?",
				invitee.InviterId, maxReward, maxReward,
			).Updates(updates)
			if updated.Error != nil {
				return result, updated.Error
			}
			if updated.RowsAffected != 1 {
				common.SysLog(fmt.Sprintf("affiliate reward skipped for inviter %d: quota limit or user missing", invitee.InviterId))
			} else {
				if err := tx.Create(&AffiliateReward{
					TopUpId:     topUpId,
					InviterId:   invitee.InviterId,
					InviteeId:   invitee.Id,
					RecipientId: invitee.InviterId,
					RewardType:  affiliateRewardTypeCommission,
					Quota:       commissionQuota,
					CreatedAt:   common.GetTimestamp(),
				}).Error; err != nil {
					return result, err
				}
			}
		}
	}

	if common.QuotaForInvitee > 0 {
		var inviteeRewardCount int64
		err := tx.Model(&AffiliateReward{}).
			Where("invitee_id = ? AND reward_type = ?", invitee.Id, affiliateRewardTypeInvitee).
			Count(&inviteeRewardCount).Error
		if err != nil {
			return result, err
		}
		if inviteeRewardCount == 0 {
			if err := creditTopUpQuota(tx, invitee.Id, common.QuotaForInvitee, nil); err != nil {
				if errors.Is(err, ErrTopUpQuotaLimitExceeded) || errors.Is(err, ErrInvalidTopUpQuota) {
					common.SysError(fmt.Sprintf("affiliate invitee reward skipped for top-up %d, user %d: %v", topUpId, invitee.Id, err))
					return result, nil
				}
				return result, err
			}
			if err := tx.Create(&AffiliateReward{
				TopUpId:     topUpId,
				InviterId:   invitee.InviterId,
				InviteeId:   invitee.Id,
				RecipientId: invitee.Id,
				RewardType:  affiliateRewardTypeInvitee,
				Quota:       common.QuotaForInvitee,
				CreatedAt:   common.GetTimestamp(),
			}).Error; err != nil {
				return result, err
			}
			result.InviteeQuota = common.QuotaForInvitee
		}
	}

	return result, nil
}
