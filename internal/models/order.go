package models

import (
	"encoding/json"
	"time"
)

type OrderStatus string

const (
	OrderPending  OrderStatus = "pending"
	OrderPaid     OrderStatus = "paid"
	OrderShipped  OrderStatus = "shipped"
	OrderCanceled OrderStatus = "canceled"
)

type OrderItem struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
}

type Order struct {
	ID        int64           `db:"id"`
	UserID    int64           `db:"user_id"`
	Items     json.RawMessage `db:"items"`
	Total     float64         `db:"total"`
	Status    OrderStatus     `db:"status"`
	CreatedAt time.Time       `db:"created_at"`
}
