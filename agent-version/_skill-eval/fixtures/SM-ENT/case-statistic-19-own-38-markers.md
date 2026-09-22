Сервис `summary-ms-statistic`, тип `backend`, стек Spring (маркеры из таблицы 3.1 применимы). Данные грепов:

## Счёт маркеров по коду (Шаг 3.1)
сущности `@Entity\b|^model |@Table\(`: 38

## Строки сущностей в описи (класс «сущности»; служебные и прочие классы опущены)
ArmataCard — entity/ArmataCard.java (@Entity)
ArmataCardImportHistory — entity/ArmataCardImportHistory.java (@Entity)
OperationRisk — entity/OperationRisk.java (@Entity)
Setting — entity/Setting.java (@Entity)
ArmataCardArea — entity/ArmataCardArea.java (@Entity)
ArmataCardProduct — entity/ArmataCardProduct.java (@Entity)
ArmataCardUser — entity/ArmataCardUser.java (@Entity)
ArmataCardCategory — entity/ArmataCardCategory.java (@Entity)
ArmataCardDamage — entity/ArmataCardDamage.java (@Entity)
ArmataCardComment — entity/ArmataCardComment.java (@Entity)
ArmataCardCriminalCase — entity/ArmataCardCriminalCase.java (@Entity)
ArmataCardVulnerability — entity/ArmataCardVulnerability.java (@Entity)
ArmataCardChannel — entity/ArmataCardChannel.java (@Entity)
ArmataCardMethod — entity/ArmataCardMethod.java (@Entity)
ArmataCardGroup — entity/ArmataCardGroup.java (@Entity)
ArmataCardSchema — entity/ArmataCardSchema.java (@Entity)
ArmataCardSample — entity/ArmataCardSample.java (@Entity)
ArmataCardCameraAnalysis — entity/ArmataCardCameraAnalysis.java (@Entity)
ArmataCardDenyReason — entity/ArmataCardDenyReason.java (@Entity)

## Заголовки `###` в «Владеет данными» черновика (19)
### `ArmataCard`
### `ArmataCardImportHistory`
### `OperationRisk`
### `Setting`
### `ArmataCardArea`
### `ArmataCardProduct`
### `ArmataCardUser`
### `ArmataCardCategory`
### `ArmataCardDamage`
### `ArmataCardComment`
### `ArmataCardCriminalCase`
### `ArmataCardVulnerability`
### `ArmataCardChannel`
### `ArmataCardMethod`
### `ArmataCardGroup`
### `ArmataCardSchema`
### `ArmataCardSample`
### `ArmataCardCameraAnalysis`
### `ArmataCardDenyReason`

## Блоки «Публичного контракта» черновика (выдержка, 6 из 13)
### `GET /api/v1/statistic/armata/card/area`
Срез за период.
сущности: → ArmataCardArea
- ответ маппится без исключения полей

### `GET /api/v1/statistic/slideshow/security`
Срез за период.
сущности: → не сущность, агрегат по ArmataCard
- ответ маппится без исключения полей
