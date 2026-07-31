package session

type Session struct {
	ID         string
	UserID     string
	CreatedAt  time.Time
	LastSeenAt time.Time
	RevokedAt  *time.Time // nil — сессия жива; проставляется при logout и при отзыве админом
	UserAgent  string
}

type Role string

const (
	RoleAdmin      Role = "ADMIN"
	RoleDispatcher Role = "DISPATCHER"
	RoleEngineer   Role = "ENGINEER"
	RoleOperator   Role = "OPERATOR"
)
