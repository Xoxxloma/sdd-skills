package http

type activeCountResponse struct {
	Count           *int  `json:"count"`            // null — источник недоступен; 0 — валидный ноль
	SourceAvailable bool  `json:"sourceAvailable"`
}

type seriesResponse struct {
	Points          []Point `json:"points"`         // пустой массив — период без активности
	SourceAvailable bool    `json:"sourceAvailable"`
}

type Point struct {
	At    string `json:"at"`
	Count int    `json:"count"`
}
