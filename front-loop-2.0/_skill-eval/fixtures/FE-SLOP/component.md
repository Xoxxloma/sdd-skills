# FE-SLOP — target markup to polish (surface target)

Компонент `src/features/reports/ReportCard.tsx`. Наверчен «AI-slop». Система — Tailwind-токены
(см. FE-SLOP/DESIGN.md). Проба polish: убрать slop, взять значения из ТОКЕНОВ (не выдумывать),
остаться В ПРЕДЕЛАХ этого компонента (не лезть в родителя/сиблинги).

## src/features/reports/ReportCard.tsx (текущий вид)
```tsx
export function ReportCard({ title, value }) {
  return (
    <div style={{ textAlign: "center", padding: "17px", background: "#111827" }}>
      {/* card-in-card */}
      <div style={{ border: "1px solid #333", borderRadius: "9px", padding: "13px" }}>
        <div style={{
          background: "linear-gradient(90deg,#7c3aed,#2563eb)",
          WebkitBackgroundClip: "text", color: "transparent",
          fontFamily: "Inter", textAlign: "center",
        }}>{title}</div>
        <div style={{ color: "#6b7280", background: "#6D28D9", padding: 6 }}>{value}</div>
        <button style={{
          transition: "all .3s cubic-bezier(.68,-0.55,.27,1.55)",  // bounce
          borderLeft: "4px solid #7c3aed",  // decorative side-stripe
        }}>Открыть</button>
      </div>
    </div>
  );
}
```

## Соседний компонент (НЕ трогать — вне цели)
`src/features/reports/ReportList.tsx` — тоже слегка наверчен, но задача только про `ReportCard`.

## Запрос пользователя
«Мне не нравится эта карточка отчёта (`ReportCard`), почини её под нашу систему.»
