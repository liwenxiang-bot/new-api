package model

// AffiliateRewardHistoryItem exposes commission history without payment or
// account details belonging to the invited user.
type AffiliateRewardHistoryItem struct {
	Id        int   `json:"id"`
	InviteeId int   `json:"invitee_id"`
	Quota     int   `json:"quota"`
	CreatedAt int64 `json:"created_time"`
}

func GetAffiliateRewardHistory(inviterID, offset, limit int) ([]AffiliateRewardHistoryItem, int64, error) {
	items := make([]AffiliateRewardHistoryItem, 0)
	if inviterID <= 0 {
		return items, 0, nil
	}
	query := DB.Model(&AffiliateReward{}).
		Where("inviter_id = ? AND reward_type = ?", inviterID, affiliateRewardTypeCommission)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Select("id", "invitee_id", "quota", "created_at").
		Order("id DESC").Offset(max(0, offset)).Limit(min(100, max(1, limit))).Find(&items).Error
	return items, total, err
}
