// Именованные состояния экранов. zero и empty различаются намеренно:
// ноль инцидентов — это «0», а отсутствие данных — прочерк.
export type ViewState = "loading" | "value" | "zero" | "empty" | "error_source" | "error_forbidden"
